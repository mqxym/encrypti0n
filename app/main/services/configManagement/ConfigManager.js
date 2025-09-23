import { ConfigManagerConstants } from '../../constants/constants.js';
import { returnDecoded, returnEncoded } from '../../utils/dataEncode.js';
import { StorageService } from '../StorageService.js';
import { SecureLocalStorage } from '../../../../assets/libs/secure-local-storage/sls.browser.min.js';
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
    this.storageService = new StorageService();
  }

  initSls() {
    /** @private {SecureLocalStorage} */

    if (this.sls !== undefined) return;

    this.sls = new SecureLocalStorage({
      storageKey: ConfigManagerConstants.LS_KEY_NAME,
      idbConfig: {
        dbName: ConfigManagerConstants.IDB_DB_NAME,
        storeName: ConfigManagerConstants.IDB_STORE_NAME,
        keyId: ConfigManagerConstants.IDB_KEY_ID
      }
    });
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
    instance.initSls();

    try {
      await instance.readOptions();
    } catch (e) {
      await instance._initFreshConfig(); // init fresh config
    }

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

    const initialData = {
      slots: {
        1: { name: 'Slot 1', value: null },
        2: { name: 'Slot 2', value: null },
        3: { name: 'Slot 3', value: null },
        4: { name: 'Slot 4', value: null },
        5: { name: 'Slot 5', value: null },
      },
      Options: {
        saltDifficulty: 'high',
        roundDifficulty: 'middle',
      },
    };

    await this.sls.setData(initialData);
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
    await this.sls.unlock(masterPassword);
  }

  /**
   * Locks the session by clearing the in-memory session key and DEK.
   *
   * @returns {void}
   */
  lockSession() {
    this.sls.lock();
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
    try {
      const data = await this.sls.getData();
      return data;
    } catch (e) {
      return { slots: {}, Options: {} };
    }
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
    await this.sls.setData(newData);
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
    const view = await this.getDecryptedData();
    const data = this._deepCopy(view);
    if (!data.slots[id]) {
      throw new Error(`Slot ${id} does not exist`);
    }
    const value = data.slots[id].value;
    view.clear();
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
    const view = await this.getDecryptedData();
    try {
      const data = this._deepCopy(view);
      if (!data.slots[id]) {
        data.slots[id] = { name: `slot${id}`, value: null };
      }
      data.slots[id].value = newValue;
      await this.setDecryptedData(data);
    } finally {
      view.clear();
    }
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
    const view = await this.getDecryptedData();
    try {
      const data = this._deepCopy(view);
      if (!data.slots[id]) {
        data.slots[id] = { name: newName, value: null };
      }
      data.slots[id].name = newName;
      await this.setDecryptedData(data);
    } finally {
      view.clear();
    }
  }

  /**
   * Reads all slot names from the decrypted data.
   *
   * @async
   * @returns {Promise<Object.<string, string>>} Map of slot IDs to names.
   */
  async readSlotNames() {
    const view = await this.getDecryptedData();
    const data = this._deepCopy(view);
    const result = {};
    for (const key in data.slots) {
      if (data.slots.hasOwnProperty(key)) {
        result[key] = data.slots[key].name;
      }
    }
    view.clear();
    return result;
  }

  /**
   * Deletes a slot by its ID.
   *
   * @async
   * @param {string|number} id - Slot identifier to delete.
   * @returns {Promise<void>}
   * @throws {Error} If the slot does not exist or session is locked.
   */
  async deleteSlot(id) {
    const view = await this.getDecryptedData();
    try {
      const data = this._deepCopy(view);
      if (!data.slots[id]) {
        view.clear();
        throw new Error(`Slot ${id} does not exist`);
      }
      delete data.slots[id];
      await this.setDecryptedData(data);
    } finally {
      view.clear();
    }
  }

  /**
   * Adds a new slot with default values.
   *
   * @async
   * @returns {Promise<number>} The index of the newly added slot.
   * @throws {Error} If session is locked.
   */
  async addSlot() {
    let newIndex = 1;
    const view = await this.getDecryptedData();
    try {
      const data = this._deepCopy(view);
      let newIndex = 1;
      while (data.slots.hasOwnProperty(newIndex)) {
        newIndex++;
      }
      data.slots[newIndex] = { name: `Slot ${newIndex}`, value: null };
      await this.setDecryptedData(data);
      await this.setDecryptedData(data);
    } finally {
      view.clear();
    }
     return newIndex;
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
    const view = await this.getDecryptedData();
    try {
      const data = this._deepCopy(view);
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
      }
      await this.setDecryptedData(data);
    } finally {
      view.clear();
    }
  }

  /**
   * Reads the current Argon2 options from config.
   *
   * @async
   * @returns {Promise<{ saltDifficulty: string, roundDifficulty: string }>}
   * @throws {Error} If options are missing.
   */
  async readOptions() {
    const view = await this.getDecryptedData();
    const data = this._deepCopy(view);
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
   await this.sls.setMasterPassword(newMasterPassword);
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
    await this.sls.removeMasterPassword();
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
    this.sls.lock();
    await this.sls.clear();
    this.storageService.deleteAllData();
    await this._initFreshConfig();
  }

  /**
   * Checks if master-password mode is active.
   *
   * @returns {boolean} true if in master-password mode.
   */
  isUsingMasterPassword() {
    return this.sls.isUsingMasterPassword();
  }

  // -----------------------------
  // Import Export
  // -----------------------------

  /**
   * Exports the encrypted configuration protected with a password.
   *
   * @async
   * @param {string} exportPassword - Password to protect the export
   * @returns {Promise<Uint8Array>} Encoded and encrypted export
   * @throws {Error} If session is locked
   */
  async exportConfig(exportPassword) {
    if (
      (typeof exportPassword === undefined || exportPassword === '' || exportPassword === null) &&
      this.isUsingMasterPassword()
    ) {
      return returnEncoded(await this.sls.exportData());
    }

    if (typeof exportPassword === undefined || exportPassword === '') throw new Error('No Password set');

    // Return export as binary (buffer)
    const exportData = await this.sls.exportData(exportPassword);
    return await returnEncoded(exportData);
  }

  /**
   * Imports an encrypted configuration protected with a password.
   * When master password is used: unlock Session with master password
   * When export key is used: Re-Wrap with DeviceKey and unlock Session
   *
   * @async
   * @param {string} exportedConfig - Buffer encoded exported config
   * @param {string} exportPassword - Password used to protect the export (Master Password / Export Password)
   * @returns {Promise<void>}
   * @throws {Error} If import fails
   */
  async importConfig(exportedConfig, exportPassword) {
    try {
      const bundle = await returnDecoded(exportedConfig);

      const result = await this.sls.importData(bundle, exportPassword);

      const map = {
        masterPassword: 'storedWithMasterPassword',
        customExportPassword: 'storedWithDeviceKey',
      };

      return map[result];
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  _deepCopy(item) {
    return JSON.parse(JSON.stringify(item))
  }
}
