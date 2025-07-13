/**
 * @class StorageService
 * @classdesc
 * Provides methods to interact with browser localStorage for storing and retrieving
 * application configuration and related data.
 */
export class StorageService {
  /**
   * Retrieves the raw string value associated with the given key from localStorage.
   *
   * @param {string} key - The localStorage key to retrieve.
   * @returns {string|null} The stored value, or null if the key does not exist.
   */
  getItem(key) {
    const value = localStorage.getItem(key);
    return value !== null ? value : null;
  }

  /**
   * Stores a raw string value under the given key in localStorage.
   *
   * @param {string} key - The localStorage key under which to store the value.
   * @param {string} value - The string value to store.
   * @returns {void}
   */
  setItem(key, value) {
    localStorage.setItem(key, value);
  }

  /**
   * Retrieves and parses the encrypted main configuration object from localStorage.
   *
   * @returns {any} The parsed configuration object, or null if not set.
   * @throws {SyntaxError} If the stored JSON is invalid.
   */
  getConf() {
    const raw = this.getItem('encMainConf');
    return raw !== null ? JSON.parse(raw) : null;
  }

  /**
   * Serializes and stores the main configuration object in localStorage.
   *
   * @param {any} value - The configuration object to store.
   * @returns {void}
   */
  setConf(value) {
    localStorage.setItem('encMainConf', JSON.stringify(value));
  }

  /**
   * Removes all encryption-related data entries from localStorage,
   * including configuration and UI state.
   *
   * @returns {void}
   */
  deleteAllData() {
    localStorage.removeItem('encMainConf');
    localStorage.removeItem('encInfoHidden');
    localStorage.removeItem('__ENC_UI_CONFIG__');
  }
}