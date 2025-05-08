// StreamProcessor.js

/**
 * @class StreamProcessor
 * @classdesc
 * Coordinates chunked AES-GCM encryption or decryption of a file or stream
 * by piping through the appropriate TransformStream and collecting results
 * into a single Blob with a custom header.
 */
export class StreamProcessor {
  /**
   * @param {IEncryptionAlgorithm} cryptoEngine
   *   An initialized encryption algorithm instance (e.g., AESGCMEncryption).
   * @param {Uint8Array} headerBytes
   *   Bytes to prepend to the output Blob (e.g., salt or custom header).
   * @param {number} [chunkSize=524288]
   *   Size in bytes of each plaintext chunk (default 512 KiB).
   */
  constructor(cryptoEngine, headerBytes, chunkSize = 512 * 1024) {
    this.cryptoEngine = cryptoEngine;
    this.chunkSize = chunkSize;
    this.headerBytes = headerBytes;
  }

  /**
   * Pipes a ReadableStream through a given TransformStream, collects all
   * output chunks, and returns a single Blob containing headerBytes plus data.
   *
   * @async
   * @param {ReadableStream} readableStream
   *   The source stream of file data (e.g., from `File.stream()`).
   * @param {TransformStream} transformStream
   *   The stream that transforms each chunk (encryption or decryption).
   * @returns {Promise<Blob>}
   *   A Blob containing `headerBytes` followed by all transformed chunks.
   */
  async processStream(readableStream, transformStream) {
    const reader = readableStream.pipeThrough(transformStream).getReader();
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(new Uint8Array(value));
    }
    return new Blob([this.headerBytes, ...chunks], { type: "application/octet-stream" });
  }

  /**
   * Encrypts the given File by streaming its contents through an EncryptTransform.
   *
   * @async
   * @param {File} file
   *   The input File to encrypt.
   * @returns {Promise<Blob>}
   *   A Blob containing headerBytes plus encrypted chunks.
   */
  async encryptFile(file) {
    const encryptTransform = new EncryptTransform(this.cryptoEngine, this.chunkSize);
    const transformStream = encryptTransform.getTransformStream();
    const readableStream = file.stream();
    return this.processStream(readableStream, transformStream);
  }

  /**
   * Decrypts the given File by streaming its contents through a DecryptTransform.
   *
   * @async
   * @param {File} file
   *   The input File to decrypt.
   * @returns {Promise<Blob>}
   *   A Blob containing headerBytes plus decrypted plaintext.
   */
  async decryptFile(file) {
    const decryptTransform = new DecryptTransform(this.cryptoEngine, this.chunkSize);
    const transformStream = decryptTransform.getTransformStream();
    const readableStream = file.stream();
    return this.processStream(readableStream, transformStream);
  }
}