// FileStreamHelper

export default class FileStreamService {
  /**
   * @param {object} cryptit - An instance compatible with:
   *   createEncryptionStream(pass) -> { header: Uint8Array, writable: WritableStream, readable: ReadableStream }
   *   createDecryptionStream(pass) -> TransformStream
   * @param {object} [options]
   * @param {string} [options.streamSaverMitmPath='/assets/streamsaver/mitm.html'] - Path to StreamSaver's mitm.html on same origin.
   * @param {number} [options.chunkSize=65536] - Bytes per chunk fed to crypto stream.
   * @param {number} [options.progressInterval=400] - ms between progress ticks.
   * @param {number} [options.iosFinalizeGraceMs=800] - Small grace for iOS stuck “downloading…” fix.
   * @param {number} [options.safariLargeFileLimit=500*1024*1024] - Optional guard; not enforced unless you call guardSafariLargeFile().
   * @param {function} [options.isiOSDetector] - Optional override for iOS detection.
   */
  constructor(cryptit, options = {}) {
    if (!cryptit) throw new Error('FileCryptoHelper: cryptit instance is required');
    this.cryptit = cryptit;

    this.cfg = {
      streamSaverMitmPath: '/assets/streamsaver/mitm.html',
      chunkSize: 65536,
      progressInterval: 400,
      iosFinalizeGraceMs: 800,
      safariLargeFileLimit: 500 * 1024 * 1024,
      isiOSDetector: null,
      ...options,
    };

    // ephemeral internal state (for observability if you want to surface it)
    this._state = {
      op: 'idle',      // 'idle' | 'encrypt' | 'decrypt'
      busy: false,
      lastError: null,
      lastResult: null,
    };

    // Init StreamSaver (best-effort; safe if absent)
    this._initStreamSaver();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Encrypt a single File by streaming it to a disk sink (FS Access or StreamSaver).
   * @param {File} file
   * @param {string} passphrase
   * @param {object} [opts]
   * @param {string} [opts.outName] - Suggested output filename (defaults: "<name>.cryptit")
   * @param {string} [opts.mime='application/octet-stream']
   * @param {AbortSignal} [opts.signal]
   * @param {(p:{transferred:number,total:number,pct:number})=>void} [opts.onProgress]
   * @param {(line:string)=>void} [opts.onLog]
   * @returns {Promise<{ ok:true, outName:string, bytesIn:number, bytesOut:number }>}
   */
  async encryptFile(file, passphrase, opts = {}) {
    this._enter('encrypt');
    const onLog = opts.onLog || (() => {});
    const onProgress = opts.onProgress || (() => {});
    const chunkSize = opts.chunkSize || this.cfg.chunkSize;

    try {
      this._checkSignal(opts.signal);
      this._assertStreamingAvailable();
      this._initStreamSaver(); // (again) ensure correct MITM before save dialog

      const c = this.cryptit;
      const { header, writable, readable } = await c.createEncryptionStream(passphrase);
      const outName = opts.outName || this._suggestEncName(file?.name || 'file');
      const totalOut = this._safeAdd(header?.byteLength || 0, file?.size || 0);

      onLog(`Begin encryption of ${file.name} (${this._fmt(file.size)})`);
      const outStream = await this._createStreamingWritable(outName, totalOut, opts.mime || 'application/octet-stream').catch(e => {
        onLog(`save canceled or sink unavailable: ${e?.message ?? e}`);
        throw this._soft('SaveCanceled', 'Save was canceled or streaming sink unavailable.');
      });

      // Hook abort -> abort the underlying out stream when possible
      const aborter = this._wireAbort(opts.signal, outStream);

      // progress
      const prog = this._makeProgressReporter({
        total: file.size,
        interval: this.cfg.progressInterval,
        onTick: onProgress,
        onFinal: ({ transferred }) => onLog(`Encrypted ${this._fmt(transferred)} of plaintext`),
      });
      prog.start();

      try {
        // 1) Write header
        await this._writeHeader(outStream, header);

        // 2) Pump: file -> chunker -> crypto writable; and crypto readable -> out
        const pumpCipherToOut = readable.pipeTo(outStream).catch(e => { throw e; });
        const pumpFileToCipher = file.stream()
          .pipeThrough(this._chunker(chunkSize, n => prog.add(n)))
          .pipeTo(writable)
          .catch(e => { throw e; });

        await Promise.all([pumpFileToCipher, pumpCipherToOut]);
        prog.stop('complete');

        await this._finalizeWritable(outStream, { graceMs: this.cfg.iosFinalizeGraceMs });
        await this._closeIfPossible(outStream);

        const result = { ok: true, outName, bytesIn: file.size, bytesOut: totalOut };
        this._finish(null, result);
        aborter?.cleanup();
        onLog('Encryption complete');
        passphrase = null;
        return result;
      } catch (inner) {
        prog.stop('error');
        await this._abortIfPossible(outStream, inner);
        aborter?.cleanup();
        passphrase = null;
        throw inner;
      }
    } catch (e) {
      passphrase = null;
      this._finish(e);
      throw e;
    } 
  }

  /**
   * Decrypt a single File by streaming it to a disk sink.
   * @param {File} file
   * @param {string} passphrase
   * @param {object} [opts]
   * @param {string} [opts.outName] - Suggested output filename (defaults derived from input)
   * @param {AbortSignal} [opts.signal]
   * @param {(p:{transferred:number,total:number,pct:number})=>void} [opts.onProgress]
   * @param {(line:string)=>void} [opts.onLog]
   * @returns {Promise<{ ok:true, outName:string, bytesIn:number }>}
   */
  async decryptFile(file, passphrase, opts = {}) {
    this._enter('decrypt');
    const onLog = opts.onLog || (() => {});
    const onProgress = opts.onProgress || (() => {});
    const chunkSize = opts.chunkSize || this.cfg.chunkSize;

    try {
      this._checkSignal(opts.signal);
      this._assertStreamingAvailable();
      this._initStreamSaver();

      const c = this.cryptit;
      const dec = await c.createDecryptionStream(passphrase);
      const outName = opts.outName || this._suggestDecName(file?.name || 'file');

      onLog(`Begin decryption of ${file.name} (${this._fmt(file.size)})`);
      const outStream = await this._createStreamingWritable(outName, file.size, 'application/octet-stream').catch(e => {
        onLog(`save canceled or sink unavailable: ${e?.message ?? e}`);
        throw this._soft('SaveCanceled', 'Save was canceled or streaming sink unavailable.');
      });

      const aborter = this._wireAbort(opts.signal, outStream);

      const prog = this._makeProgressReporter({
        total: file.size,
        interval: this.cfg.progressInterval,
        onTick: onProgress,
        onFinal: ({ transferred }) => onLog(`Read ${this._fmt(transferred)} of ciphertext`),
      });
      prog.start();

      try {
        await file.stream()
          .pipeThrough(this._chunker(chunkSize, n => prog.add(n)))
          .pipeThrough(dec)
          .pipeTo(outStream);

        prog.stop('complete');
        await this._finalizeWritable(outStream, { graceMs: this.cfg.iosFinalizeGraceMs });
        await this._closeIfPossible(outStream);

        const result = { ok: true, outName, bytesIn: file.size };
        this._finish(null, result);
        aborter?.cleanup();
        onLog('Decryption complete');
        passphrase = null;
        return result;
      } catch (inner) {
        prog.stop('error');
        await this._abortIfPossible(outStream, inner);
        aborter?.cleanup();
        passphrase = null;
        throw inner;
      }
    } catch (e) {
      passphrase = null;
      this._finish(e);
      throw e;
    }
  }

  /**
   * Optional helper: enforce your Safari large-file policy *before* calling encrypt/decrypt.
   * (No modal here; you can show your own UI if false is returned.)
   */
  guardSafariLargeFile(file) {
    if (!this.isSafari()) return true;
    return !(Number.isFinite(file?.size) && file.size > this.cfg.safariLargeFileLimit);
  }

  /** Read-only snapshot of last operation state (for debugging/telemetry). */
  get state() {
    return { ...this._state };
  }

  /** Apply configuration updates at runtime. */
  updateConfig(patch = {}) {
    Object.assign(this.cfg, patch || {});
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers (environment / sinks / progress / utils)
  // ────────────────────────────────────────────────────────────────────────────

  _enter(op) {
    this._state = { op, busy: true, lastError: null, lastResult: null };
  }
  _finish(err, result = null) {
    this._state.busy = false;
    this._state.lastError = err || null;
    this._state.lastResult = result;
  }

  _soft(code, message) {
    const e = new Error(message);
    e.name = code;
    return e;
  }

  _initStreamSaver() {
    const w = globalThis;
    // Only if present
    if (w && w.streamSaver) {
      // Always set absolute URL; keeps SW scoped and prevents iOS naming quirks.
      try {
        const url = new URL(this.cfg.streamSaverMitmPath, globalThis.location?.href || '/').toString();
        w.streamSaver.mitm = url;
      } catch { /* noop */ }
    }
  }

  _supportsStreamSaver() {
    const w = globalThis;
    return !!(w && w.streamSaver && w.streamSaver.createWriteStream);
  }
  _streamingSinkAvailable() {
    const w = globalThis;
    // Prefer FS Access when available and not on iOS Safari.
    return (('showSaveFilePicker' in w) || this._supportsStreamSaver());
  }
  _assertStreamingAvailable() {
    if (!this._streamingSinkAvailable()) {
      throw this._soft(
        'NoStreamingSink',
        'A streaming sink is required. Use Chrome/Edge or include StreamSaver.'
      );
    }
  }

  async _createStreamingWritable(filename, size, mime = 'application/octet-stream') {
    const w = globalThis;
    if ('showSaveFilePicker' in w && !this._isiOS()) {
      const ext = (filename.match(/\.[a-z0-9]+$/i)?.[0] || '.bin').toLowerCase();
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'File', accept: { [mime || 'application/octet-stream']: [ext] } }],
        excludeAcceptAllOption: false,
      });
      return handle.createWritable(); // FileSystemWritableFileStream (pipeTo compatible in modern browsers)
    }
    if (this._supportsStreamSaver()) {
      return globalThis.streamSaver.createWriteStream(filename, { size });
    }
    throw new Error('No streaming sink available in this browser.');
  }

  async _writeHeader(outStream, header) {
    if (!header || header.byteLength === 0) return;

    // WritableStream path
    const writer = outStream?.getWriter?.();
    if (writer?.write) {
      await writer.write(header);
      writer.releaseLock();
      return;
    }

    // FileSystemWritableFileStream path (no getWriter): has .write()
    if (typeof outStream?.write === 'function') {
      await outStream.write(header);
      return;
    }

    // Fallback: prelude ReadableStream → outStream (and keep it open)
    const prelude = new ReadableStream({
      start(c) { c.enqueue(header); c.close(); }
    });
    await prelude.pipeTo(outStream, { preventClose: true });
  }

  _chunker(max, onBytes) {
    return new TransformStream({
      transform(chunk, ctl) {
        const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        for (let i = 0; i < u8.byteLength; i += max) {
          const sub = u8.subarray(i, i + max);
          onBytes?.(sub.byteLength);
          ctl.enqueue(sub);
        }
      }
    });
  }

  _makeProgressReporter({ total = 0, interval = 500, onTick, onFinal } = {}) {
    let transferred = 0, lastShown = -1, timer = null;
    const emit = (final = false) => {
      if (!final && transferred === lastShown) return;
      lastShown = transferred;
      const pct = total ? (transferred / total) * 100 : 0;
      onTick?.({ transferred, total, pct });
    };
    return {
      start() { if (!timer) timer = setInterval(() => emit(false), interval); },
      add(n) { transferred += n; },
      stop() { if (timer) { clearInterval(timer); timer = null; } emit(true); onFinal?.({ transferred, total }); }
    };
  }

  async _finalizeWritable(outStream, { graceMs = 800 } = {}) {
    // Best-effort: nudge writer to surface `closed`, then tiny iOS grace.
    try {
      if (outStream?.getWriter) {
        const w = outStream.getWriter();
        w.releaseLock(); // just to ensure closed promise exists
      }
    } catch { /* noop */ }
    if (this._isiOS()) await this._sleep(graceMs);
  }
  async _closeIfPossible(outStream) {
    if (typeof outStream?.close === 'function') {
      try { await outStream.close(); } catch { /* noop */ }
    }
  }
  async _abortIfPossible(outStream, reason) {
    if (typeof outStream?.abort === 'function') {
      try { await outStream.abort(reason); } catch { /* noop */ }
    }
  }

  _wireAbort(signal, outStream) {
    if (!signal) return null;
    const onAbort = () => {
      const err = new DOMException('Aborted', 'AbortError');
      // Abort downstream if possible
      this._abortIfPossible(outStream, err);
    };
    if (signal.aborted) onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    return { cleanup() { signal.removeEventListener('abort', onAbort); } };
  }

  _checkSignal(signal) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  }

  _isiOS() {
    if (typeof this.cfg.isiOSDetector === 'function') return !!this.cfg.isiOSDetector();
    const w = globalThis;
    const ua = w?.navigator?.userAgent || '';
    const touch = (w?.navigator?.maxTouchPoints || 0) > 1 && w?.navigator?.platform === 'MacIntel';
    return /iPad|iPhone|iPod/.test(ua) || touch;
  }

  isSafari() {
    const ua = globalThis?.navigator?.userAgent || '';
    return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Brave/i.test(ua);
  }

  _fmt(bytes) {
    if (!Number.isFinite(bytes)) return '-';
    const units = ['B','KB','MB','GB','TB'];
    const i = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(1024));
    const v = (bytes / Math.pow(1024, i));
    return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
    }

  _suggestEncName(n = 'file') { return `${n}.bin`; }
  _suggestDecName(name = 'file') {
    const lower = String(name).toLowerCase();
    if (lower.endsWith('.bin')) return name.slice(0, -4);
    return `${name}.decrypted`;
  }

  _safeAdd(a, b) {
    const x = Number.isFinite(a) ? a : 0;
    const y = Number.isFinite(b) ? b : 0;
    return x + y;
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}