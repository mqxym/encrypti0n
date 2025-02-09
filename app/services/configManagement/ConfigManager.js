import { StorageService } from '../StorageService.js';
import { ApplicationEncryptionManager } from './ApplicationEncryptionManager.js';

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

    this.config = this.storageService.getConf();
    if (!this.config) {
      this._initNewConfig();
      this._saveConfig();
    }

    // If no master password is used, we can derive the default key right away for faster usage
    if (!this.config.isUsingMasterPassword) {
      // Derive the default key once. 
      this._deriveDefaultKeyOnStartup().catch(console.error);
    }
  }

  isUsingMasterPassword () {
    return this.config.isUsingMasterPassword;
  }

  // -----------------------------
  // Initial Configuration
  // -----------------------------
  async _initNewConfig() {
    const salt = this.encryptionManager.generateRandomSalt();
    const defaultKey = this.encryptionManager.generateRandomDefaultKey();
    const rounds = this._getRandomInt(1000, 2000);

    this.config = {
      isUsingMasterPassword: false,
      PKDF2Rounds: rounds,
      PKDF2Salt: salt,
      default: defaultKey,
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
        this.config.PKDF2Salt,
        this.config.PKDF2Rounds
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
      this.config.PKDF2Salt,
      this.config.PKDF2Rounds
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
   * then re-encrypts with new PBKDF2 parameters.
   */
  async setMasterPassword(newMasterPassword) {
    // 1. Decrypt current data with the existing session key
    const oldKey = await this._getSessionKeyOrThrow(); // If previously default or old master
    const plainData = await this.encryptionManager.decryptData(
      oldKey,
      this.config.data.iv,
      this.config.data.ciphertext
    );

    // 2. Update config with new salt & rounds
    const newSalt = this.encryptionManager.generateRandomSalt();
    const newRounds = this._getRandomInt(5000000, 5001000);
    this.config.isUsingMasterPassword = true;
    this.config.PKDF2Salt = newSalt;
    this.config.PKDF2Rounds = newRounds;
    this.config.default = '';

    // 3. Derive new key from the new master password, re-encrypt
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
    // 1. Decrypt with the current session key
    const oldKey = await this._getSessionKeyOrThrow();
    const plainData = await this.encryptionManager.decryptData(
      oldKey,
      this.config.data.iv,
      this.config.data.ciphertext
    );

    // 2. Switch to default-based encryption
    this.config.isUsingMasterPassword = false;
    this.config.PKDF2Salt = this.encryptionManager.generateRandomSalt();
    this.config.PKDF2Rounds = this._getRandomInt(1000, 2000);
    this.config.default = this.encryptionManager.generateRandomDefaultKey();

    // 3. Clear old session key, derive new default key, re-encrypt
    this.encryptionManager.sessionKeyManager.clearSessionKey();
    const newKey = await this.encryptionManager.sessionKeyManager.deriveAndCacheDefaultKey(
      this.config.default,
      this.config.PKDF2Salt,
      this.config.PKDF2Rounds
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
    const { PKDF2Salt, PKDF2Rounds } = this.config;
    let key = this.encryptionManager.sessionKeyManager.getSessionKey(PKDF2Salt, PKDF2Rounds);

    if (!key) {
      if (this.config.isUsingMasterPassword) {
        throw new Error('Session is locked. Call unlockSession(masterPassword) first.');
      } else {
        // If no master password, we might try to auto-derive once
        key = await this.encryptionManager.sessionKeyManager.deriveAndCacheDefaultKey(this.config.default, PKDF2Salt, PKDF2Rounds);
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