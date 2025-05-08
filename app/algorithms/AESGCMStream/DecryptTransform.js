// DecryptTransform.js

/**
 * @class DecryptTransform
 * @classdesc
 * A TransformStream controller that decrypts incoming data blocks which are
 * prefixed by a 4-byte big-endian length header, using the provided cryptoEngine.
 * Buffers partial data between calls and handles final flush.
 */
export class DecryptTransform {
  /**
   * @param {IEncryptionAlgorithm} cryptoEngine
   *   The decryption algorithm instance (e.g., AESGCMEncryption).
   * @param {number} [chunkSize=524288]
   *   Maximum ciphertext block size in bytes (default 512 KiB).
   */
  constructor(cryptoEngine, chunkSize = 512 * 1024) {
    this.cryptoEngine = cryptoEngine;
    this.chunkSize = chunkSize;
    this.buffer = new Uint8Array(0);
  }

  /**
   * Processes an incoming ArrayBuffer chunk: buffers it, reads length headers,
   * decrypts complete blocks, and enqueues plaintext ArrayBuffer outputs.
   *
   * @async
   * @param {ArrayBuffer} chunk
   *   Raw bytes from the source stream.
   * @param {TransformStreamDefaultController} controller
   *   Controller to enqueue decrypted ArrayBuffer outputs.
   */
  async transform(chunk, controller) {
    const newData = new Uint8Array(chunk);
    const combined = new Uint8Array(this.buffer.length + newData.length);
    combined.set(this.buffer);
    combined.set(newData, this.buffer.length);

    let offset = 0;
    while (true) {
      if (combined.length - offset < 4) break;
      const cipherLength = new DataView(combined.buffer, offset, 4).getUint32(0, false);
      offset += 4;
      if (combined.length - offset < cipherLength) {
        offset -= 4;
        break;
      }
      const encryptedChunk = combined.slice(offset, offset + cipherLength);
      offset += cipherLength;

      const decrypted = await this.cryptoEngine.decryptChunk(encryptedChunk);
      controller.enqueue(decrypted);
    }

    this.buffer = combined.slice(offset);
  }

  /**
   * Finalizes the stream: attempts to decrypt any remaining buffered data.
   *
   * @async
   * @param {TransformStreamDefaultController} controller
   *   Controller to enqueue the final decrypted blocks.
   */
  async flush(controller) {
    let offset = 0;
    while (true) {
      if (this.buffer.length - offset < 4) break;
      const cipherLength = new DataView(this.buffer.buffer, offset, 4).getUint32(0, false);
      offset += 4;
      if (this.buffer.length - offset < cipherLength) {
        offset -= 4;
        break;
      }
      const encryptedChunk = this.buffer.slice(offset, offset + cipherLength);
      offset += cipherLength;

      const decrypted = await this.cryptoEngine.decryptChunk(encryptedChunk);
      controller.enqueue(decrypted);
    }
    this.buffer = this.buffer.slice(offset);
  }

  /**
   * @returns {TransformStream}
   *   A TransformStream that handles ArrayBuffer/Blob/Uint8Array inputs
   *   and outputs decrypted ArrayBuffer chunks.
   */
  getTransformStream() {
    const self = this;
    return new TransformStream({
      async transform(chunk, controller) {
        let arrayBuffer;
        if (chunk instanceof ArrayBuffer) {
          arrayBuffer = chunk;
        } else if (chunk instanceof Blob) {
          arrayBuffer = await chunk.arrayBuffer();
        } else {
          arrayBuffer = chunk.buffer.slice(
            chunk.byteOffset,
            chunk.byteOffset + chunk.byteLength
          );
        }
        await self.transform(arrayBuffer, controller);
      },
      async flush(controller) {
        await self.flush(controller);
      }
    });
  }
}