// FileEncryptionController.js

/**
 * @fileoverview
 * High-level controller for encrypting/decrypting one or more {@link File}
 * objects from the UI. It chooses between **in-memory** processing and
 * **streaming-to-disk** based on a runtime memory budget, updates progress
 * buttons (via Ladda), and exposes per-file download links or a combined ZIP.
 *
 * ### Processing strategy
 * - If the **total selected size** is **≤ `appState.state.memoryBudget`**:
 *   - Process **in-memory** (reads each file fully, produces a new `Blob`).
 *   - After 2+ successes, offer **“Download all as .zip”** (via global `JSZip`).
 * - If the total size is **> memory budget**:
 *   - Use **streaming** (File System Access API or StreamSaver) via
 *     {@link FileStreamService}, writing results directly to disk.
 *   - Shows “Downloaded: …” indicators (no in-memory blobs are kept).
 *   - On Safari, large streaming operations are blocked with an alert.
 *
 * ### Dependencies / assumptions
 * - Extends {@link EncryptionController} which provides:
 *   - `this.cryptit` ({@link Cryptit}) — library for file encryption/decryption.
 *   - `this.fileStreamService` — streaming sink helper.
 *   - `this.configManager`, `this.postActionHandling`, `this.insecurePasswordWarning`,
 *     `this.getKeyData()` and other controller utilities.
 * - UI helpers: {@link ElementHandler}, {@link LaddaButtonManager}, jQuery (`$`),
 *   and global `Swal` for alerts.
 * - ZIP support expects **global** `JSZip` (not imported here).
 */

import { EncryptionController } from './EncryptionController.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { formatBytes } from '../utils/fileUtils.js';
import { argon2Service } from '../ui/services/argon2Service.js';
import { Cryptit } from '../../../assets/libs/cryptit/cryptit.browser.min.js';
import { delay, middleString } from '../utils/misc.js';
import { FileOpsConstants } from '../constants/constants.js';
import appState from '../state/AppState.js';

/**
 * Batch item captured for ZIP assembly (in-memory mode).
 * @typedef {Object} BatchItem
 * @property {string} name - File name to use inside the archive.
 * @property {Blob} blob - The processed file blob.
 */

/**
 * Controller that orchestrates file selection, per-file encryption/decryption,
 * UI state updates, and optional ZIP bundling for multiple outputs.
 *
 * Below 150 MB (or more precisely: below the runtime memory budget from
 * `appState.state.memoryBudget`) the controller works in-memory and exposes
 * Blob-backed download links. Above that threshold it streams directly to disk.
 *
 * @extends EncryptionController
 */
export class FileEncryptionController extends EncryptionController {
  /**
   * @param {Object} services - Shared services passed to the base class.
   */
  constructor(services) {
    super(services);

    /**
     * Batch state accumulated over a single {@link handleAction} run.
     * @private
     * @type {{ items: BatchItem[], successCount: number, failCount: number, encrypted?: number, decrypted?: number }}
     */
    this._batchState = {
      items: /** @type {BatchItem[]} */([]),
      successCount: 0,
      failCount: 0
    };
  }

  /** @private */
  _resetBatchState() {
    this._batchState = { items: [], successCount: 0, failCount: 0, encrypted: 0, decrypted: 0 };
  }

  /**
   * Entry point triggered by the main “Encrypt / Decrypt” action button.
   *
   * 1. Reads user-selected files.
   * 2. Computes a total size and compares against the runtime memory budget
   *    (`appState.state.memoryBudget`).
   * 3. Routes to streaming or in-memory processing accordingly.
   * 4. Updates UI states, progress, and error/success signals.
   *
   * Safari guard: if the total size exceeds the budget **and** the browser is
   * Safari, the user is prompted to switch to a supported browser for streaming.
   *
   * @override
   * @returns {Promise<void>}
   */
  async handleAction() {
    
    this.laddaManagerAction = new LaddaButtonManager('.action-button').startAll();
    
    try {
      this._resetBatchState();
      ElementHandler.buttonRemoveStatusAddText('downloadFiles');
      ElementHandler.hide('downloadFiles');

      /** @type {HTMLInputElement} */
      this.inputFilesElem = $('#inputFiles')[0];
      const fileLength = this.inputFilesElem.files.length;

      const totalSize = Array.from(this.inputFilesElem.files).reduce((acc, f) => acc + f.size, 0);
      const { memoryBudget } = appState.state;
      const SIZE_LIMIT = memoryBudget;

      if (totalSize > SIZE_LIMIT && this.fileStreamService.isSafari()) {
        await Swal.fire({
          icon: 'error',
          title: 'File Size Limit Exceeded',
          html: `The total selected file size is <b>${formatBytes(totalSize)}</b>, which exceeds the ${formatBytes(SIZE_LIMIT)} limit for your browser. Please switch to a supported browser to process files directly to disk. <br><br> Supported browsers: Chrome (Android / Desktop), Firefox (Desktop), Edge (Desktop)`,
          confirmButtonText: 'OK',
        });
        // stop Ladda buttons and return early
        this.laddaManagerAction.stopAll();
        return;
      }
      $('#outputFiles').empty();

      if (fileLength === 0) {
        ElementHandler.arrowsToCross();
        $('#outputFiles').text('Encryption / Decryption failed. Please check data or password.');
        // Note: using the active ladda manager for consistency
        await this.postActionHandling(false, this.laddaManagerAction);
        return;
      }

      if (totalSize > SIZE_LIMIT) {
        await this.processAboveStreamingLimit();
      } else {
        await this.processBelowStreamingLimit();
      }

    } catch (error) {
      this.laddaManagerAction.stopAll();
      ElementHandler.arrowsToCross();
      ElementHandler.buttonRemoveTextAddFail('downloadFiles');
      ElementHandler.hide('downloadFiles');
    }
  }

  /**
   * Streaming path for large selections (total size > memory budget).
   *
   * Each file is inspected with {@link Cryptit.isEncrypted} to decide whether
   * to encrypt or decrypt. The actual work is delegated to
   * {@link encryptFileStream} / {@link decryptFileStream}.
   *
   * The controller pipes progress updates into the Ladda buttons.
   *
   * @returns {Promise<void>}
   */
  async processAboveStreamingLimit() {
    let result = false;
    
    for (let file of this.inputFilesElem.files) {
      const isEncrypted = await Cryptit.isEncrypted(file);
      this.laddaManagerAction.setProgressAll(0);
      
      /** @type {(p:{transferred:number,total:number,pct:number})=>void} */
      this.onProgressStream = ({ transferred, total, pct }) => {
        this.laddaManagerAction.setProgressAll(pct.toFixed(1)*0.01);
      };
      if (isEncrypted) {
        await delay(150);
        result = await this.decryptFileStream(file);
        if (!result) ElementHandler.arrowsToCross();
      } else {
        await delay(150);
        result = await this.encryptFileStream(file);
        if (!result) ElementHandler.arrowsToCross();
      }
    }

    await this.postActionHandling(result, this.laddaManagerAction);
  }
  
  /**
   * Encrypt a single file using streaming sinks (no in-memory Blob produced).
   *
   * - Derives Argon2 settings from the current configuration.
   * - Uses {@link FileStreamService.encryptFile} to stream directly to disk.
   * - On success, appends a “Downloaded: …” indicator (no href).
   *
   * @param {File} file - Source file to encrypt.
   * @returns {Promise<boolean>} Resolves `true` on success, `false` on failure.
   */
  async encryptFileStream(file) {
    const { key } = this.getKeyData();
    if (!key) return false;
    this.insecurePasswordWarning(key);
    const outputFilesDiv = document.getElementById('outputFiles');

    try {
      const usedOptions = await argon2Service.getCurrentOptions(this.configManager);
      this.cryptit.setDifficulty(usedOptions.roundDifficulty);
      this.cryptit.setSaltDifficulty(usedOptions.saltDifficulty);

      await this.fileStreamService.encryptFile(file, key, {onProgress: this.onProgressStream});
      
      const name = `${file.name}.bin`;
      this._appendDownloadLink('', `Downloaded: ${middleString(name)}`, null, 'bg-pink', outputFilesDiv);
      return true;
    } catch (err) {
      this._appendDownloadLink('', `FAILED: ${middleString(file.name)}`, null, 'bg-secondary', outputFilesDiv);
      return false;
    }
  }

  /**
   * Decrypt a single file using streaming sinks (no in-memory Blob produced).
   *
   * - Streams the ciphertext to a plaintext sink on disk.
   * - On success, appends a “Downloaded: …” indicator (no href).
   *
   * @param {File} file - Encrypted input (`.bin`) to decrypt.
   * @returns {Promise<boolean>} Resolves `true` on success, `false` on failure.
   */
  async decryptFileStream(file) {
    const { key } = this.getKeyData();
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length || !key) return false;
    const outputFilesDiv = document.getElementById('outputFiles');
    const downloadName = file.name.replace(/\.bin$/i, '');

    try {
      await this.fileStreamService.decryptFile(file, key, {onProgress: this.onProgressStream});
      this._appendDownloadLink('', `Downloaded: ${middleString(downloadName)}`, null, 'bg-blue', outputFilesDiv);
      return true;
    } catch (err) {
      this._appendDownloadLink('', `FAILED: ${middleString(downloadName)}`, null, 'bg-secondary', outputFilesDiv);
      return false;
    }
  }

  /**
   * In-memory path for smaller selections (total size ≤ memory budget).
   *
   * For each input file:
   * - Detects whether it is already encrypted.
   * - Calls {@link handleEncryption} or {@link handleDecryption}.
   * - Updates per-item and overall Ladda progress.
   *
   * After processing, if there were 2+ successes, shows a button to build a ZIP.
   *
   * @returns {Promise<void>}
   */
  async processBelowStreamingLimit () {
    let result = false;
    let fileCounter = 0;
    const fileLength = this.inputFilesElem.files.length;
    
    for (let file of this.inputFilesElem.files) {
      const isEncrypted = await Cryptit.isEncrypted(file);
      this.laddaManagerAction.setProgressAll(fileCounter / fileLength);
      if (isEncrypted) {
        await delay(150);
        result = await this.handleDecryption(file);
        if (!result) ElementHandler.arrowsToCross();
      } else {
        await delay(150);
        result = await this.handleEncryption(file);
        if (!result) ElementHandler.arrowsToCross();
      }
      ++fileCounter;
    }

    // If we have 2+ successful outputs, enable the ZIP download button
    if (this._batchState.successCount >= 2) {
      this._attachZipDownloadHandler(); // (re)bind click
      ElementHandler.show('downloadFiles');
      if (this._batchState.encrypted > this._batchState.decrypted) {
        ElementHandler.buttonClassBlueToPink('downloadFiles');
      } else {
        ElementHandler.buttonClassPinkToBlue('downloadFiles');
      }
    } else {
      ElementHandler.hide('downloadFiles');
    }

    await this.postActionHandling(result, this.laddaManagerAction);
  }

  /**
   * Encrypt a single file in-memory and append a Blob-backed download link.
   *
   * Records the blob for optional ZIP bundling.
   *
   * @param {File} file - Plaintext input.
   * @returns {Promise<boolean>} Resolves `true` on success, `false` on failure.
   */
  async handleEncryption(file) {
    const { key } = this.getKeyData();
    if (!key) return false;
    this.insecurePasswordWarning(key);
    const outputFilesDiv = document.getElementById('outputFiles');
    try {
      const usedOptions = await argon2Service.getCurrentOptions(this.configManager);
      this.cryptit.setDifficulty(usedOptions.roundDifficulty);
      this.cryptit.setSaltDifficulty(usedOptions.saltDifficulty);

      const blob = await this.cryptit.encryptFile(file, key);
      const size = formatBytes(blob.size);
      const name = `${file.name}.bin`;
      this._appendDownloadLink(name, `${middleString(name)} | ${size}`, blob, 'bg-pink', outputFilesDiv);

      // record for batch zip
      this._batchState.items.push({ name, blob });
      this._batchState.successCount += 1;
      this._batchState.encrypted +=1;
      return true;
    } catch (err) {
      this._appendDownloadLink('', `FAILED: ${middleString(file.name)}`, null, 'bg-secondary', outputFilesDiv);
      this._batchState.failCount += 1;
      return false;
    }
  }

  /**
   * Decrypt a single `.bin` file in-memory and append a Blob-backed link.
   *
   * Records the blob for optional ZIP bundling.
   *
   * @param {File} file - Ciphertext input (`.bin`).
   * @returns {Promise<boolean>} Resolves `true` on success, `false` on failure.
   */
  async handleDecryption(file) {
    const { key } = this.getKeyData();
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length || !key) return false;
    const outputFilesDiv = document.getElementById('outputFiles');

    try {
      const decryptedBytes = await this.cryptit.decryptFile(file, key);
      const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
      const size = formatBytes(blob.size);
      if (blob.size === 0) return false;
      const downloadName = file.name.replace(/\.bin$/i, '');
      this._appendDownloadLink(downloadName, `${middleString(downloadName)} | ${size}`, blob, 'bg-blue', outputFilesDiv);

      // record for batch zip
      this._batchState.items.push({ name: downloadName, blob });
      this._batchState.successCount += 1;
      this._batchState.decrypted +=1;
      return true;
    } catch (err) {
      this._appendDownloadLink('', `FAILED: ${middleString(file.name)}`, null, 'bg-secondary', outputFilesDiv);
      this._batchState.failCount += 1;
      return false;
    }
  }

  /**
   * Append a Bootstrap-styled download link or status indicator to a container.
   *
   * - If `blob` is provided, the link is a download link backed by a Blob URL.
   * - If `blob` is `null`, the link is a non-clickable status badge.
   * - The Blob URL (if any) is revoked shortly after the user clicks the link.
   *
   * @param {string}      downloadName   Exact filename for download.
   * @param {string}      downloadText   Link text / status text.
   * @param {Blob|null}   blob           Blob to download, or `null` on failure/status.
   * @param {string}      bgColorClass   e.g. `"bg-primary"`, `"bg-pink"`, `"bg-blue"`.
   * @param {HTMLElement} parentDiv      Container element.
   * @private
   */
  _appendDownloadLink(downloadName, downloadText, blob, bgColorClass, parentDiv) {
    const link = document.createElement('a');
    let url = null;

    if (blob !== null) {
      url = URL.createObjectURL(blob);
      link.href = url;
      link.download = downloadName;
    }

    link.textContent = downloadText;
    link.className = ['btn', 'btn-sm', 'mb-1', bgColorClass, 'text-white', 'rounded-pill', 'me-1'].join(' ');
    parentDiv.appendChild(link);

    if (url) {
      link.addEventListener('click', () => {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    }
  }

  // -----------------------------
  // ZIP building & download (JSZip)
  // -----------------------------

  /**
   * Attach the click handler for the “Download all as .zip” button.
   *
   * Debounces by removing previous listeners, then generates a ZIP on click.
   * Uses a temporary Ladda manager for button-local progress.
   *
   * @private
   */
  _attachZipDownloadHandler() {
    ElementHandler.removeHandler('downloadFiles'); // remove old listeners
    const btn = document.getElementById('downloadFiles');

    btn.addEventListener('click', async () => {
      const laddaManager = new LaddaButtonManager('#downloadFiles').startAll();

      await delay(150);
      try {
        ElementHandler.buttonRemoveStatusAddText('downloadFiles');

        await this._buildAndOfferZip();

        ElementHandler.buttonRemoveTextAddSuccess('downloadFiles');
      } catch (e) {
        ElementHandler.buttonRemoveTextAddFail('downloadFiles');
      } finally {
        laddaManager.stopAll();
        setTimeout(() => {
          ElementHandler.buttonRemoveStatusAddText('downloadFiles');
        }, 1500);
      }
    });
  }

  /**
   * Build a `.zip` archive **in-memory** (using global `JSZip`) and trigger a download.
   *
   * - Skips if fewer than two successful outputs are available.
   * - Uses DEFLATE with compression level **5** (balance of time/size).
   *
   * @private
   * @returns {Promise<void>}
   */
  async _buildAndOfferZip() {
    if (this._batchState.successCount < 2 || this._batchState.items.length < 2) return;

    const zip = new JSZip();

    // Add each successfully processed Blob to the archive (root)
    for (const item of this._batchState.items) {
      zip.file(item.name, item.blob);
    }

    // Produce a Blob
    // See: https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 }
    });

    const name = `download_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;

    this._downloadBlobAsFile(zipBlob, name);
  }

  /**
   * Trigger a file download for a given Blob by creating a temporary anchor.
   *
   * @param {Blob} blob
   * @param {string} filename
   * @private
   */
  _downloadBlobAsFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // Ensure it works in all browsers
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}