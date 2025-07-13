// EncryptTransform.js

/**
 * @class EncryptTransform
 * @classdesc
 * A TransformStream controller that encrypts incoming data in fixed-size chunks
 * using the provided cryptoEngine, prepends each encrypted block with a 4-byte
 * big-endian length header, and buffers partial data between calls.
 */
export class EncryptTransform {
  /**
   * @param {IEncryptionAlgorithm} cryptoEngine
   *   The encryption algorithm instance (e.g., AESGCMEncryption).
   * @param {number} [chunkSize=524288]
   *   Maximum plaintext block size in bytes (default 512 KiB).
   */
  constructor(cryptoEngine, chunkSize = 512 * 1024) {
    this.cryptoEngine = cryptoEngine;
    this.chunkSize = chunkSize;
    this.buffer = new Uint8Array(0);
  }

  /**
   * Processes an incoming ArrayBuffer chunk: buffers it, encrypts
   * full blocks, and enqueues encrypted blocks prefixed by length headers.
   *
   * @async
   * @param {ArrayBuffer} chunk
   *   Raw bytes from the source stream.
   * @param {TransformStreamDefaultController} controller
   *   Controller to enqueue encrypted Uint8Array outputs.
   */
  async transform(chunk, controller) {
    const newData = new Uint8Array(chunk);
    const combined = new Uint8Array(this.buffer.length + newData.length);
    combined.set(this.buffer);
    combined.set(newData, this.buffer.length);

    let offset = 0;
    while (combined.length - offset >= this.chunkSize) {
      const plaintextBlock = combined.slice(offset, offset + this.chunkSize);
      offset += this.chunkSize;

      const encryptedBlock = await this.cryptoEngine.encryptChunk(plaintextBlock);

      const header = new Uint8Array(4);
      new DataView(header.buffer).setUint32(0, encryptedBlock.length, false);

      const output = new Uint8Array(4 + encryptedBlock.length);
      output.set(header, 0);
      output.set(encryptedBlock, 4);

      controller.enqueue(output);
    }

    this.buffer = combined.slice(offset);
  }

  /**
   * Finalizes the stream: encrypts and enqueues any remaining buffered data.
   *
   * @async
   * @param {TransformStreamDefaultController} controller
   *   Controller to enqueue the final encrypted block.
   */
  async flush(controller) {
    if (this.buffer.length > 0) {
      const encryptedBlock = await this.cryptoEngine.encryptChunk(this.buffer);
      const header = new Uint8Array(4);
      new DataView(header.buffer).setUint32(0, encryptedBlock.length, false);

      const output = new Uint8Array(4 + encryptedBlock.length);
      output.set(header, 0);
      output.set(encryptedBlock, 4);

      controller.enqueue(output);
      this.buffer = new Uint8Array(0);
    }
  }

  /**
   * @returns {TransformStream}
   *   A TransformStream that handles ArrayBuffer/Blob/Uint8Array inputs
   *   and outputs encrypted Uint8Array blocks with length headers.
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