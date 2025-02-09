import { IEncryptionAlgorithm } from '../interfaces/IEncryptionAlgorithm.js';

export class AESGCMEncryption extends IEncryptionAlgorithm {
  constructor() {
    super();
    this.keyLengthBits = 256;
    this.ivLengthBytes = 12;
    this.hashAlgo = 'SHA-256';
    // Default difficulties: “middle” rounds (5M) and “high” salt (16 bytes)
    this.setRoundDifficulty("middle");
    this.setSaltDifficulty("high");
  }

  /**
   * Set the number of PBKDF2 iterations based on a difficulty string.
   * @param {"low"|"middle"|"high"} difficulty - 'low' (100k), 'middle' (5M), or 'high' (10M)
   */
  setRoundDifficulty(difficulty) {
    const mapping = { low: 100010, middle: 5000042, high: 10000666 };
    if (!(difficulty in mapping)) {
      throw new Error("Invalid round difficulty. Choose 'low', 'middle', or 'high'.");
    }
    this.iterations = mapping[difficulty];
    this.roundDifficulty = difficulty;
  }

  /**
   * Set the salt length based on a difficulty string.
   * @param {"low"|"high"} difficulty - 'low' for 12 bytes, 'high' for 16 bytes.
   */
  setSaltDifficulty(difficulty) {
    const mapping = { low: 12, high: 16 };
    if (!(difficulty in mapping)) {
      throw new Error("Invalid salt difficulty. Choose 'low' or 'high'.");
    }
    this.saltLengthBytes = mapping[difficulty];
    this.saltDifficulty = difficulty;
  }

  /**
   * Derives a key using PBKDF2.
   * An optional iterationsOverride can be provided (used during decryption).
   *
   * @param {Uint8Array} passphraseBytes
   * @param {Uint8Array} saltBytes
   * @param {number} [iterationsOverride]
   * @returns {Promise<CryptoKey>}
   */
  async deriveKey(passphraseBytes, saltBytes, iterationsOverride) {
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
        iterations: iterationsOverride !== undefined ? iterationsOverride : this.iterations,
        hash: this.hashAlgo
      },
      baseKey,
      { name: 'AES-GCM', length: this.keyLengthBits },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts the provided plain data.
   *
   * The header is built as:
   *   [0]      : Algorithm identifier (0x01)
   *   [1]      : Difficulty header byte (encodes round and salt difficulty)
   *   [2..N]   : Salt bytes (length depends on saltDifficulty)
   *   [N+1..]  : IV bytes (always 12 bytes)
   *
   * @param {Uint8Array|string} plainData
   * @param {Uint8Array} keyMaterial
   * @returns {Promise<{headerBytes: Uint8Array, ciphertextBytes: Uint8Array}>}
   */
  async encrypt(plainData, keyMaterial) {
    const plainBytes = plainData instanceof Uint8Array
      ? plainData
      : new TextEncoder().encode(plainData);

    // Generate a salt with the length determined by saltDifficulty.
    const saltBytes = crypto.getRandomValues(new Uint8Array(this.saltLengthBytes));
    const derivedKey = await this.deriveKey(keyMaterial, saltBytes);
    const ivBytes = crypto.getRandomValues(new Uint8Array(this.ivLengthBytes));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBytes },
      derivedKey,
      plainBytes
    );
    const ciphertextBytes = new Uint8Array(ciphertext);

    // Build header:
    // - 1st byte: Fixed identifier (0x01)
    // - 2nd byte: Difficulty header byte (bits layout below)
    //   * Bits 0-1: Round difficulty (00: low, 01: middle, 10: high)
    //   * Bit 2   : Salt difficulty (0: low (12 bytes), 1: high (16 bytes))
    // - Followed by salt and IV.
    const headerLength = 1 + 1 + this.saltLengthBytes + this.ivLengthBytes;
    const headerBytes = new Uint8Array(headerLength);
    headerBytes[0] = 0x01; // AES-GCM identifier

    const roundMapping = { low: 0b00, middle: 0b01, high: 0b10 };
    const saltMapping = { low: 0b0, high: 0b1 };
    const diffByte = (saltMapping[this.saltDifficulty] << 2) | roundMapping[this.roundDifficulty];
    headerBytes[1] = diffByte;

    headerBytes.set(saltBytes, 2);
    headerBytes.set(ivBytes, 2 + this.saltLengthBytes);

    return { headerBytes, ciphertextBytes };
  }

  /**
   * Decrypts the ciphertext using the provided key material and header.
   *
   * The header is parsed to extract:
   *   - The salt length (from the salt difficulty bit).
   *   - The round difficulty (which determines the iteration count).
   *
   * @param {Uint8Array} ciphertextBytes
   * @param {Uint8Array} keyMaterial
   * @param {Uint8Array} headerBytes
   * @returns {Promise<Uint8Array>} The decrypted plaintext bytes.
   */
  async decrypt(ciphertextBytes, keyMaterial, headerBytes) {
    if (headerBytes[0] !== 0x01) {
      throw new Error("Invalid header: unrecognized encryption algorithm identifier.");
    }

    const diffByte = headerBytes[1];
    const saltBit = (diffByte >> 2) & 0x01;
    const roundCode = diffByte & 0x03;

    // Determine salt length: 0 -> low (12 bytes), 1 -> high (16 bytes)
    const saltLength = saltBit === 0 ? 12 : 16;

    // Map round difficulty bits to iteration count.
    const roundMapping = {
      0b00: 100010,
      0b01: 5000042,
      0b10: 10000666
    };
    if (!(roundCode in roundMapping)) {
      throw new Error("Invalid round difficulty code in header.");
    }
    const iterationsFromHeader = roundMapping[roundCode];

    const saltBytes = headerBytes.slice(2, 2 + saltLength);
    const ivBytes = headerBytes.slice(2 + saltLength);

    const derivedKey = await this.deriveKey(keyMaterial, saltBytes, iterationsFromHeader);
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      derivedKey,
      ciphertextBytes
    );
    return new Uint8Array(plainBuffer);
  }
}