// EncryptTransform.js
export class EncryptTransform {
  constructor(cryptoEngine, chunkSize = 1024 * 1024) {
    this.cryptoEngine = cryptoEngine;
    this.chunkSize = chunkSize;
    this.buffer = new Uint8Array(0);
  }

  async transform(chunk, controller) {
    // Concatenate leftover buffer and new incoming data
    const newData = new Uint8Array(chunk);
    const combined = new Uint8Array(this.buffer.length + newData.length);
    combined.set(this.buffer);
    combined.set(newData, this.buffer.length);

    let offset = 0;
    // Process full chunks
    while (combined.length - offset >= this.chunkSize) {
      const slice = combined.slice(offset, offset + this.chunkSize);
      const encryptedChunk = await this.cryptoEngine.encryptChunk(slice.buffer);
      controller.enqueue(encryptedChunk);
      offset += this.chunkSize;
    }
    // Save leftover bytes for next transform call
    this.buffer = combined.slice(offset);
  }

  async flush(controller) {
    if (this.buffer.length > 0) {
      const encryptedChunk = await this.cryptoEngine.encryptChunk(this.buffer.buffer);
      controller.enqueue(encryptedChunk);
      this.buffer = new Uint8Array(0);
    }
  }

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
          // Assuming it's a typed array like Uint8Array.
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