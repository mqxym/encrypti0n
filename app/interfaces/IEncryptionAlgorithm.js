/**
 * IEncryptionAlgorithm defines the interface for encryption algorithms.
 * All concrete encryption classes should implement these methods.
 */
export class IEncryptionAlgorithm {
  /**
   * Encrypts the provided plaintext using the encryption key derived from key material.
   * @param {Uint8Array|string} plaintext - The data to encrypt.
   * @returns {Promise<{ header: Uint8Array, ciphertext: Uint8Array }>}
   * @throws Will throw an error if the method is not implemented.
   */
  async encrypt(plaintext) {
    throw new Error("Method 'encrypt' not implemented.");
  }

  /**
   * Decrypts the provided ciphertext using the encryption key derived from key material and header metadata.
   * @param {Uint8Array} ciphertext - The ciphertext to decrypt.
   * @param {Uint8Array} header - The header containing encryption metadata.
   * @returns {Promise<Uint8Array>} The decrypted data.
   * @throws Will throw an error if the method is not implemented.
   */
  async decrypt(ciphertext, header) {
    throw new Error("Method 'decrypt' not implemented.");
  }

  /**
   * Initializes the encryption algorithm by deriving the encryption key from the key material.
   * @param {Uint8Array} keyMaterial - The passphrase or key material.
   * @param {number} saltLength - The length of the salt in bytes.
   * @param {number} iterations - The number of argon2 iterations.
   * @param {Uint8Array} [providedSalt] - Optional salt bytes (used during decryption).
   * @returns {Promise<Uint8Array>} The salt used for key derivation.
   * @throws Will throw an error if the method is not implemented.
   */
  async initialize(keyMaterial, saltLength, iterations, providedSalt) {
    throw new Error("Method 'initialize' not implemented.");
  }
}