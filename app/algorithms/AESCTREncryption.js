import { IEncryptionAlgorithm } from '../interfaces/IEncryptionAlgorithm.js';

export class AESCTREncryption extends IEncryptionAlgorithm {
  constructor() {
    super();
    this.keyLengthBits = 128;
    this.ivLengthBytes = 16;
    this.iterations = 50000;
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
      { name: 'AES-CTR', length: this.keyLengthBits },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(plainData, keyMaterial) {
    const plainBytes = (plainData instanceof Uint8Array)
      ? plainData
      : new TextEncoder().encode(plainData);

    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await this.deriveKey(keyMaterial, saltBytes);

    const ivBytes = crypto.getRandomValues(new Uint8Array(this.ivLengthBytes));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-CTR',
        counter: ivBytes,
        length: 64
      },
      derivedKey,
      plainBytes
    );

    const ciphertextBytes = new Uint8Array(ciphertext);

    // build header (1 byte + 16 salt + 16 iv = 33)
    const headerBytes = new Uint8Array(1 + saltBytes.length + ivBytes.length);
    headerBytes[0] = 0x02; // to identify AES-CTR
    headerBytes.set(saltBytes, 1);
    headerBytes.set(ivBytes, 1 + saltBytes.length);

    return { headerBytes, ciphertextBytes };
  }

  async decrypt(ciphertextBytes, keyMaterial, headerBytes) {
    const saltBytes = headerBytes.slice(1, 17);
    const ivBytes = headerBytes.slice(17);

    const derivedKey = await this.deriveKey(keyMaterial, saltBytes);

    const plainBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-CTR',
        counter: ivBytes,
        length: 64
      },
      derivedKey,
      ciphertextBytes
    );

    return new Uint8Array(plainBuffer);
  }
}