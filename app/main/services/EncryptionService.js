import { AESGCMEncryption } from '../algorithms/AESGCMEncryption.js';
import { StreamProcessor } from '../algorithms/AESGCMStream/StreamProcessor.js';
import { EncryptionServiceConstants } from '../constants/constants.js';

/**
 * @class EncryptionService
 * @classdesc
 * Bridges user-facing encryption/decryption calls with the appropriate algorithm implementations.
 * Manages header encoding/decoding, Argon2 key-derivation difficulty settings, salt lengths,
 * and handles both text and file encryption workflows.
 */
export class EncryptionService {
  /**
   * Constructs the EncryptionService with supported algorithms and default difficulty settings.
   */
  constructor() {
    /**
     * @private
     * @type {Object.<string, IEncryptionAlgorithm>}
     */
    this.algorithms = {
      aesgcm: new AESGCMEncryption(),
    };

    /**
     * @private
     * @type {{ low: number, middle: number, high: number }}
     */
    this.argon2IterationMapping = {
      low: EncryptionServiceConstants.LOW_ITERATION_COUNT,
      middle: EncryptionServiceConstants.MIDDLE_ITERATION_COUNT,
      high: EncryptionServiceConstants.HIGH_ITERATION_COUNT,
    };

    /**
     * @private
     * @type {{ low: number, high: number }}
     */
    this.saltLengthMapping = {
      low: EncryptionServiceConstants.LOW_SALT_LENGTH_BYTES,
      high: EncryptionServiceConstants.HIGH_SALT_LENGTH_BYTES,
    };

    // Initialize with default difficulties
    this.setargon2Difficulty('middle');
    this.setSaltLengthDifficulty('high');
  }

  /**
   * Retrieves the algorithm instance for the specified name.
   *
   * @param {string} algorithmName - One of the keys in `this.algorithms`.
   * @returns {IEncryptionAlgorithm} The matching algorithm instance.
   * @throws {Error} If the algorithmName is not registered.
   */
  getAlgorithm(algorithmName) {
    const algo = this.algorithms[algorithmName];
    if (!algo) {
      throw new Error(`Unknown algorithm: ${algorithmName}`);
    }
    return algo;
  }

  /**
   * Encrypts text or binary data and returns a Base64-encoded package containing
   * header metadata and ciphertext.
   *
   * @async
   * @param {string|Uint8Array} plaintext - The data to encrypt.
   * @param {string} passphrase - Passphrase used for key derivation.
   * @param {string} algorithmName - Algorithm identifier (e.g., 'aesgcm').
   * @returns {Promise<string>} Base64 string: header + ciphertext.
   * @throws {Error} If the specified algorithm is unknown or encryption fails.
   */
  async encryptText(plaintext, passphrase, algorithmName) {
    const passphraseBytes = new TextEncoder().encode(passphrase);
    const algo = this.getAlgorithm(algorithmName);

    // Derive key and obtain salt
    const saltBytes = await algo.initialize(passphraseBytes, this.saltLength, this.argon2Iterations);

    // Perform encryption
    const cipherData = await algo.encryptData(plaintext);

    // Build header + cipher payload
    const headerBytes = this._encodeHeader(algorithmName, saltBytes);
    const combined = new Uint8Array(headerBytes.length + cipherData.length);
    combined.set(headerBytes, 0);
    combined.set(cipherData, headerBytes.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypts a Base64-encoded payload produced by `encryptText`.
   *
   * @async
   * @param {string} base64Cipher - Base64 string with header and ciphertext.
   * @param {string} passphrase - Passphrase used for key derivation.
   * @returns {Promise<string>} The decrypted UTF-8 plaintext.
   * @throws {Error} If header decoding fails or decryption is unsuccessful.
   */
  async decryptText(base64Cipher, passphrase) {
    const combined = new Uint8Array([...atob(base64Cipher)].map((c) => c.charCodeAt(0)));
    const { algorithmName, header, saltBytes, headerLength } = this.decodeHeader(combined);
    const algo = this.getAlgorithm(algorithmName);
    const passphraseBytes = new TextEncoder().encode(passphrase);

    // Re-derive key using header parameters
    await algo.initialize(passphraseBytes, this.saltLength, header.argon2Iterations, saltBytes);
    const plaintextBytes = await algo.decryptData(combined.slice(headerLength));
    return new TextDecoder().decode(plaintextBytes);
  }

  /**
   * Heuristically checks whether the given Base64 text is encrypted
   * with a recognized header identifier.
   *
   * @async
   * @param {string} data - Base64 string to test.
   * @returns {Promise<boolean>} True if it begins with a known algorithm ID.
   */
  async isEncrypted(data) {
    try {
      const combined = new Uint8Array([...atob(data)].map((c) => c.charCodeAt(0)));
      const algorithmId = combined[0];
      return [0x01, 0x02, 0x03].includes(algorithmId);
    } catch {
      return false;
    }
  }

  /**
   * Encrypts a File by streaming through AES-GCM, prepending a header,
   * and returning the resulting Blob.
   *
   * @async
   * @param {File} file - The input file to encrypt.
   * @param {string} passphrase - The passphrase for key derivation.
   * @param {string} algorithmName - Algorithm identifier (e.g., 'aesgcm').
   * @returns {Promise<Blob>} Blob containing header + encrypted file data.
   */
  async encryptFile(file, passphrase, algorithmName) {
    const passphraseBytes = new TextEncoder().encode(passphrase);
    const algo = this.getAlgorithm(algorithmName);

    // Derive key and get salt
    const saltBytes = await algo.initialize(passphraseBytes, this.saltLength, this.argon2Iterations);
    const headerBytes = this._encodeHeader(algorithmName, saltBytes);

    // Stream-based processing for large files
    const processor = new StreamProcessor(algo, headerBytes);
    return processor.encryptFile(file);
  }

  /**
   * Decrypts an encrypted Blob/File by reading and parsing its header,
   * re-deriving the key, and streaming decryption.
   *
   * @async
   * @param {File} file - The encrypted file Blob.
   * @param {string} passphrase - The passphrase for key derivation.
   * @returns {Promise<Blob>} Blob containing decrypted file data.
   */
  async decryptFile(file, passphrase) {
    // Read header bytes from file
    const headerBuffer = await file.slice(0, 20).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);
    const { algorithmName, header, saltBytes, headerLength } = this.decodeHeader(headerBytes);
    const algo = this.getAlgorithm(algorithmName);
    const passphraseBytes = new TextEncoder().encode(passphrase);

    // Re-derive key then stream decrypt remainder
    await algo.initialize(passphraseBytes, this.saltLength, header.argon2Iterations, saltBytes);
    const processor = new StreamProcessor(algo, []);
    return processor.decryptFile(file.slice(headerLength));
  }

  /**
   * Determines if a given File appears encrypted by its first header byte.
   *
   * @async
   * @param {File} file - The file to inspect.
   * @returns {Promise<boolean>} True if the first byte matches the AES-GCM ID.
   */
  async isEncryptedFile(file) {
    try {
      const headerBuffer = await file.slice(0, 1).arrayBuffer();
      const byte = new Uint8Array(headerBuffer)[0];
      return byte === EncryptionServiceConstants.START_BYTE;
    } catch {
      return false;
    }
  }

  /**
   * Sets the Argon2 iteration count based on a difficulty keyword.
   *
   * @param {'low'|'middle'|'high'} difficulty - Desired iteration difficulty.
   * @throws {Error} If the difficulty key is not recognized.
   */
  setargon2Difficulty(difficulty) {
    if (!(difficulty in this.argon2IterationMapping)) {
      throw new Error("Invalid argon2 difficulty. Choose 'low', 'middle', or 'high'.");
    }
    this.argon2Iterations = this.argon2IterationMapping[difficulty];
    this.argon2Difficulty = difficulty;
  }

  /**
   * Sets the salt length based on a difficulty keyword.
   *
   * @param {'low'|'high'} difficulty - Desired salt-length difficulty.
   * @throws {Error} If the difficulty key is not recognized.
   */
  setSaltLengthDifficulty(difficulty) {
    if (!(difficulty in this.saltLengthMapping)) {
      throw new Error("Invalid salt length difficulty. Choose 'low' or 'high'.");
    }
    this.saltLength = this.saltLengthMapping[difficulty];
    this.saltDifficulty = difficulty;
  }

  /**
   * @private
   * Encode the header for encrypted data, packing algorithm ID, version,
   * salt-strength flag, Argon2 difficulty, and salt bytes into a Uint8Array.
   *
   * The header layout is:
   * 1. Algorithm identifier (1 byte)
   * 2. Info byte (1 byte) with:
   *    - Bits 5–7: data version (3 bits)
   *    - Bit 2   : salt-strength flag (0 = low, 1 = high)
   *    - Bits 0–1: Argon2 difficulty code (2 bits)
   * 3. Salt bytes (variable length)
   *
   * @param {string} algorithmName     - The name of the algorithm to encode ('aesgcm').
   * @param {Uint8Array} saltBytes     - The salt bytes to include in the header.
   * @returns {Uint8Array} A byte array containing the packed header.
   *
   * @throws {Error} If header encoding is not implemented for the given algorithm.
   */
  _encodeHeader(algorithmName, saltBytes) {
    const algorithmIdentifiers = {
      aesgcm: EncryptionServiceConstants.START_BYTE,
    };
    const algoId = algorithmIdentifiers[algorithmName];
    if (algorithmName === 'aesgcm') {
      const argon2Codes = { low: 0b00, middle: 0b01, high: 0b10 };
      const saltFlag = this.saltDifficulty === 'high' ? 1 : 0;
      const version = EncryptionServiceConstants.CURRENT_DATA_VERSION; // 3-bit version, default to 0 for compatibility
      // Pack version into bits 5-7, saltFlag into bit 2, argon2 into bits 0-1
      const infoByte = (version << 5) | (saltFlag << 2) | argon2Codes[this.argon2Difficulty];
      const header = new Uint8Array(1 + 1 + saltBytes.length);
      header[0] = algoId;
      header[1] = infoByte;
      header.set(saltBytes, 2);
      return header;
    }
    throw new Error(`Header encoding not implemented for algorithm: ${algorithmName}`);
  }

  /**
   * @typedef {Object} DecodeHeaderResult
   * @property {string} algorithmName     - The name of the detected algorithm (e.g. 'aesgcm').
   * @property {Object} header            - Decoded header metadata.
   * @property {number} header.version    - Version parsed from the info byte.
   * @property {number} header.argon2Iterations - Number of Argon2 iterations parsed from the info byte.
   * @property {Uint8Array} saltBytes     - Extracted salt bytes from the header.
   * @property {number} headerLength      - Total length of the header in bytes.
   */

  /**
   * @public
   * Decode the encryption header from a combined byte array.
   *
   * Reads:
   * 1. Algorithm ID (first byte) → algorithmName
   * 2. Info byte (second byte) → version + Argon2 iteration code
   * 3. Salt bytes (following bytes) → saltBytes
   *
   * @param {Uint8Array} combinedData - Byte array starting with the header to decode.
   * @returns {DecodeHeaderResult} Parsed header metadata and salt.
   *
   * @throws {Error} If the algorithm identifier byte is not recognized.
   * @throws {Error} If decoding is not implemented for the detected algorithm/version.
   */
  decodeHeader(combinedData) {
    const algorithmIdentifiers = {};
    algorithmIdentifiers[EncryptionServiceConstants.START_BYTE] = 'aesgcm';
    const algoId = combinedData[0];
    const algorithmName = algorithmIdentifiers[algoId];
    if (!algorithmName) {
      throw new Error(`Unknown algorithm identifier: ${algoId}`);
    }

    if (algorithmName === 'aesgcm') {
      const infoByte = combinedData[1];
      const version = (infoByte >> 5) & 0b111; // bits 5-7
      if (version === 0b000) {
        const saltFlag = (infoByte >> 2) & 0x01;
        const saltLength = 
          saltFlag === 0 ? 
          this.saltLengthMapping.low : 
          this.saltLengthMapping.high;
        
        const headerLength = 1 + 1 + saltLength;
        const headerInput = combinedData.slice(0, headerLength);
        const saltBytes = headerInput.slice(2, 2 + saltLength);
        const argon2Codes = {
          0b00: this.argon2IterationMapping.low,
          0b01: this.argon2IterationMapping.middle,
          0b10: this.argon2IterationMapping.high,
        };
        const argon2Code = infoByte & 0x03;
        /** @type {{ version: number, argon2Iterations: number }} */
        let header = {};
        header.argon2Iterations = argon2Codes[argon2Code];
        header.version = version;
        return { algorithmName, header, saltBytes, headerLength };
      }
    }
    throw new Error(`Header decoding not implemented for algorithm: ${algorithmName}`);
  }
}
