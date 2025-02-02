import { SessionKeyManager } from './SessionKeyManager.js';

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
        iv: this._arrayBufferToBase64(iv),
        ciphertext: this._arrayBufferToBase64(ciphertext)
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
      const iv = this._base64ToUint8Array(ivBase64);
      const ciphertext = this._base64ToUint8Array(ciphertextBase64);

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
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return this._arrayBufferToBase64(salt);
  }

  generateRandomDefaultKey(length = 24) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-';
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);

    return Array.from(randomBytes)
      .map(byte => chars[byte % chars.length])
      .join('');
  }

  // ------ Internal Helpers ------
  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

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