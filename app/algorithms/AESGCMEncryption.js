import { IEncryptionAlgorithm } from '../interfaces/IEncryptionAlgorithm.js';

export class AESGCMEncryption extends IEncryptionAlgorithm {
  constructor() {
    super();
    this.keyLengthBits = 256;
    this.ivLengthBytes = 12;
    this.iterations = 5000042;
    this.hashAlgo = 'SHA-256';
  }

  async deriveKey(passphraseBytes, saltBytes) {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passphraseBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: this.iterations,
        hash: this.hashAlgo
      },
      baseKey,
      { name: 'AES-GCM', length: this.keyLengthBits },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * @param {Uint8Array | string} plainData
   * @param {Uint8Array} keyMaterial
   */
  async encrypt(plainData, keyMaterial) {
    const plainBytes = (plainData instanceof Uint8Array)
      ? plainData
      : new TextEncoder().encode(plainData);

    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await this.deriveKey(keyMaterial, saltBytes);
    const ivBytes = crypto.getRandomValues(new Uint8Array(this.ivLengthBytes));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBytes },
      derivedKey,
      plainBytes
    );
    const ciphertextBytes = new Uint8Array(ciphertext);

    // Build header (1-byte flag + 16 bytes salt + 12 bytes IV = 29 bytes total)
    const headerBytes = new Uint8Array(1 + saltBytes.length + ivBytes.length);
    headerBytes[0] = 0x01; // to identify AES-GCM
    headerBytes.set(saltBytes, 1);
    headerBytes.set(ivBytes, 1 + saltBytes.length);

    return { headerBytes, ciphertextBytes };
  }

  /**
   * @param {Uint8Array} ciphertextBytes
   * @param {Uint8Array} keyMaterial
   * @param {Uint8Array} headerBytes
   */
  async decrypt(ciphertextBytes, keyMaterial, headerBytes) {
    // parse header
    const saltBytes = headerBytes.slice(1, 17);
    const ivBytes = headerBytes.slice(17);

    const derivedKey = await this.deriveKey(keyMaterial, saltBytes);
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      derivedKey,
      ciphertextBytes
    );
    return new Uint8Array(plainBuffer);
  }
}