import { StorageService } from '../StorageService.js';
import { ApplicationEncryptionManager } from './ApplicationEncryptionManager.js';
import { PasswordGenerator } from '../../passwordGenerator.js';
import { ConfigManagerConstants } from '../../constants/constants.js';

/**
 * ConfigManager
 *
 * - High-level interface: readSlotValue, setSlotValue, setMasterPassword, removeMasterPassword, etc.
 * - All encryption/decryption done via a single in-memory CryptoKey (cached for the session).
 */
export class ConfigManager {
  constructor() {
    this.storageService = new StorageService();
    this.encryptionManager = new ApplicationEncryptionManager();
  }

  // Factory
  static async create() {
    const instance = new ConfigManager();
    instance.config = instance.storageService.getConf();
    if (!instance.config) {
      await instance._initNewConfig();
      instance._saveConfig();
    }
    if (!instance.config.isUsingMasterPassword) {
      await instance._deriveDefaultKeyOnStartup().catch(() => {});
    }
    return instance;
  }

  isUsingMasterPassword () {
    return this.config.isUsingMasterPassword;
  }

  // -----------------------------
  // Initial Configuration
  // -----------------------------
  async _initNewConfig() {
    const salt = this.encryptionManager.generateRandomSalt();
    const defaultKey = this.encryptionManager.getRandomPassword();
    const rounds = ConfigManagerConstants.ARGON2_ROUNDS_NO_PW;

    this.config = {
      isUsingMasterPassword: false,
      argon2Rounds: rounds,
      argon2Salt: salt,
      default: defaultKey,
      dataVersion: ConfigManagerConstants.CURRENT_DATA_VERSION,
      data: { iv: '', ciphertext: '' }
    };

    // Encrypt an empty data structure to start
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
    // We'll do an async encryption call:
    await this._encryptAndUpdateConfig(initialData).catch(err => {
      throw new Error(`Failed to init config: ${err.message}`);
    });
  }

  async _deriveDefaultKeyOnStartup() {
    // Only do this if we're not using a master password
    if (!this.config.isUsingMasterPassword) {
      await this.encryptionManager.sessionKeyManager.deriveAndCacheDefaultKey(
        this.config.default,
        this.config.argon2Salt,
        this.config.argon2Rounds
      );
    }
  }

  // -----------------------------
  // Session Unlock
  // -----------------------------
  /**
   * Called when the user enters the master password for the current session.
   * This derives a key and caches it in memory for fast encryption/decryption.
   */
  async unlockSession(masterPassword) {
    if (!this.config.isUsingMasterPassword) {
      throw new Error('Config is not using a master password. Nothing to unlock.');
    }

    // Derive the key once, store in session manager
    await this.encryptionManager.sessionKeyManager.deriveAndCacheKey(
      masterPassword,
      this.config.argon2Salt,
      this.config.argon2Rounds
    );

    try {
      await this.getDecryptedData();
    } catch (error) {
      throw new Error("Master Password is wrong");
    }
  }

  /**
   * Clears the in-memory session key. If the user leaves or logs out, call this.
   */
  lockSession() {
    this.encryptionManager.sessionKeyManager.clearSessionKey();
  }

  // -----------------------------
  // Reading / Writing Data
  // -----------------------------
  /**
   * Reads and decrypts the entire data object.
   * If a master password is in use, you must have called unlockSession(...) first.
   */
  async getDecryptedData() {
    const key = await this._getSessionKeyOrThrow();
    const { iv, ciphertext } = this.config.data;
    if (!iv || !ciphertext) {
      return { slots: {}, Options: {} };
    }
    return this.encryptionManager.decryptData(key, iv, ciphertext);
  }

  /**
   * Encrypts and stores the entire data object.
   */
  async setDecryptedData(newData) {
    await this._encryptAndUpdateConfig(newData);
  }

  /**
   * Config Read and Write APIs
   */

  async readSlotNames() {
    const data = await this.getDecryptedData();
    const result = {};
    for (const key in data.slots) {
        if (data.slots.hasOwnProperty(key)) {
            result[key] = data.slots[key].name;
        }
    }
    // Clear from memory
    this._securelyClearObject(data);
    return result;
  }

  async readSlotValue(id) {
    const data = await this.getDecryptedData();
    if (!data.slots[id]) {
      throw new Error(`Slot ${id} does not exist`);
    }
    const value = data.slots[id].value;

    // Clear from memory
    this._securelyClearObject(data);
    return value;
  }

  async setSlotValue(id, newValue) {
    const data = await this.getDecryptedData();
    if (!data.slots[id]) {
      data.slots[id] = { name: `slot${id}`, value: null };
    }
    data.slots[id].value = newValue;
    await this.setDecryptedData(data);
    this._securelyClearObject(data);
  }

  async setSlotName(id, newName) {
    const data = await this.getDecryptedData();
    if (!data.slots[id]) {
      data.slots[id] = { name: newName, value: null };
    }
    data.slots[id].name = newName;
    await this.setDecryptedData(data);
    this._securelyClearObject(data);
  }

  async setOptions(options) {
    const data = await this.getDecryptedData();
    const validRoundDifficulties = ['low', 'middle', 'high'];
    const validSaltDifficulties = ['low', 'high'];
  
    if (
      (options.saltDifficulty === null || this._isPropertyInArray(options, 'saltDifficulty', validSaltDifficulties)) &&
      (options.roundDifficulty === null || this._isPropertyInArray(options, 'roundDifficulty', validRoundDifficulties))
    ) {
      // For any option that is null, use the current decrypted value
      if (options.saltDifficulty === null) {
        options.saltDifficulty = data.Options ? data.Options.saltDifficulty : null;
      }
      if (options.roundDifficulty === null) {
        options.roundDifficulty = data.Options ? data.Options.roundDifficulty : null;
      }
      data.Options = options;
      await this.setDecryptedData(data);
    }
    this._securelyClearObject(data);
  }

  async readOptions() {
    const data = await this.getDecryptedData();
    if (!data.Options) {
      throw new Error(`Options does not exist`);
    }
    const options = data.Options;
    return options;
  }

  _isPropertyInArray(obj, prop, arr) {
    return obj.hasOwnProperty(prop) && arr.includes(obj[prop]);
  }   

  // -----------------------------
  // Master Password Management
  // -----------------------------
  /**
   * Sets a master password. This re-derives from the old key (whether default or old master),
   * then re-encrypts with new argon2 parameters.
   */
  async setMasterPassword(newMasterPassword) {
    // Decrypt current data with the existing session key
    const oldKey = await this._getSessionKeyOrThrow(); // If previously default or old master
    const plainData = await this.encryptionManager.decryptData(
      oldKey,
      this.config.data.iv,
      this.config.data.ciphertext
    );

    // Update config with new salt & rounds
    const newSalt = this.encryptionManager.generateRandomSalt();
    const newRounds = this._getRandomInt(ConfigManagerConstants.ARGON2_ROUNDS_MIN, ConfigManagerConstants.ARGON2_ROUNDS_MAX);
    this.config.isUsingMasterPassword = true;
    this.config.argon2Salt = newSalt;
    this.config.argon2Rounds = newRounds;
    this.config.default = '';

    // Derive new key from the new master password, re-encrypt
    this.encryptionManager.sessionKeyManager.clearSessionKey();
    const newKey = await this.encryptionManager.sessionKeyManager.deriveAndCacheKey(
      newMasterPassword,
      newSalt,
      newRounds
    );
    const encrypted = await this.encryptionManager.encryptData(newKey, plainData);
    this.config.data.iv = encrypted.iv;
    this.config.data.ciphertext = encrypted.ciphertext;

    this._saveConfig();
    this._securelyClearObject(plainData);
  }

  /**
   * Removes the master password, reverting to a default password scenario.
   */
  async removeMasterPassword() {
    // Decrypt with the current session key
    const oldKey = await this._getSessionKeyOrThrow();
    const plainData = await this.encryptionManager.decryptData(
      oldKey,
      this.config.data.iv,
      this.config.data.ciphertext
    );

    // Switch to default-based encryption
    this.config.isUsingMasterPassword = false;
    this.config.argon2Salt = this.encryptionManager.generateRandomSalt();
    this.config.argon2Rounds = ConfigManagerConstants.ARGON2_ROUNDS_NO_PW;
    this.config.default = this.encryptionManager.getRandomPassword();
    // Clear old session key, derive new default key, re-encrypt
    this.encryptionManager.sessionKeyManager.clearSessionKey();
    const newKey = await this.encryptionManager.sessionKeyManager.deriveAndCacheDefaultKey(
      this.config.default,
      this.config.argon2Salt,
      this.config.argon2Rounds
    );
    const encrypted = await this.encryptionManager.encryptData(newKey, plainData);
    this.config.data.iv = encrypted.iv;
    this.config.data.ciphertext = encrypted.ciphertext;

    this._saveConfig();
    this._securelyClearObject(plainData);
  }

  // -----------------------------
  // Deleting All Data
  // -----------------------------
  async deleteAllConfigData() {
    this.encryptionManager.sessionKeyManager.clearSessionKey();
    this.storageService.deleteAllData();
    this.config = null;
    await this._initNewConfig();
  }

  // -----------------------------
  // Internals
  // -----------------------------
  /**
   * Encrypts data with the current session key (must exist).
   */
  async _encryptAndUpdateConfig(plainData) {
    const key = await this._getSessionKeyOrThrow();
    const { iv, ciphertext } = await this.encryptionManager.encryptData(key, plainData);

    this.config.data.iv = iv;
    this.config.data.ciphertext = ciphertext;
    this._saveConfig();
  }

  async _getSessionKeyOrThrow() {
    const { argon2Salt, argon2Rounds } = this.config;
    let key = this.encryptionManager.sessionKeyManager.getSessionKey(argon2Salt, argon2Rounds);

    if (!key) {
      if (this.config.isUsingMasterPassword) {
        throw new Error('Session is locked. Call unlockSession(masterPassword) first.');
      } else {
        // If no master password, we might try to auto-derive once
        try {
          key = await this.encryptionManager.sessionKeyManager.deriveAndCacheDefaultKey(this.config.default, argon2Salt, argon2Rounds);
        } catch (err) {
          throw new Error('Failed to derive default key.');
        }
        
      }
    }
    return key;
  }

  _saveConfig() {
    this.storageService.setConf(this.config);
  }

  _getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Overwrites object fields with null to minimize memory footprint.
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
}