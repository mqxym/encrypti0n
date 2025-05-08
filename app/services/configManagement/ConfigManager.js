import { StorageService } from '../StorageService.js';
import { ApplicationEncryptionManager } from './ApplicationEncryptionManager.js';
import { ConfigManagerConstants } from '../../constants/constants.js';

/**
 * @class ConfigManager
 * @classdesc
 * High-level interface for application configuration storage and encryption.
 * Manages master-password and default-key workflows, slot data, and persistent storage.
 */
export class ConfigManager {
  /**
   * Initializes the ConfigManager with storage and encryption managers.
   */
  constructor() {
    /** @private {StorageService} */
    this.storageService = new StorageService();
    /** @private {ApplicationEncryptionManager} */
    this.encryptionManager = new ApplicationEncryptionManager();
    /** @private {Object|null} */
    this.config = null;
    /** @private {CryptoKey|null} in-memory only */
    this.dek = null;
  }

  // -----------------------------
  // Factory
  // -----------------------------

  /**
   * Factory method to create and initialize a ConfigManager instance.
   * Loads existing config or creates a new one, and caches default key if needed.
   *
   * @async
   * @static
   * @returns {Promise<ConfigManager>} The initialized ConfigManager.
   */
  static async create() {
    const instance = new ConfigManager();
    instance.config = instance.storageService.getConf();

    if (!instance.config) {
      await instance._initFreshConfig();
      instance._saveConfig();
    } else if (instance.config.header?.v !== ConfigManagerConstants.CURRENT_DATA_VERSION) {
      await instance._convertFromV1();
    }

    await instance._loadDekIntoMemory().catch(() => {});
    return instance;
  }

  // -----------------------------
  // Initialization & Migration
  // -----------------------------

  /**
   * Initialise new config with random DEK + wrappedKey header.
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _initFreshConfig() {
    this.dek = await this.encryptionManager.createDek();

    // default (password-less) mode: get device-key KEK
    const deviceKek = await this.encryptionManager.getDeviceKey();

    // wrap DEK with deviceKek using random IV
    const { ivWrap, wrappedKey } = await this.encryptionManager.wrapDek(this.dek, deviceKek);

    this.dek = await this.encryptionManager.unwrapDek(ivWrap, wrappedKey);

    // build header + empty data
    this.config = {
      header: {
        v: 2,
        salt: '',
        rounds: 1,
        iv: ivWrap,
        wrappedKey
      },
      data: { iv: '', ciphertext: '' }
    };

    const initialData = {
      slots: {
        1: { name: 'Slot 1', value: null },
        2: { name: 'Slot 2', value: null },
        3: { name: 'Slot 3', value: null },
        4: { name: 'Slot 4', value: null },
        5: { name: 'Slot 5', value: null },
        6: { name: 'Slot 6', value: null },
        7: { name: 'Slot 7', value: null },
        8: { name: 'Slot 8', value: null },
        9: { name: 'Slot 9', value: null },
        10: { name: 'Slot 10', value: null }
      },
      Options: {
        saltDifficulty: 'high',
        roundDifficulty: 'middle'
      }
    };

    await this._encryptAndStore(initialData).catch(err => {
      throw new Error(`Failed to init config: ${err.message}`);
    });
  }

  /**
   * Converts a legacy v1 config to the current format (v2).
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _convertFromV1() {
    if (this.config.dataVersion !== 1) return;

    const { isUsingMasterPassword, argon2Salt, argon2Rounds } = this.config;
    let kek;

    if (isUsingMasterPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Migration to local data v2 not possible.',
        text: 'Due to limitations with a set master password, a migration to a more secure local data model (v2) is not possible. Your only option is to reset local data.',
        showCancelButton: false,
        confirmButtonText: 'Ok'
      });
      return;
    } else {
      await this._deriveDefaultKeyOnStartupV1();
      kek = this.encryptionManager.sessionKeyManager.getSessionKey(argon2Salt, argon2Rounds);
    }

    // Decrypt existing data with KEK
    const plainData = await this.encryptionManager.decryptData(
      kek,
      this.config.data.iv,
      this.config.data.ciphertext
    );

    // Generate new DEK and re-wrap
    this.dek = await this.encryptionManager.createDek();
    const { iv, ciphertext } = await this.encryptionManager.encryptData(this.dek, plainData);

    const deviceKek = await this.encryptionManager.getDeviceKey();
    const { ivWrap, wrappedKey } = await this.encryptionManager.wrapDek(this.dek, deviceKek);
    this.dek = await this.encryptionManager.unwrapDek(ivWrap, wrappedKey, deviceKek);

    // Build version-2 header
    const header = {
      v: ConfigManagerConstants.CURRENT_DATA_VERSION,
      salt: isUsingMasterPassword ? argon2Salt : '',
      rounds: isUsingMasterPassword ? argon2Rounds : 1,
      iv: ivWrap,
      wrappedKey
    };

    this.config = { header, data: { iv, ciphertext } };
    this._saveConfig();

    Swal.fire({
      icon: 'success',
      title: 'Migrated local data to v2!',
      text: 'The security of your local data has improved by a lot.',
      showCancelButton: false,
      confirmButtonText: 'Ok'
    });
  }

  /**
   * Derives and caches the default key on startup for legacy v1.
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _deriveDefaultKeyOnStartupV1() {
    if (!this.config.isUsingMasterPassword) {
      await this.encryptionManager.sessionKeyManager.deriveAndCacheDefaultKeyV1(
        this.config.default,
        this.config.argon2Salt,
        this.config.argon2Rounds,
        ConfigManagerConstants.ARGON2_MEM_DEFAULT_KEY
      );
    }
  }

  /**
   * Loads DEK into RAM – unwraps with device key or awaits user unlock.
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _loadDekIntoMemory() {
    if (this.isUsingMasterPassword()) return;
    const deviceKek = await this.encryptionManager.getDeviceKey();
    await this._unwrapDek(deviceKek);
  }

  // -----------------------------
  // Session Unlock / Lock
  // -----------------------------

  /**
   * Unlocks the session by deriving KEK from master password and unwrapping the DEK.
   *
   * @async
   * @param {string} masterPassword - The master password.
   * @returns {Promise<void>}
   */
  async unlockSession(masterPassword) {
    const { salt, rounds } = this.config.header;
    await this._deriveKekFromPassword(masterPassword, salt, rounds);
    await this._unwrapDek();
  }

  /**
   * Locks the session by clearing the in-memory session key and DEK.
   *
   * @returns {void}
   */
  lockSession() {
    this.encryptionManager.sessionKeyManager.clearSessionKey();
    this.dek = null;
  }

  // -----------------------------
  // Data Access
  // -----------------------------

  /**
   * Retrieves and decrypts the entire configuration data object.
   *
   * @async
   * @returns {Promise<{ slots: Object, Options: Object }>}
   * @throws {Error} If session is locked.
   */
  async getDecryptedData() {
    if (!this.dek) throw new Error('Session locked');
    const { iv, ciphertext } = this.config.data;
    if (!iv || !ciphertext) return { slots: {}, Options: {} };
    return this.encryptionManager.decryptData(this.dek, iv, ciphertext);
  }

  /**
   * Encrypts and persists the given data object into the config.
   *
   * @async
   * @param {Object} newData - The data structure to encrypt.
   * @returns {Promise<void>}
   * @throws {Error} If session is locked.
   */
  async setDecryptedData(newData) {
    if (!this.dek) throw new Error('Session locked');
    await this._encryptAndStore(newData);
  }

  /**
   * Reads all slot names from the decrypted data.
   *
   * @async
   * @returns {Promise<Object.<string, string>>} Map of slot IDs to names.
   */
  async readSlotNames() {
    const data = await this.getDecryptedData();
    const result = {};
    for (const key in data.slots) {
      if (data.slots.hasOwnProperty(key)) {
        result[key] = data.slots[key].name;
      }
    }
    this._securelyClearObject(data);
    return result;
  }

  /**
   * Reads the value of a specific slot.
   *
   * @async
   * @param {string|number} id - Slot identifier.
   * @returns {Promise<*>} The stored slot value.
   * @throws {Error} If the slot does not exist.
   */
  async readSlotValue(id) {
    const data = await this.getDecryptedData();
    if (!data.slots[id]) {
      throw new Error(`Slot ${id} does not exist`);
    }
    const value = data.slots[id].value;
    this._securelyClearObject(data);
    return value;
  }

  /**
   * Sets a new value for a specific slot.
   *
   * @async
   * @param {string|number} id - Slot identifier.
   * @param {*} newValue - The new value to store.
   * @returns {Promise<void>}
   */
  async setSlotValue(id, newValue) {
    const data = await this.getDecryptedData();
    if (!data.slots[id]) {
      data.slots[id] = { name: `slot${id}`, value: null };
    }
    data.slots[id].value = newValue;
    await this.setDecryptedData(data);
    this._securelyClearObject(data);
  }

  /**
   * Renames an existing slot.
   *
   * @async
   * @param {string|number} id - Slot identifier.
   * @param {string} newName - The new slot name.
   * @returns {Promise<void>}
   */
  async setSlotName(id, newName) {
    const data = await this.getDecryptedData();
    if (!data.slots[id]) {
      data.slots[id] = { name: newName, value: null };
    }
    data.slots[id].name = newName;
    await this.setDecryptedData(data);
    this._securelyClearObject(data);
  }

  /**
   * Updates option settings (e.g., Argon2 difficulties) in the config.
   *
   * @async
   * @param {{ saltDifficulty: string|null, roundDifficulty: string|null }} options
   *   Object containing new or null values for each option.
   * @returns {Promise<void>}
   */
  async setOptions(options) {
    const data = await this.getDecryptedData();
    const validRound = ['low', 'middle', 'high'];
    const validSalt = ['low', 'high'];

    if (
      (options.saltDifficulty === null || validSalt.includes(options.saltDifficulty)) &&
      (options.roundDifficulty === null || validRound.includes(options.roundDifficulty))
    ) {
      if (options.saltDifficulty === null) {
        options.saltDifficulty = data.Options?.saltDifficulty ?? null;
      }
      if (options.roundDifficulty === null) {
        options.roundDifficulty = data.Options?.roundDifficulty ?? null;
      }
      data.Options = options;
      await this.setDecryptedData(data);
    }
    this._securelyClearObject(data);
  }

  /**
   * Reads the current Argon2 options from config.
   *
   * @async
   * @returns {Promise<{ saltDifficulty: string, roundDifficulty: string }>}
   * @throws {Error} If options are missing.
   */
  async readOptions() {
    const data = await this.getDecryptedData();
    if (!data.Options) {
      throw new Error('Options does not exist');
    }
    return data.Options;
  }

  // -----------------------------
  // Master Password Management
  // -----------------------------

  /**
   * Sets a new master password, re-encrypting all data under the new credentials.
   *
   * @async
   * @param {string} newMasterPassword - The new master password to use.
   * @returns {Promise<void>}
   */
  async setMasterPassword(newMasterPassword) {
    const deviceKek = await this.encryptionManager.getDeviceKey();

    // fresh salt & rounds
    const newSalt = this.encryptionManager.generateRandomSalt();
    const newRounds = this._getRandomInt(
      ConfigManagerConstants.ARGON2_ROUNDS_MIN,
      ConfigManagerConstants.ARGON2_ROUNDS_MAX
    );

    // derive new KEK from password
    const newKek = await this._deriveKekFromPassword(newMasterPassword, newSalt, newRounds);

    await this._unwrapDek(deviceKek, true);
    const { ivWrap, wrappedKey } = await this.encryptionManager.wrapDek(this.dek, newKek);

    this.config.header = {
      v: ConfigManagerConstants.CURRENT_DATA_VERSION,
      salt: newSalt,
      rounds: newRounds,
      iv: ivWrap,
      wrappedKey
    };

    await this._unwrapDek(null, false);
    this._saveConfig();
  }

  /**
   * Disables the master password and reverts to a device-key based KEK.
   *
   * Flow:
   * 1. Assert we’re in master-password mode; ensure DEK is unwrapped.
   * 2. Fetch (or create) the device-scoped KEK from IndexedDB.
   * 3. Wrap the DEK with that KEK using a fresh IV.
   * 4. Replace header so `rounds === 1` ⇒ password-less mode.
   * 5. Clear SessionKeyManager cache (no KEK is needed now).
   *
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If not currently using a master password.
   */
  async removeMasterPassword() {
    if (!this.isUsingMasterPassword()) {
      throw new Error('No master password is set.');
    }

    const deviceKek = await this.encryptionManager.getDeviceKey();
    await this._unwrapDek(null, true);

    const { ivWrap, wrappedKey } = await this.encryptionManager.wrapDek(this.dek, deviceKek);

    this.config.header = {
      v: 2,
      salt: '',
      rounds: 1,
      iv: ivWrap,
      wrappedKey
    };

    await this._unwrapDek(deviceKek, false);
    this.encryptionManager.sessionKeyManager.clearSessionKey();
    this._saveConfig();
  }

  // -----------------------------
  // Configuration Reset
  // -----------------------------

  /**
   * Deletes all configuration data and reinitializes to defaults.
   *
   * @async
   * @returns {Promise<void>}
   */
  async deleteAllConfigData() {
    this.encryptionManager.sessionKeyManager.clearSessionKey();
    this.storageService.deleteAllData();
    this.config = null;
    this.dek = null;
    await this._initFreshConfig();
  }

  // -----------------------------
  // Helpers
  // -----------------------------

  /**
   * Persists the current in-memory config object to storage.
   *
   * @private
   * @returns {void}
   */
  _saveConfig() {
    this.storageService.setConf(this.config);
  }

  /**
   * Encrypts data with DEK, updates config.data, and saves to storage.
   *
   * @private
   * @async
   * @param {Object} plainData - The data to encrypt and store.
   * @returns {Promise<void>}
   */
  async _encryptAndStore(plainData) {
    const { iv, ciphertext } = await this.encryptionManager.encryptData(this.dek, plainData);
    this.config.data.iv = iv;
    this.config.data.ciphertext = ciphertext;
    this._saveConfig();
  }

  /**
   * Derives KEK from password and caches it inside SessionKeyManager.
   *
   * @private
   * @async
   * @param {string} password - Master password.
   * @param {string} saltB64 - Base64 salt.
   * @param {number} rounds - Argon2 rounds.
   * @returns {Promise<CryptoKey>} The derived KEK.
   */
  async _deriveKekFromPassword(password, saltB64, rounds) {
    return this.encryptionManager.sessionKeyManager.deriveAndCacheKey(
      password,
      saltB64,
      rounds
    );
  }

  /**
   * Unwraps DEK using provided or cached KEK.
   *
   * @private
   * @async
   * @param {CryptoKey} [kek] - Optional KEK for unwrapping.
   * @param {boolean} [forWrapping=false] - If true, uses unwrap-for-wrapping logic.
   * @returns {Promise<void>}
   */
  async _unwrapDek(kek, forWrapping = false) {
    const { iv, wrappedKey } = this.config.header;
    let actualKek = kek;
    if (!actualKek) {
      const { salt, rounds } = this.config.header;
      actualKek = this.encryptionManager.sessionKeyManager.getSessionKey(salt, rounds);
      if (!actualKek) throw new Error('Session locked');
    }
    if (forWrapping) {
      this.dek = await this.encryptionManager.unwrapDekForWrapping(iv, wrappedKey, actualKek);
    } else {
      this.dek = await this.encryptionManager.unwrapDek(iv, wrappedKey, actualKek);
    }
  }

  /**
   * Generates a random integer between min and max (inclusive).
   *
   * @private
   * @param {number} min - Lower bound.
   * @param {number} max - Upper bound.
   * @returns {number} Random integer in [min, max].
   */
  _getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Recursively overwrites all properties in an object with null to clear sensitive data.
   *
   * @private
   * @param {*} obj - Object to clear.
   */
  _securelyClearObject(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this._securelyClearObject(obj[key]);
      } else {
        obj[key] = null;
      }
    }
  }

  /**
   * Checks if master-password mode is active.
   *
   * @returns {boolean} true if in master-password mode.
   */
  isUsingMasterPassword() {
    return this.config.header.rounds > 1;
  }
}