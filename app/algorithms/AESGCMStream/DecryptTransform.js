// DecryptTransform.js
export class DecryptTransform {
  constructor(cryptoEngine, chunkSize = 1024 * 1024) {
    this.cryptoEngine = cryptoEngine;
    this.chunkSize = chunkSize;
    this.buffer = new Uint8Array(0);
  }

  async transform(chunk, controller) {
    const newData = new Uint8Array(chunk);
    const combined = new Uint8Array(this.buffer.length + newData.length);
    combined.set(this.buffer);
    combined.set(newData, this.buffer.length);

    let offset = 0;
    // Process available data as an encrypted chunk.
    // (In this design each transform call should deliver complete encrypted chunks.)
    if (combined.length - offset > 0) {
      const encryptedChunk = combined.slice(offset).buffer;
      try {
        const decryptedBuffer = await this.cryptoEngine.decryptChunk(encryptedChunk);
        controller.enqueue(decryptedBuffer);
        offset = combined.length;
      } catch (e) {
        // Incomplete chunk – buffer and wait for more data.
        this.buffer = combined.slice(offset);
        return;
      }
    }
    this.buffer = offset < combined.length ? combined.slice(offset) : new Uint8Array(0);
  }

  async flush(controller) {
    if (this.buffer.length > 0) {
      try {
        const decryptedBuffer = await this.cryptoEngine.decryptChunk(this.buffer.buffer);
        controller.enqueue(decryptedBuffer);
      } catch (e) {
        
      }
      this.buffer = new Uint8Array(0);
    }
  }

  getTransformStream() {
    const self = this;
    return new TransformStream({
      async transform(chunk, controller) {
        const arrayBuffer = chunk instanceof ArrayBuffer
          ? chunk
          : chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
        await self.transform(arrayBuffer, controller);
      },
      async flush(controller) {
        await self.flush(controller);
      }
    });
  }
}