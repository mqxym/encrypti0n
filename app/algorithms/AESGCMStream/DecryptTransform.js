// DecryptTransform.js
export class DecryptTransform {
  constructor(cryptoEngine, chunkSize = 512 * 1024) {
    this.cryptoEngine = cryptoEngine;
    this.chunkSize = chunkSize;
    this.buffer = new Uint8Array(0);
  }

  async transform(chunk, controller) {
    //  Accumulate new data in the buffer
    const newData = new Uint8Array(chunk);
    const combined = new Uint8Array(this.buffer.length + newData.length);
    combined.set(this.buffer);
    combined.set(newData, this.buffer.length);

    let offset = 0;

    // Process any complete "header + ciphertext" blocks
    while (true) {
      // We need at least 4 bytes for the length header
      if (combined.length - offset < 4) {
        break;
      }

      // Read the ciphertext length from the 4-byte header
      const cipherLength = new DataView(combined.buffer, offset, 4).getUint32(0, false);
      offset += 4;

      // If we don't have the full ciphertext yet, roll back offset by 4 and wait
      if (combined.length - offset < cipherLength) {
        offset -= 4;
        break;
      }

      // Extract the encrypted chunk
      const encryptedChunk = combined.slice(offset, offset + cipherLength);
      offset += cipherLength;

      // Decrypt
      const decrypted = await this.cryptoEngine.decryptChunk(encryptedChunk);

      // Output plaintext
      controller.enqueue(decrypted);
    }

    // Keep leftover unprocessed data for next transform call
    this.buffer = combined.slice(offset);
  }

  async flush(controller) {
    // On flush, try to consume any leftover
    let offset = 0;
    while (true) {
      if (this.buffer.length - offset < 4) {
        break;
      }

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

    // If something remains that can't form a full block, you could handle it or ignore.
    this.buffer = this.buffer.slice(offset);
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