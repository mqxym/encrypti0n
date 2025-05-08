import { deriveKey, deriveKek } from "../../algorithms/Argon2Key/Argon2KeyDerivation.js";
import { base64ToUint8Array } from "../../utils/base64.js";

/**
 * @class SessionKeyManager
 * @classdesc
 * Caches a single CryptoKey in memory for AES-GCM operations.  
 * Supports deriving from a master or default password and clearing on logout or password change.
 */
export class SessionKeyManager {
  constructor() {
    /** @private @type {CryptoKey|null} */
    this.cachedKey = null;
    /** @private @type {string|null} Base64-encoded salt used for derivation */
    this.cachedSalt = null;
    /** @private @type {number|null} Argon2 iteration count used for derivation */
    this.cachedRounds = null;
  }

  /**
   * Derives a new CryptoKey from the given password, salt, and rounds,
   * caches it for future use, and discards the raw password immediately.
   *
   * @async
   * @param {string} password - The master or default password string.
   * @param {string} saltBase64 - Salt encoded as a Base64 string.
   * @param {number} rounds - Argon2 iteration count for key derivation.
   * @returns {Promise<CryptoKey>} The newly derived non-extractable CryptoKey.
   */
  async deriveAndCacheKey(password, saltBase64, rounds) {
    const saltBytes = base64ToUint8Array(saltBase64);

    const derivedKey = await deriveKek(password, saltBytes, rounds);

    this.cachedKey = derivedKey;
    this.cachedSalt = saltBase64;
    this.cachedRounds = rounds;

    return derivedKey;
  }

  /**
   * Derives a new CryptoKey from the given password, salt, and rounds,
   * caches it for future use, and discards the raw password immediately.
   *
   * @async
   * @param {string} password - The master or default password string.
   * @param {string} saltBase64 - Salt encoded as a Base64 string.
   * @param {number} rounds - Argon2 iteration count for key derivation.
   * @param {number|null} [mem_cost=null] - Optional Argon2 memory cost (kiB).
   * @returns {Promise<CryptoKey>} The newly derived non-extractable CryptoKey.
   */
    async deriveAndCacheKeyV1(password, saltBase64, rounds, mem_cost = null) {
      const saltBytes = base64ToUint8Array(saltBase64);
  
      const derivedKey = await deriveKey(password, saltBytes, rounds, mem_cost);
  
      this.cachedKey = derivedKey;
      this.cachedSalt = saltBase64;
      this.cachedRounds = rounds;
  
      return derivedKey;
    }

  /**
   * Derives and caches a CryptoKey for default (non-master) password scenarios.
   *
   * @async
   * @param {string} defaultPassword - The randomly generated default password.
   * @param {string} saltBase64 - Salt encoded as a Base64 string.
   * @param {number} rounds - Argon2 iteration count for key derivation.
   * @param {number|null} [mem_cost=null] - Optional Argon2 memory cost (kiB).
   * @returns {Promise<CryptoKey>} The derived default CryptoKey.
   */
  async deriveAndCacheDefaultKeyV1(defaultPassword, saltBase64, rounds, mem_cost = null) {
    return this.deriveAndCacheKeyV1(defaultPassword, saltBase64, rounds, mem_cost);
  }

  /**
   * Retrieves the cached CryptoKey if it matches the provided salt and rounds.
   *
   * @param {string} saltBase64 - Salt encoded as a Base64 string.
   * @param {number} rounds - Argon2 iteration count used for derivation.
   * @returns {CryptoKey|null} The cached CryptoKey, or null if not found or mismatched.
   */
  getSessionKey(saltBase64, rounds) {
    if (
      this.cachedKey &&
      this.cachedSalt === saltBase64 &&
      this.cachedRounds === rounds
    ) {
      return this.cachedKey;
    }
    return null;
  }

  /**
   * Clears any cached CryptoKey and its derivation parameters from memory.
   *
   * @returns {void}
   */
  clearSessionKey() {
    this.cachedKey = null;
    this.cachedSalt = null;
    this.cachedRounds = null;
  }
}