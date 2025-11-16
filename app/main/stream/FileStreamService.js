// FileStreamService.js

/**
 * @fileoverview
 * High-level streaming helpers to encrypt/decrypt large {@link File} objects
 * directly to disk using the File System Access API (`showSaveFilePicker`)
 * when available, or falling back to the StreamSaver polyfill.
 *
 * The class is transport-agnostic: it relies on an injected `cryptit` object
 * that exposes two Web-Streams-compatible primitives for symmetric encryption:
 *
 * - `createEncryptionStream(passphrase)` → `{ header, writable, readable }`
 * - `createDecryptionStream(passphrase)` → `TransformStream`
 *
 * This design keeps memory usage bounded (data is chunked and piped), supports
 * progress reporting, and allows user-initiated cancellation via `AbortSignal`.
 *
 * ## Browser support
 * - **Preferred:** File System Access API (`window.showSaveFilePicker`)
 * - **Fallback:** `window.streamSaver` (ensure `streamSaver.mitm` is configured)
 *
 * ## Errors
 * - `"SaveCanceled"` — user canceled the save dialog or sink unavailable
 * - `"NoStreamingSink"` — neither FS Access nor StreamSaver is available
 * - `"AbortError"` — operation aborted through the provided `AbortSignal`
 *
 * None of the errors intentionally leak sensitive material. Streams are
 * best-effort aborted/closed on failure paths.
 */

/* eslint-disable no-underscore-dangle */

//
// ──────────────────────────────────────────────────────────────────────────────
// Public typedefs (for consumers)
// ──────────────────────────────────────────────────────────────────────────────
/**
 * A minimal encryption API expected by {@link FileStreamService}.
 * Implementations must be Web Streams–compatible.
 *
 * @typedef {Object} CryptitAPI
 * @property {(passphrase: string) => Promise<{
 *   header: Uint8Array,
 *   writable: WritableStream<Uint8Array>,
 *   readable: ReadableStream<Uint8Array>
 * }>} createEncryptionStream
 *   Creates a duplex encryption pipeline. Plaintext is written to `writable`,
 *   ciphertext is read from `readable`. A binary `header` (e.g., metadata like
 *   salt/nonce) must be prepended to the output file.
 * @property {(passphrase: string) => Promise<TransformStream<Uint8Array, Uint8Array>>} createDecryptionStream
 *   Creates a transform that accepts ciphertext (including the header in the
 *   incoming stream) and outputs plaintext bytes.
 */

/**
 * Options used to construct {@link FileStreamService}.
 *
 * @typedef {Object} FileStreamServiceOptions
 * @property {string} [streamSaverMitmPath='/assets/streamsaver/mitm.html']
 *   Absolute or relative URL to StreamSaver's `mitm.html` (same-origin).
 * @property {number} [chunkSize=65536]
 *   Chunk size (bytes) used by the internal chunker before feeding crypto.
 * @property {number} [progressInterval=400]
 *   Progress callback cadence in milliseconds.
 * @property {number} [iosFinalizeGraceMs=800]
 *   Small delay applied on iOS to help the system surface the “downloaded”
 *   state after stream completion.
 * @property {number} [safariLargeFileLimit=500*1024*1024]
 *   Size threshold used by {@link guardSafariLargeFile} to warn/block very
 *   large files on Safari. Not enforced unless you call that method.
 * @property {() => boolean} [isiOSDetector]
 *   Optional override used by internal iOS detection.
 */

/**
 * Progress payload emitted by `onProgress`.
 *
 * @typedef {Object} ProgressTick
 * @property {number} transferred - Bytes processed so far.
 * @property {number} total - Total bytes expected.
 * @property {number} pct - Percentage in range `[0, 100]`.
 */

/**
 * Per-operation options for {@link encryptFile}.
 *
 * @typedef {Object} EncryptOptions
 * @property {string} [outName]
 *   Suggested output filename. Default is `<inputName>.bin`.
 * @property {string} [mime='application/octet-stream']
 *   MIME used with the save dialog when using FS Access.
 * @property {AbortSignal} [signal]
 *   When aborted, the operation stops quickly (best effort) and the sink is
 *   aborted/closed.
 * @property {(p: ProgressTick) => void} [onProgress]
 *   Called on a timed interval and at completion.
 * @property {(line: string) => void} [onLog]
 *   Human-readable logs for UI/telemetry.
 * @property {number} [chunkSize]
 *   Optional per-call override of the service's `chunkSize`.
 */

/**
 * Per-operation options for {@link decryptFile}.
 *
 * @typedef {Object} DecryptOptions
 * @property {string} [outName]
 *   Suggested output filename. Default derived from input (drops `.bin` if
 *   present, otherwise appends `.decrypted`).
 * @property {AbortSignal} [signal]
 * @property {(p: ProgressTick) => void} [onProgress]
 * @property {(line: string) => void} [onLog]
 * @property {number} [chunkSize]
 */

/**
 * Result returned by {@link encryptFile}.
 *
 * @typedef {Object} EncryptResult
 * @property {true} ok
 * @property {string} outName - Final output filename suggestion used.
 * @property {number} bytesIn - Size of input plaintext file.
 * @property {number} bytesOut - Size of output (header + ciphertext).
 */

/**
 * Result returned by {@link decryptFile}.
 *
 * @typedef {Object} DecryptResult
 * @property {true} ok
 * @property {string} outName - Final output filename suggestion used.
 * @property {number} bytesIn - Size of input ciphertext file.
 */

//
// ──────────────────────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────────────────────
export default class FileStreamService {
  /**
   * Create a new streaming helper.
   *
   * @param {CryptitAPI} cryptit
   *   Instance that creates Web-Streams-compatible crypto pipelines.
   * @param {FileStreamServiceOptions} [options]
   *
   * @throws {Error} If `cryptit` is not provided.
   *
   * @example
   * const svc = new FileStreamService(cryptit, {
   *   streamSaverMitmPath: '/assets/streamsaver/mitm.html',
   * });
   */
  constructor(cryptit, options = {}) {
    if (!cryptit) throw new Error('FileCryptoHelper: cryptit instance is required');
    /** @type {CryptitAPI} */
    this.cryptit = cryptit;

    /** @type {Required<FileStreamServiceOptions>} */
    this.cfg = {
      streamSaverMitmPath: '/assets/streamsaver/mitm.html',
      chunkSize: 65536,
      progressInterval: 400,
      iosFinalizeGraceMs: 800,
      safariLargeFileLimit: 500 * 1024 * 1024,
      isiOSDetector: null,
      ...options,
    };

    /**
     * Ephemeral state (useful for debugging/telemetry).
     * @type {{ op: 'idle'|'encrypt'|'decrypt', busy: boolean, lastError: any, lastResult: any }}
     * @private
     */
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
   * Encrypt a single {@link File} and stream ciphertext to disk.
   *
   * The pipeline is:
   * ```
   * file.stream()
   *   → chunker(chunkSize)
   *   → cryptit.createEncryptionStream(passphrase).writable
   *   → cryptit.createEncryptionStream(passphrase).readable
   *   → disk (FS Access or StreamSaver)
   * ```
   * The encryption `header` is written **first** to the output sink.
   *
   * @param {File} file - Plaintext file to encrypt.
   * @param {string} passphrase - Symmetric passphrase.
   * @param {EncryptOptions} [opts]
   * @returns {Promise<EncryptResult>}
   *
   * @throws {Error} `"NoStreamingSink"` if neither FS Access nor StreamSaver is available.
   * @throws {Error} `"SaveCanceled"` if user cancels or sink cannot be created.
   * @throws {DOMException} `"AbortError"` if `opts.signal` is aborted.
   *
   * @example
   * const ac = new AbortController();
   * const result = await svc.encryptFile(file, 'secret', {
   *   outName: `${file.name}.bin`,
   *   signal: ac.signal,
   *   onProgress: ({ pct }) => console.log(`Encrypting… ${pct.toFixed(1)}%`),
   *   onLog: console.log,
   * });
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
      /** @type {WritableStream|FileSystemWritableFileStream} */
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

        /** @type {EncryptResult} */
        const result = { ok: true, outName, bytesIn: file.size, bytesOut: totalOut };
        this._finish(null, result);
        aborter?.cleanup();
        onLog('Encryption complete');
        passphrase = null; // cleanup reference
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
   * Decrypt a single {@link File} and stream plaintext to disk.
   *
   * The pipeline is:
   * ```
   * file.stream()
   *   → chunker(chunkSize)
   *   → cryptit.createDecryptionStream(passphrase)
   *   → disk (FS Access or StreamSaver)
   * ```
   *
   * @param {File} file - Ciphertext file to decrypt (includes the crypto header).
   * @param {string} passphrase - Symmetric passphrase used for encryption.
   * @param {DecryptOptions} [opts]
   * @returns {Promise<DecryptResult>}
   *
   * @throws {Error} `"NoStreamingSink"` if neither FS Access nor StreamSaver is available.
   * @throws {Error} `"SaveCanceled"` if user cancels or sink cannot be created.
   * @throws {DOMException} `"AbortError"` if `opts.signal` is aborted.
   *
   * @example
   * const result = await svc.decryptFile(encFile, 'secret', {
   *   onProgress: ({ pct }) => console.log(`Decrypting… ${pct.toFixed(1)}%`),
   *   onLog: console.log,
   * });
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
      /** @type {WritableStream|FileSystemWritableFileStream} */
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

        /** @type {DecryptResult} */
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
   * Optional helper: enforce a Safari large-file policy *before* calling
   * {@link encryptFile} or {@link decryptFile}.
   *
   * This method **does not** show UI; return value is intended to let the
   * caller present a custom prompt or block the operation.
   *
   * @param {File} file
   * @returns {boolean} `true` if allowed or non-Safari; `false` if the file
   *   exceeds {@link FileStreamServiceOptions.safariLargeFileLimit} on Safari.
   */
  guardSafariLargeFile(file) {
    if (!this.isSafari()) return true;
    return !(Number.isFinite(file?.size) && file.size > this.cfg.safariLargeFileLimit);
  }

  /**
   * Read-only snapshot of the last operation state.
   * Useful for telemetry or debug UIs.
   * @returns {{ op:'idle'|'encrypt'|'decrypt', busy:boolean, lastError:any, lastResult:any }}
   */
  get state() {
    return { ...this._state };
  }

  /**
   * Apply configuration updates at runtime.
   * Unknown keys are ignored by the implementation but stored in {@link cfg}.
   *
   * @param {Partial<FileStreamServiceOptions>} [patch]
   * @returns {void}
   */
  updateConfig(patch = {}) {
    Object.assign(this.cfg, patch || {});
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers (environment / sinks / progress / utils)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {'encrypt'|'decrypt'} op
   * @private
   */
  _enter(op) {
    this._state = { op, busy: true, lastError: null, lastResult: null };
  }

  /**
   * @private
   * @param {any} err
   * @param {any} [result=null]
   */
  _finish(err, result = null) {
    this._state.busy = false;
    this._state.lastError = err || null;
    this._state.lastResult = result;
  }

  /**
   * Create a soft, typed error (non-fatal classification).
   * @private
   * @param {string} code
   * @param {string} message
   * @returns {Error}
   */
  _soft(code, message) {
    const e = new Error(message);
    e.name = code;
    return e;
  }

  /**
   * Configure `streamSaver.mitm` when StreamSaver is present.
   * Uses an absolute URL to keep SW scoped and avoid iOS naming quirks.
   * @private
   * @returns {void}
   */
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

  /**
   * @private
   * @returns {boolean}
   */
  _supportsStreamSaver() {
    const w = globalThis;
    return !!(w && w.streamSaver && w.streamSaver.createWriteStream);
  }

  /**
   * Whether any streaming file sink is available.
   * Prefers FS Access when not on iOS, else StreamSaver.
   * @private
   * @returns {boolean}
   */
  _streamingSinkAvailable() {
    const w = globalThis;
    // Prefer FS Access when available and not on iOS Safari.
    return (('showSaveFilePicker' in w) || this._supportsStreamSaver());
  }

  /**
   * Ensure a streaming sink is available.
   * @private
   * @throws {Error} `"NoStreamingSink"`
   */
  _assertStreamingAvailable() {
    if (!this._streamingSinkAvailable()) {
      throw this._soft(
        'NoStreamingSink',
        'A streaming sink is required. Use Chrome/Edge or include StreamSaver.'
      );
    }
  }

  /**
   * Create a {@link WritableStream} to disk using FS Access or StreamSaver.
   *
   * @private
   * @param {string} filename
   * @param {number} size
   * @param {string} [mime='application/octet-stream']
   * @returns {Promise<WritableStream|FileSystemWritableFileStream>}
   */
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

  /**
   * Write the crypto header to the output stream, keeping it open for subsequent data.
   * Handles different writable interfaces (WritableStream vs FileSystemWritableFileStream).
   * @private
   * @param {WritableStream|FileSystemWritableFileStream} outStream
   * @param {Uint8Array} header
   * @returns {Promise<void>}
   */
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

  /**
   * Create a TransformStream that splits incoming chunks into sub-chunks of `max` bytes.
   * Calls `onBytes` with the size of each emitted sub-chunk (for progress).
   * @private
   * @param {number} max
   * @param {(n:number)=>void} [onBytes]
   * @returns {TransformStream<Uint8Array, Uint8Array>}
   */
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

  /**
   * Timed progress reporter for streaming operations.
   * @private
   * @param {{ total?: number, interval?: number, onTick?: (p: ProgressTick)=>void, onFinal?: (p: {transferred:number,total:number})=>void }} [arg]
   * @returns {{ start: ()=>void, add:(n:number)=>void, stop:(state?: 'complete' | 'error')=>void }}
   */
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

  /**
   * Best-effort finalization to help iOS surface the “downloaded” state.
   * @private
   * @param {WritableStream|FileSystemWritableFileStream} outStream
   * @param {{ graceMs?: number }} [opts]
   * @returns {Promise<void>}
   */
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

  /**
   * @private
   * @param {WritableStream|FileSystemWritableFileStream} outStream
   * @returns {Promise<void>}
   */
  async _closeIfPossible(outStream) {
    if (typeof outStream?.close === 'function') {
      try { await outStream.close(); } catch { /* noop */ }
    }
  }

  /**
   * @private
   * @param {WritableStream|FileSystemWritableFileStream} outStream
   * @param {any} reason
   * @returns {Promise<void>}
   */
  async _abortIfPossible(outStream, reason) {
    if (typeof outStream?.abort === 'function') {
      try { await outStream.abort(reason); } catch { /* noop */ }
    }
  }

  /**
   * Wire an AbortSignal to abort the underlying sink if possible.
   * @private
   * @param {AbortSignal} signal
   * @param {WritableStream|FileSystemWritableFileStream} outStream
   * @returns {{ cleanup: ()=>void } | null}
   */
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

  /**
   * Throw if the AbortSignal is already aborted.
   * @private
   * @param {AbortSignal} signal
   */
  _checkSignal(signal) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  }

  /**
   * Heuristic iOS detection (with override).
   * @private
   * @returns {boolean}
   */
  _isiOS() {
    if (typeof this.cfg.isiOSDetector === 'function') return !!this.cfg.isiOSDetector();
    const w = globalThis;
    const ua = w?.navigator?.userAgent || '';
    const touch = (w?.navigator?.maxTouchPoints || 0) > 1 && w?.navigator?.platform === 'MacIntel';
    return /iPad|iPhone|iPod/.test(ua) || touch;
  }

  /**
   * Best-effort Safari detection (excludes Chromium-based browsers).
   * @returns {boolean}
   */
  isSafari() {
    const ua = globalThis?.navigator?.userAgent || '';
    return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Brave/i.test(ua);
  }

  /**
   * Human-readable byte formatting (e.g., "12.3 MB").
   * @private
   * @param {number} bytes
   * @returns {string}
   */
  _fmt(bytes) {
    if (!Number.isFinite(bytes)) return '-';
    const units = ['B','KB','MB','GB','TB'];
    const i = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(1024));
    const v = (bytes / Math.pow(1024, i));
    return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
    }

  /**
   * Suggest an encrypted output filename (default: `<name>.bin`).
   * @private
   * @param {string} [n='file']
   * @returns {string}
   */
  _suggestEncName(n = 'file') { return `${n}.bin`; }

  /**
   * Suggest a decrypted output filename.
   * If the name ends with `.bin`, drop the extension; else append `.decrypted`.
   * @private
   * @param {string} [name='file']
   * @returns {string}
   */
  _suggestDecName(name = 'file') {
    const lower = String(name).toLowerCase();
    if (lower.endsWith('.bin')) return name.slice(0, -4);
    return `${name}.decrypted`;
  }

  /**
   * Safe numeric addition for possibly non-finite inputs.
   * @private
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  _safeAdd(a, b) {
    const x = Number.isFinite(a) ? a : 0;
    const y = Number.isFinite(b) ? b : 0;
    return x + y;
  }

  /**
   * @private
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}