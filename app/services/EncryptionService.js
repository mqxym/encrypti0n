import { AESGCMEncryption } from '../algorithms/AESGCMEncryption.js';
import { AESCTREncryption } from '../algorithms/AESCTREncryption.js';
import { XOREncryption } from '../algorithms/XOREncryption.js';

/**
 * Bridges user choice -> correct encryption implementation -> final base64 result
 */
export class EncryptionService {
  constructor() {
    this.algorithms = {
      aesgcm: new AESGCMEncryption(),
      aesctr: new AESCTREncryption(),
      xor: new XOREncryption()
    };
  }

  getAlgorithm(algorithmName) {
    const algo = this.algorithms[algorithmName];
    if (!algo) {
      throw new Error("Unknown algorithm: " + algorithmName);
    }
    return algo;
  }

  /**
   * Encrypts data => returns single base64 string ([header + ciphertext], base64)
   * @param {string | Uint8Array} plainData
   * @param {string} passphrase
   * @param {string} algorithmName - 'aesgcm', 'aesctr', or 'xor'
   */
  async encryptData(plainData, passphrase, algorithmName) {
    const passphraseBytes = new TextEncoder().encode(passphrase);
    const algo = this.getAlgorithm(algorithmName);

    const { headerBytes, ciphertextBytes } = await algo.encrypt(plainData, passphraseBytes);
    const combined = new Uint8Array(headerBytes.length + ciphertextBytes.length);
    combined.set(headerBytes, 0);
    combined.set(ciphertextBytes, headerBytes.length);

    // Return as base64
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt base64 => parse out header + ciphertext => dispatch
   * @param {string} base64Cipher
   * @param {string} passphrase
   * @returns {string} - plain text if it was UTF-8
   */
  async decryptData(base64Cipher, passphrase) {
    const combined = new Uint8Array([...atob(base64Cipher)].map(c => c.charCodeAt(0)));
    const algoFlag = combined[0];
    let algorithmName;
    let headerLen = 1;

    switch (algoFlag) {
      case 0x01: // AES-GCM
        algorithmName = 'aesgcm';
        headerLen = 1 + 16 + 12; // 29
        break;
      case 0x02: // AES-CTR
        algorithmName = 'aesctr';
        headerLen = 1 + 16 + 16; // 33
        break;
      case 0x03: // XOR
        algorithmName = 'xor';
        headerLen = 1;
        break;
      default:
        throw new Error("Unknown or missing algorithm flag: " + algoFlag);
    }

    const headerBytes = combined.slice(0, headerLen);
    const ciphertextBytes = combined.slice(headerLen);

    const passphraseBytes = new TextEncoder().encode(passphrase);
    const algo = this.getAlgorithm(algorithmName);
    const plainBytes = await algo.decrypt(ciphertextBytes, passphraseBytes, headerBytes);

    // Convert bytes to string (UTF-8)
    return new TextDecoder().decode(plainBytes);
  }

  async isEncrypted (data) {
    try {
      const combined = new Uint8Array([...atob(data)].map(c => c.charCodeAt(0)));
      const algoFlag = combined[0];

      switch (algoFlag) {
        case 0x01: // AES-GCM
          return true;
        case 0x02: // AES-CTR
          return true;
        case 0x03: // XOR
          return true;
        default:
          return false;
      }
    } catch (err ) {
      return false;
      
    }
  }
}