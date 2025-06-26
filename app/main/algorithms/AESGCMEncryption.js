import { IEncryptionAlgorithm } from '../interfaces/IEncryptionAlgorithm.js';
import { deriveKey } from './Argon2Key/Argon2KeyDerivation.js';
import { AESGCMConstants } from '../constants/constants.js';

/**
 * @class AESGCMEncryption
 * @extends IEncryptionAlgorithm
 * @classdesc
 * Concrete implementation of the AES-GCM encryption algorithm.
 * Uses Argon2 for key derivation and Web Crypto API for AES-GCM operations.
 */
export class AESGCMEncryption extends IEncryptionAlgorithm {
  /**
   * Constructs a new AESGCMEncryption instance.
   * Initializes constants for key and IV lengths from AESGCMConstants.
   */
  constructor() {
    super();
  }

  /**
   * Initializes this instance by deriving an AES key from the given key material.
   *
   * @async
   * @override
   * @param {Uint8Array} keyMaterial - The passphrase or raw key material.
   * @param {number} saltLength - Number of bytes for salt generation when not provided.
   * @param {number} iterations - Number of Argon2 iterations to perform.
   * @param {Uint8Array} [providedSalt] - Optional salt to reuse during decryption.
   * @returns {Promise<Uint8Array>} A promise resolving to the salt used for key derivation.
   */
  async initialize(keyMaterial, saltLength, iterations, providedSalt) {
    const salt = typeof providedSalt !== 'undefined'
      ? providedSalt
      : crypto.getRandomValues(new Uint8Array(saltLength));
    this.key = await deriveKey(keyMaterial, salt, iterations);
    return salt;
  }

  /**
   * Encrypts the provided plaintext using AES-GCM.
   *
   * @async
   * @override
   * @param {Uint8Array|string} plaintext - The data to encrypt, as bytes or UTF-8 string.
   * @returns {Promise<Uint8Array>} A promise resolving to the concatenation of IV and ciphertext.
   */
  async encryptData(plaintext) {
    const plainBytes = plaintext instanceof Uint8Array
      ? plaintext
      : new TextEncoder().encode(plaintext);
    return this.encryptChunk(plainBytes);
  }

  /**
   * Generates a fresh IV and encrypts a chunk of data with AES-GCM.
   *
   * @async
   * @param {Uint8Array} dataChunk - The raw bytes to encrypt.
   * @returns {Promise<Uint8Array>} A promise resolving to IV concatenated with ciphertext bytes.
   */
  async encryptChunk(dataChunk) {
    const iv = crypto.getRandomValues(new Uint8Array(AESGCMConstants.IV_LENGTH));
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      this.key,
      dataChunk
    );
    const ivAndCipher = new Uint8Array(iv.byteLength + cipherBuffer.byteLength);
    ivAndCipher.set(iv, 0);
    ivAndCipher.set(new Uint8Array(cipherBuffer), iv.byteLength);
    return ivAndCipher;
  }

  /**
   * Decrypts the provided cipher data (including IV) using AES-GCM.
   *
   * @async
   * @override
   * @param {Uint8Array} cipherWithIv - Byte array containing IV followed by ciphertext.
   * @returns {Promise<Uint8Array>} A promise resolving to the decrypted plaintext bytes.
   */
  async decryptData(cipherWithIv) {
    const plainBuffer = await this.decryptChunk(cipherWithIv);
    return new Uint8Array(plainBuffer);
  }

  /**
   * Extracts the IV from the data chunk and decrypts the ciphertext.
   *
   * @async
   * @param {Uint8Array} dataChunk - Byte array containing IV and ciphertext.
   * @returns {Promise<ArrayBuffer>} A promise resolving to the decrypted data buffer.
   */
  async decryptChunk(dataChunk) {
    const data = new Uint8Array(dataChunk);
    const iv = data.slice(0, AESGCMConstants.IV_LENGTH);
    const ciphertext = data.slice(AESGCMConstants.IV_LENGTH);
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      this.key,
      ciphertext
    );
  }
}