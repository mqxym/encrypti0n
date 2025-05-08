/**
 * @interface IEncryptionAlgorithm
 * @classdesc
 * Defines the contract for encryption algorithm implementations.
 * Implementations must support key derivation, encryption, and decryption
 * in a way that allows IV and salt handling to be consistent across
 * different algorithm types (e.g., AES-GCM).
 *
 * @example
 * // AESGCMEncryption extends this interface:
 * const alg = new AESGCMEncryption();
 * const salt = await alg.initialize(keyMaterial, 16, 3);
 * const cipher = await alg.encryptData("hello");
 * const plain = await alg.decryptData(cipher);
 */
export class IEncryptionAlgorithm {
  /**
   * Derives and sets up the encryption key.
   *
   * @async
   * @abstract
   * @param {Uint8Array} keyMaterial
   *   The raw key material or passphrase.
   * @param {number} saltLength
   *   Number of bytes for a newly generated salt when none is provided.
   * @param {number} iterations
   *   Number of Argon2 iterations (or equivalent) for key derivation.
   * @param {Uint8Array} [providedSalt]
   *   Optional salt to use for key derivation (important for decryption).
   * @returns {Promise<Uint8Array>}
   *   Resolves to the salt used for key derivation.
   * @throws {Error}
   *   If not implemented by subclass.
   */
  async initialize(keyMaterial, saltLength, iterations, providedSalt) {
    throw new Error("Method 'initialize' not implemented.");
  }

  /**
   * Encrypts plaintext into a byte array that includes any necessary header
   * metadata (IV, salt, etc.) for later decryption.
   *
   * @async
   * @abstract
   * @param {Uint8Array|string} plaintext
   *   The data to encrypt, either as raw bytes or a UTF-8 string.
   * @returns {Promise<Uint8Array>}
   *   Resolves to a concatenation of header metadata and ciphertext.
   * @throws {Error}
   *   If not implemented by subclass.
   */
  async encryptData(plaintext) {
    throw new Error("Method 'encryptData' not implemented.");
  }

  /**
   * Decrypts a byte array containing header metadata and ciphertext,
   * returning the original plaintext bytes.
   *
   * @async
   * @abstract
   * @param {Uint8Array} ciphertextWithIv
   *   Byte array produced by `encryptData`, containing IV/salt header plus ciphertext.
   * @returns {Promise<Uint8Array>}
   *   Resolves to the decrypted plaintext bytes.
   * @throws {Error}
   *   If not implemented by subclass.
   */
  async decryptData(ciphertextWithIv) {
    throw new Error("Method 'decryptData' not implemented.");
  }
}