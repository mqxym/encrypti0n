import { IEncryptionAlgorithm } from '../interfaces/IEncryptionAlgorithm.js';

/**
 * AESGCMEncryption implements the AES-GCM encryption/decryption algorithm.
 * It extends the IEncryptionAlgorithm interface with concrete implementations.
 */
export class AESGCMEncryption extends IEncryptionAlgorithm {
  /**
   * Constructs an instance of AESGCMEncryption.
   * Sets key length, IV length, and hash algorithm.
   */
  constructor() {
    super();
    this.KEY_LENGTH_BITS = 256;
    this.IV_LENGTH_BYTES = 12;
    this.HASH_ALGORITHM = 'SHA-256';
  }

  /**
   * Initializes the AES-GCM encryption instance by deriving the encryption key.
   * @param {Uint8Array} keyMaterial - The passphrase or key material.
   * @param {number} saltLength - The length of the salt in bytes.
   * @param {number} iterations - Number of PBKDF2 iterations.
   * @param {Uint8Array} [providedSalt] - Optional salt (used during decryption).
   * @returns {Promise<Uint8Array>} The salt used in key derivation.
   */
  async initialize(keyMaterial, saltLength, iterations, providedSalt) {
    const salt = typeof providedSalt !== 'undefined'
      ? providedSalt
      : crypto.getRandomValues(new Uint8Array(saltLength));
    this.key = await this.deriveKey(keyMaterial, salt, iterations);
    return salt;
  }

  /**
   * Derives an AES-GCM key using PBKDF2.
   * @param {Uint8Array} keyMaterial - The passphrase bytes.
   * @param {Uint8Array} salt - The salt bytes.
   * @param {number} iterations - The number of PBKDF2 iterations.
   * @returns {Promise<CryptoKey>} The derived CryptoKey.
   */
  async deriveKey(keyMaterial, salt, iterations) {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: this.HASH_ALGORITHM
      },
      baseKey,
      { name: 'AES-GCM', length: this.KEY_LENGTH_BITS },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts the provided plaintext data.
   * @param {Uint8Array|string} plaintext - The data to encrypt.
   * @returns {Promise<Uint8Array>} The IV concatenated with the ciphertext.
   */
  async encryptData(plaintext) {
    const plainBytes = plaintext instanceof Uint8Array
      ? plaintext
      : new TextEncoder().encode(plaintext);
    return this.encryptChunk(plainBytes);
  }

  /**
   * Encrypts a data chunk by generating a fresh IV and encrypting with AES-GCM.
   * @param {Uint8Array} dataChunk - The data chunk to encrypt.
   * @returns {Promise<Uint8Array>} The concatenation of the IV and the ciphertext.
   */
  async encryptChunk(dataChunk) {
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH_BYTES));
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
   * Decrypts the ciphertext (which includes the IV) and returns the plaintext bytes.
   * @param {Uint8Array} cipherWithIv - The data containing the IV and ciphertext.
   * @returns {Promise<Uint8Array>} The decrypted plaintext bytes.
   */
  async decryptData(cipherWithIv) {
    const plainBuffer = await this.decryptChunk(cipherWithIv);
    return new Uint8Array(plainBuffer);
  }

  /**
   * Decrypts a data chunk by extracting the IV and decrypting the ciphertext.
   * @param {Uint8Array} dataChunk - The data chunk containing the IV and ciphertext.
   * @returns {Promise<ArrayBuffer>} The decrypted data.
   */
  async decryptChunk(dataChunk) {
    const data = new Uint8Array(dataChunk);
    const iv = data.slice(0, this.IV_LENGTH_BYTES);
    const ciphertext = data.slice(this.IV_LENGTH_BYTES);
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      this.key,
      ciphertext
    );
  }
}