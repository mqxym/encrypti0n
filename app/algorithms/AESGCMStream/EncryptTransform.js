// EncryptTransform.js
export class EncryptTransform {
  constructor(cryptoEngine, chunkSize = 512 * 1024) {
    this.cryptoEngine = cryptoEngine;
    this.chunkSize = chunkSize;
    this.buffer = new Uint8Array(0);
  }

  async transform(chunk, controller) {
    // 1. Combine leftover buffer with new incoming data
    const newData = new Uint8Array(chunk);
    const combined = new Uint8Array(this.buffer.length + newData.length);
    combined.set(this.buffer);
    combined.set(newData, this.buffer.length);

    let offset = 0;

    // 2. Process as many full 512 KiB blocks as possible
    while (combined.length - offset >= this.chunkSize) {
      // Extract one plaintext block
      const plaintextBlock = combined.slice(offset, offset + this.chunkSize);
      offset += this.chunkSize;

      // Encrypt that block (includes IV internally)
      const encryptedBlock = await this.cryptoEngine.encryptChunk(plaintextBlock);

      // 3. Create a 4-byte header that holds the length of encryptedBlock
      const header = new Uint8Array(4);
      new DataView(header.buffer).setUint32(0, encryptedBlock.length, false); // big-endian

      // 4. Combine header + ciphertext
      const output = new Uint8Array(4 + encryptedBlock.length);
      output.set(header, 0);
      output.set(encryptedBlock, 4);

      controller.enqueue(output);
    }

    // 5. Save leftover bytes in this.buffer
    this.buffer = combined.slice(offset);
  }

  async flush(controller) {
    // Encrypt any leftover plaintext smaller than chunkSize
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

  getTransformStream() {
    const self = this;
    return new TransformStream({
      async transform(chunk, controller) {
        // Convert whatever `chunk` is into a raw ArrayBuffer
        let arrayBuffer;
        if (chunk instanceof ArrayBuffer) {
          arrayBuffer = chunk;
        } else if (chunk instanceof Blob) {
          arrayBuffer = await chunk.arrayBuffer();
        } else {
          // e.g. Uint8Array
          arrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
        }
        await self.transform(arrayBuffer, controller);
      },
      async flush(controller) {
        await self.flush(controller);
      }
    });
  }
}