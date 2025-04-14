import { AESGCMEncryption } from '../algorithms/AESGCMEncryption.js';
import { StreamProcessor } from '../algorithms/AESGCMStream/StreamProcessor.js';
/**
 * EncryptionService bridges the user's encryption choice with the correct encryption algorithm implementation.
 * It manages header encoding/decoding, key derivation settings, and base64 conversions for encryption/decryption.
 */
export class EncryptionService {
  /**
   * Constructs the EncryptionService with available algorithms and default difficulty settings.
   */
  constructor() {
    // Map algorithm names to their instances.
    this.algorithms = {
      aesgcm: new AESGCMEncryption(),
    };

    // Mapping for argon2 iterations based on difficulty.
    this.argon2IterationMapping = {
      low: 100,
      middle: 400,
      high: 800
    };

    // Mapping for salt lengths based on difficulty.
    this.saltLengthMapping = {
      low: 12,
      high: 16
    };

    // Set default difficulty settings.
    this.setargon2Difficulty('middle');
    this.setSaltLengthDifficulty('high');
  }

  /**
   * Retrieves the encryption algorithm instance for the given algorithm name.
   * @param {string} algorithmName - Name of the algorithm ('aesgcm', 'aesctr', 'xor').
   * @returns {IEncryptionAlgorithm} The corresponding encryption algorithm instance.
   * @throws Will throw an error if the algorithm is not recognized.
   */
  getAlgorithm(algorithmName) {
    const algo = this.algorithms[algorithmName];
    if (!algo) {
      throw new Error(`Unknown algorithm: ${algorithmName}`);
    }
    return algo;
  }

  /**
   * Encrypts data using the specified algorithm and returns a single base64 encoded string.
   * The output includes a header with metadata and the ciphertext.
   * @param {string | Uint8Array} plaintext - Data to encrypt.
   * @param {string} passphrase - Passphrase for key derivation.
   * @param {string} algorithmName - Algorithm to use ('aesgcm')
   * @returns {Promise<string>} Base64 encoded encrypted string.
   */
  async encryptText(plaintext, passphrase, algorithmName) {
    const passphraseBytes = new TextEncoder().encode(passphrase);
    const algo = this.getAlgorithm(algorithmName);

    // Initialize the algorithm, which derives the key and returns salt
    const saltBytes = await algo.initialize(
      passphraseBytes,
      this.saltLength,
      this.argon2Iterations
    );

    // Encrypt the plaintext data.
    const cipherData = await algo.encryptData(plaintext);

    // Construct the header.
    const headerBytes = this._encodeHeader(algorithmName, saltBytes);
    const combined = new Uint8Array(headerBytes.length + cipherData.length);
    combined.set(headerBytes, 0);
    combined.set(cipherData, headerBytes.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypts a base64 encoded string and returns the decrypted plaintext.
   * It extracts the header to determine the algorithm and key derivation parameters.
   * @param {string} base64Cipher - Base64 encoded string containing header and ciphertext.
   * @param {string} passphrase - Passphrase for key derivation.
   * @returns {Promise<string>} The decrypted plaintext as a UTF-8 string.
   * @throws Will throw an error if the header is invalid or the algorithm is unrecognized.
   */
  async decryptText(base64Cipher, passphrase) {
    const combined = new Uint8Array([...atob(base64Cipher)].map(c => c.charCodeAt(0)));
    const { algorithmName, header, saltBytes, headerLength } = this._decodeHeader(combined);
    const algo = this.getAlgorithm(algorithmName);
    const passphraseBytes = new TextEncoder().encode(passphrase);

    // Initialize algorithm with key derivation parameters from header.
    await algo.initialize(passphraseBytes, this.saltLength, header.argon2Iterations, saltBytes);
    const plaintextBytes = await algo.decryptData(combined.slice(header.length));
    return new TextDecoder().decode(plaintextBytes);
  }

  /**
   * Checks if the provided base64 string appears to be encrypted based on its header.
   * @param {string} data - Base64 encoded data.
   * @returns {Promise<boolean>} True if data is encrypted; otherwise, false.
   */
  async isEncrypted(data) {
    try {
      const combined = new Uint8Array([...atob(data)].map(c => c.charCodeAt(0)));
      const algorithmId = combined[0];
      return [0x01, 0x02, 0x03].includes(algorithmId);
    } catch (err) {
      return false;
    }
  }
  
  async encryptFile(file, passphrase, algorithmName) {
    const passphraseBytes = new TextEncoder().encode(passphrase);
    const algo = this.getAlgorithm(algorithmName);

    // Initialize the algorithm, which derives the key and returns salt.
    const saltBytes = await algo.initialize(
      passphraseBytes,
      this.saltLength,
      this.argon2Iterations
    );
    const headerBytes = this._encodeHeader(algorithmName, saltBytes);
    const processor = new StreamProcessor(algo, headerBytes);
    const processedBlob = await processor.encryptFile(file);

    
    return processedBlob;
  }

  async decryptFile(file, passphrase) {
    const headerBuffer = await file.slice(0, 20).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer)

    const { algorithmName, header, saltBytes, headerLength } = this._decodeHeader(headerBytes);
    const algo = this.getAlgorithm(algorithmName);
    const passphraseBytes = new TextEncoder().encode(passphrase);

    // Initialize algorithm with key derivation parameters from header.
    await algo.initialize(passphraseBytes, this.saltLength, header.argon2Iterations, saltBytes);
    const processor = new StreamProcessor(algo, []);
    const blob = processor.decryptFile(file.slice(headerLength));
    return blob;
  }

  /**
   * Checks if the provided file appears to be encrypted based on its header.
   * @param {string} file - file handle.
   * @returns {Promise<boolean>} True if data is encrypted; otherwise, false.
   */

  async isEncryptedFile(file) {
    try {
      const headerBuffer = await file.slice(0, 1).arrayBuffer();
      const byte = new Uint8Array(headerBuffer)[0];
      return byte === 0x01;
    } catch (err) {
      return false;
    }
  }

  /**
   * Sets the argon2 iteration count based on difficulty.
   * @param {"low"|"medium"|"high"} difficulty - Difficulty level.
   * @throws Will throw an error if an invalid difficulty is provided.
   */
  setargon2Difficulty(difficulty) {
    if (!(difficulty in this.argon2IterationMapping)) {
      throw new Error("Invalid argon2 difficulty. Choose 'low', 'middle', or 'high'.");
    }
    this.argon2Iterations = this.argon2IterationMapping[difficulty];
    this.argon2Difficulty = difficulty;
  }

  /**
   * Sets the salt length based on difficulty.
   * @param {"low"|"high"} difficulty - Difficulty level for salt length.
   * @throws Will throw an error if an invalid difficulty is provided.
   */
  setSaltLengthDifficulty(difficulty) {
    if (!(difficulty in this.saltLengthMapping)) {
      throw new Error("Invalid salt length difficulty. Choose 'low' or 'high'.");
    }
    this.saltLength = this.saltLengthMapping[difficulty];
    this.saltDifficulty = difficulty;
  }

  /**
   * Encodes a header based on the algorithm and provided salt.
   * For AES-GCM, the header structure is:
   *   Byte 0: Algorithm identifier.
   *   Byte 1: Difficulty byte (bits 0-1: argon2 difficulty, bit 2: salt length flag).
   *   Bytes 2..: Salt bytes.
   * @param {string} algorithmName - The algorithm name.
   * @param {Uint8Array} saltBytes - Salt bytes used in key derivation.
   * @returns {Uint8Array} The encoded header.
   */
  _encodeHeader(algorithmName, saltBytes) {
    const algorithmIdentifiers = {
      aesgcm: 0x01,
    };
    const algoId = algorithmIdentifiers[algorithmName];
    if (algorithmName === 'aesgcm') {
      // Determine argon2 difficulty code.
      const argon2Codes = { low: 0b00, middle: 0b01, high: 0b10 };
      const saltFlag = this.saltDifficulty === 'high' ? 1 : 0;
      const difficultyByte = (saltFlag << 2) | argon2Codes[this.argon2Difficulty];
      const header = new Uint8Array(1 + 1 + saltBytes.length);
      header[0] = algoId;
      header[1] = difficultyByte;
      header.set(saltBytes, 2);
      return header;
    } 
    throw new Error(`Header encoding not implemented for algorithm: ${algorithmName}`);
  }

  /**
   * Decodes the header from the combined encrypted data.
   * @param {Uint8Array} combinedData - The combined header and ciphertext.
   * @returns {{ algorithmName: string, header: Uint8Array, saltBytes: Uint8Array }}
   *   The algorithm name, full header, and extracted salt bytes.
   * @throws Will throw an error if the header is invalid.
   */
  _decodeHeader(combinedData) {
    const algorithmIdentifiers = {
      0x01: 'aesgcm',
    };
    const algoId = combinedData[0];
    const algorithmName = algorithmIdentifiers[algoId];
    if (!algorithmName) {
      throw new Error(`Unknown algorithm identifier: ${algoId}`);
    }

    if (algorithmName === 'aesgcm') {
      const difficultyByte = combinedData[1];
      const saltFlag = (difficultyByte >> 2) & 0x01;
      const saltLength = saltFlag === 0 ? this.saltLengthMapping.low : this.saltLengthMapping.high;
      const headerLength = 1 + 1 + saltLength;
      const header = combinedData.slice(0, headerLength);
      const saltBytes = header.slice(2, 2 + saltLength);
      const argon2Codes = { 0b00: this.argon2IterationMapping.low, 0b01: this.argon2IterationMapping.middle, 0b10: this.argon2IterationMapping.high };
      const argon2Code = difficultyByte & 0x03;
      header.argon2Iterations = argon2Codes[argon2Code];
      return { algorithmName, header, saltBytes, headerLength};
    }
    throw new Error(`Header decoding not implemented for algorithm: ${algorithmName}`);
  }
}