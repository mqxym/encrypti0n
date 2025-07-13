/**
 * @class DeviceKeyProvider
 * @classdesc
 * Persists a non-extractable AES-GCM key in IndexedDB and returns it.
 * The key never leaves the browser, providing a secure KEK for password-less mode.
 */
export class DeviceKeyProvider {
  /** @static {string} IndexedDB database name */
  static DB_NAME = 'ENC_APP_KEYS';
  /** @static {string} Object store name within the IndexedDB */
  static STORE = 'keys';
  /** @static {string} Key identifier within the object store */
  static ID = 'deviceKey';

  /**
   * Retrieves the device-bound key encryption key (KEK) from IndexedDB,
   * generating and storing a new one if it does not already exist.
   *
   * @async
   * @static
   * @returns {Promise<CryptoKey>} The non-extractable AES-GCM CryptoKey.
   * @throws {Error} If there is an IndexedDB or crypto failure.
   */
  static async getKey() {
    const db = await DeviceKeyProvider._openDB();

    // Try to read existing key
    const existing = await new Promise((resolve, reject) => {
      const tx = db.transaction(DeviceKeyProvider.STORE, 'readonly');
      const req = tx.objectStore(DeviceKeyProvider.STORE).get(DeviceKeyProvider.ID);
      req.onsuccess = () => resolve(req.result && req.result.key);
      req.onerror = () => reject(req.error);
    });
    if (existing) {
      db.close();
      return existing;
    }

    // Generate a new non-extractable AES-GCM key for wrapping/unwrapping
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey']
    );

    // Store the new key in its own transaction
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DeviceKeyProvider.STORE, 'readwrite');
      const store = tx.objectStore(DeviceKeyProvider.STORE);
      const putReq = store.put({ id: DeviceKeyProvider.ID, key });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });

    db.close();
    return key;
  }

  /**
   * Opens (or creates) the IndexedDB database and object store
   * for storing the device-bound key.
   *
   * @private
   * @static
   * @returns {Promise<IDBDatabase>} A promise that resolves to the open database.
   */
  static _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DeviceKeyProvider.DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(DeviceKeyProvider.STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}