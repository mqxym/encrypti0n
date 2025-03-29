// StreamProcessor.js
import { EncryptTransform } from "./EncryptTransform.js";
import { DecryptTransform } from "./DecryptTransform.js";

export class StreamProcessor {
  constructor(cryptoEngine, headerBytes, chunkSize = 1024 * 1024) {
    this.cryptoEngine = cryptoEngine;
    this.chunkSize = chunkSize;
    this.headerBytes = headerBytes;
  }

  async processStream(readableStream, transformStream) {
    // Pipe the input stream through the transform stream and read all output chunks.
    const reader = readableStream.pipeThrough(transformStream).getReader();
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(new Uint8Array(value));
    }
    // Spread chunks so that each is added as a separate Blob part.
    return new Blob([this.headerBytes, ...chunks], { type: "application/octet-stream" });
  }

  async encryptFile(file) {
    const encryptTransform = new EncryptTransform(this.cryptoEngine, this.chunkSize);
    const transformStream = encryptTransform.getTransformStream();
    const readableStream = file.stream();
    return this.processStream(readableStream, transformStream);
  }

  async decryptFile(file) {
    const decryptTransform = new DecryptTransform(this.cryptoEngine, this.chunkSize);
    const transformStream = decryptTransform.getTransformStream();
    const readableStream = file.stream();
    return this.processStream(readableStream, transformStream);
  }
}