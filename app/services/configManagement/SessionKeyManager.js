import { KeyDerivationManager } from './KeyDerivationManager.js';

/**
 * SessionKeyManager
 *
 * Holds a single CryptoKey in memory for fast AES-GCM usage.
 * Clears or regenerates that key if the master password changes or is removed.
 */
export class SessionKeyManager {
  constructor() {
    this.cachedKey = null; // Stores the derived CryptoKey
    this.cachedSalt = null; // Base64-encoded salt
    this.cachedRounds = null; // argon2 iteration count
    this.derivationManager = new KeyDerivationManager();
  }

  /**
   * Derive a new CryptoKey from a password and cache it in memory.
   * - The raw password is used here and then immediately discarded.
   *
   * @param {string} password
   * @param {string} saltBase64
   * @param {number} rounds
   * @returns {Promise<CryptoKey>}
   */
  async deriveAndCacheKey(password, saltBase64, rounds) {
    const saltBytes = this._base64ToUint8Array(saltBase64);

    // Derive the key (expensive argon2)
    const derivedKey = await this.derivationManager.deriveKey(password, saltBytes, rounds);

    // Cache the result
    this.cachedKey = derivedKey;
    this.cachedSalt = saltBase64;
    this.cachedRounds = rounds;

    return derivedKey;
  }

  /**
   * For a default (non-master) password scenario,
   * we can call this once at startup or whenever config changes.
   *
   * @param {string} defaultPassword - The random default pass from config
   * @param {string} saltBase64
   * @param {number} rounds
   * @returns {Promise<CryptoKey>}
   */
  async deriveAndCacheDefaultKey(defaultPassword, saltBase64, rounds) {
    return await this.deriveAndCacheKey(defaultPassword, saltBase64, rounds);
  }

  /**
   * Retrieve the cached CryptoKey if it matches the config salt & rounds.
   * If there's no key or mismatch, it indicates we must re-derive or "unlock."
   */
  getSessionKey(saltBase64, rounds) {
    if (this.cachedKey && this.cachedSalt === saltBase64 && this.cachedRounds === rounds) {
      return this.cachedKey;
    }
    // If mismatch or no key, we have no valid session key for this config
    return null;
  }

  /**
   * Clear the key from memory. Called when logging out or changing master password.
   */
  clearSessionKey() {
    this.cachedKey = null;
    this.cachedSalt = null;
    this.cachedRounds = null;
  }

  // ------- Helpers --------
  _base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
