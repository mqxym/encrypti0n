import { IEncryptionAlgorithm } from '../interfaces/IEncryptionAlgorithm.js';

/**
 * A simplistic XOR example. Not recommended for real security.
 */
export class XOREncryption extends IEncryptionAlgorithm {
  constructor() {
    super();
  }

  _xorArrays(dataBytes, keyBytes) {
    const result = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return result;
  }

  async encrypt(plainData, keyMaterial) {
    const plainBytes = (plainData instanceof Uint8Array)
      ? plainData
      : new TextEncoder().encode(plainData);

    const ciphertextBytes = this._xorArrays(plainBytes, keyMaterial);

    // Minimal header: 1 byte => 0x03
    const headerBytes = new Uint8Array([0x03]);
    return { headerBytes, ciphertextBytes };
  }

  async decrypt(ciphertextBytes, keyMaterial, headerBytes) {
    // Just XOR again
    return this._xorArrays(ciphertextBytes, keyMaterial);
  }
}