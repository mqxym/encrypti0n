import { SessionKeyManager } from './SessionKeyManager.js';
import { DeviceKeyProvider } from './DeviceKeyProvider.js';
import {
  arrayBufferToBase64,
  base64ToUint8Array
} from '../../utils/base64.js';
import { AESGCMConstants, ConfigManagerConstants } from '../../constants/constants.js';

/**
 * @class ApplicationEncryptionManager
 * @classdesc
 * AES-GCM encrypt/decrypt helpers plus device-bound key provisioning.
 */
export class ApplicationEncryptionManager {
  /**
   * Initializes the ApplicationEncryptionManager with a SessionKeyManager.
   */
  constructor() {
    /** @public {SessionKeyManager} */
    this.sessionKeyManager = new SessionKeyManager();
  }

  // -----------------------------
  // KEK Provisioning (Password-less)
  // -----------------------------

  /**
   * Retrieves a device-scoped key encryption key (KEK) bound to the origin.
   *
   * @async
   * @returns {Promise<CryptoKey>} The device-bound KEK.
   */
  async getDeviceKey() {
    return await DeviceKeyProvider.getKey();
  }

  /**
   * Generates a new data encryption key (DEK) for AES-GCM operations.
   *
   * @async
   * @returns {Promise<CryptoKey>} The newly created DEK.
   */
  async createDek() {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );
  }

  // -----------------------------
  // Data Encryption Helpers
  // -----------------------------

  /**
   * Encrypts a JavaScript object using AES-GCM.
   *
   * @async
   * @param {CryptoKey} key - The AES-GCM key to use.
   * @param {Object} plainData - The data object to encrypt.
   * @returns {Promise<{ iv: string, ciphertext: string }>}
   *   An object containing base64-encoded IV and ciphertext.
   */
  async encryptData(key, plainData) {
    const iv = crypto.getRandomValues(new Uint8Array(AESGCMConstants.IV_LENGTH));
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(JSON.stringify(plainData));
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dataBytes);

    return {
      iv: arrayBufferToBase64(iv),
      ciphertext: arrayBufferToBase64(buf)
    };
  }

  /**
   * Decrypts data previously encrypted with {@link encryptData}.
   *
   * @async
   * @param {CryptoKey} key - The AES-GCM key to use for decryption.
   * @param {string} ivBase64 - Base64-encoded initialization vector.
   * @param {string} ctBase64 - Base64-encoded ciphertext.
   * @returns {Promise<Object>} The decrypted JavaScript object.
   */
  async decryptData(key, ivBase64, ctBase64) {
    const iv = base64ToUint8Array(ivBase64);
    const ct = base64ToUint8Array(ctBase64);
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(buf));
  }

  // -----------------------------
  // DEK Wrapping / Unwrapping
  // -----------------------------

  /**
   * Wraps (encrypts) the DEK using a KEK.
   *
   * @async
   * @param {CryptoKey} dek - The data encryption key to wrap.
   * @param {CryptoKey} kek - The key encryption key to use.
   * @returns {Promise<{ ivWrap: string, wrappedKey: string }>}
   *   An object containing base64-encoded IV and wrapped DEK.
   */
  async wrapDek(dek, kek) {
    const iv = crypto.getRandomValues(new Uint8Array(AESGCMConstants.IV_LENGTH));
    const wrappedBuf = await crypto.subtle.wrapKey(
      'raw',
      dek,
      kek,
      { name: 'AES-GCM', iv }
    );

    return {
      ivWrap: arrayBufferToBase64(iv),
      wrappedKey: arrayBufferToBase64(wrappedBuf)
    };
  }

  /**
   * Unwraps (decrypts) the DEK using a KEK for normal encrypt/decrypt use.
   *
   * @async
   * @param {string} ivBase64 - Base64-encoded IV used during wrapping.
   * @param {string} wrappedBase64 - Base64-encoded wrapped DEK.
   * @param {CryptoKey} kek - The key encryption key to use.
   * @returns {Promise<CryptoKey>} The unwrapped data encryption key.
   */
  async unwrapDek(ivBase64, wrappedBase64, kek) {
    const ivBytes = base64ToUint8Array(ivBase64);
    const wrapped = base64ToUint8Array(wrappedBase64);

    return await crypto.subtle.unwrapKey(
      'raw',
      wrapped,
      kek,
      { name: 'AES-GCM', iv: ivBytes },
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Unwraps (decrypts) the DEK using a KEK for key-wrapping use (short-lived extractable).
   *
   * @async
   * @param {string} ivBase64 - Base64-encoded IV used during wrapping.
   * @param {string} wrappedBase64 - Base64-encoded wrapped DEK.
   * @param {CryptoKey} kek - The key encryption key to use.
   * @returns {Promise<CryptoKey>} The unwrapped data encryption key with wrapKey permission.
   */
  async unwrapDekForWrapping(ivBase64, wrappedBase64, kek) {
    const ivBytes = base64ToUint8Array(ivBase64);
    const wrapped = base64ToUint8Array(wrappedBase64);

    return await crypto.subtle.unwrapKey(
      'raw',
      wrapped,
      kek,
      { name: 'AES-GCM', iv: ivBytes },
      { name: 'AES-GCM', length: 256 },
      true,
      ['wrapKey', 'encrypt', 'decrypt', 'unwrapKey']
    );
  }

  // -----------------------------
  // Utility Helpers
  // -----------------------------

  /**
   * Generates a random salt for Argon2 in base64 encoding.
   *
   * @returns {string} Base64-encoded random salt.
   */
  generateRandomSalt() {
    const salt = new Uint8Array(ConfigManagerConstants.ARGON2_SALT_LENGTH);
    crypto.getRandomValues(salt);
    return arrayBufferToBase64(salt);
  }
}