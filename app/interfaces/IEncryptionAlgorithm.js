/**
 * IEncryptionAlgorithm.js
 * 
 * Defines an interface for any encryption class:
 * - encrypt(plainData, keyMaterial)
 * - decrypt(cipherBytes, keyMaterial, headerBytes)
 */
export class IEncryptionAlgorithm {
    /**
     * @param {Uint8Array | string} plainData
     * @param {Uint8Array} keyMaterial (a passphrase, etc.)
     * @returns {{ headerBytes: Uint8Array, ciphertextBytes: Uint8Array }}
     */
    async encrypt(plainData, keyMaterial) {
      throw new Error("Not implemented.");
    }
  
    /**
     * @param {Uint8Array} ciphertextBytes
     * @param {Uint8Array} keyMaterial
     * @param {Uint8Array} headerBytes
     * @returns {Uint8Array} - decrypted data as bytes
     */
    async decrypt(ciphertextBytes, keyMaterial, headerBytes) {
      throw new Error("Not implemented.");
    }
  }