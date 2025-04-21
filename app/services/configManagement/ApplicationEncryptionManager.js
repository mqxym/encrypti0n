import { SessionKeyManager } from './SessionKeyManager.js';
import { base64ToUint8Array, arrayBufferToBase64 } from '../../utils/base64.js';
import { ConfigManagerConstants } from '../../constants/constants.js';

/**
 * ApplicationEncryptionManager
 *
 * - Provides encryption/decryption routines with AES-GCM.
 * - Also has helpers for generating random salt / default keys.
 */
export class ApplicationEncryptionManager {
  constructor() {
    this.sessionKeyManager = new SessionKeyManager();
  }

  /**
   * Encrypt an object with the provided AES-GCM key.
   */
  async encryptData(key, plainData) {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(JSON.stringify(plainData));

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBytes
      );

      return {
        iv: arrayBufferToBase64(iv),
        ciphertext: arrayBufferToBase64(ciphertext)
      };
    } catch (err) {
      throw new Error(`encryptData failed: ${err.message}`);
    }
  }

  /**
   * Decrypt an object using the AES-GCM key.
   */
  async decryptData(key, ivBase64, ciphertextBase64) {
    try {
      const iv = base64ToUint8Array(ivBase64);
      const ciphertext = base64ToUint8Array(ciphertextBase64);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decryptedBuffer));
    } catch (err) {
      throw new Error(`decryptData failed: ${err.message}`);
    }
  }

  generateRandomSalt() {
    const salt = new Uint8Array(ConfigManagerConstants.ARGON2_SALT_LENGTH);
    crypto.getRandomValues(salt);
    return arrayBufferToBase64(salt);
  }
}