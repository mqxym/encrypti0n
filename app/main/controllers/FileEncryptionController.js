// FileEncryptionController.js
import { EncryptionController } from './EncryptionController.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { formatBytes } from '../utils/fileUtils.js';
import { argon2Service } from '../ui/services/argon2Service.js';
import { Cryptit } from '../../../assets/libs/cryptit/cryptit.browser.min.js';
import { delay, middleString } from '../utils/misc.js';
import { FileOpsConstants } from '../constants/constants.js';

/**
 * @class FileEncryptionController
 * @extends EncryptionController
 * @classdesc
 * Handles encryption and decryption of File objects in fixed-size chunks,
 * updating the UI with download links for each result.
 * 
 * 
 * Below 150mb: in context browser download with zip download function
 * Above 150mb: 
 * - only streaming support via FileStreamHelper ( show availability in UI)
 * - warning for unsupported (safari), no processing
 * 
 *
 * Extended: collects processed files and offers a single ZIP download (JSZip).
 */
export class FileEncryptionController extends EncryptionController {
  /**
   * @param {Object} services - Shared services (encryption, form, config).
   */
  constructor(services) {
    super(services);

    /** @private Batch state for current handleAction() run */
    this._batchState = {
      items: /** @type {{ name: string, blob: Blob }[]} */([]),
      successCount: 0,
      failCount: 0
    };
  }

  /** @private */
  _resetBatchState() {
    this._batchState = { items: [], successCount: 0, failCount: 0, encrypted: 0, decrypted: 0 };
  }

  /**
   * Reads selected files, determines for each whether to encrypt or decrypt,
   * and processes them sequentially.
   *
   * When ≥ 2 files succeed, the “Download all as .zip” button is shown and wired.
   *
   * @async
   * @override
   * @returns {Promise<void>}
   */
  async handleAction() {
    
    this.laddaManagerAction = new LaddaButtonManager('.action-button').startAll();
    
    try {
      this._resetBatchState();
      ElementHandler.buttonRemoveStatusAddText('downloadFiles');
      ElementHandler.hide('downloadFiles');

      this.inputFilesElem = $('#inputFiles')[0];
      const fileLength = this.inputFilesElem.files.length;

      const totalSize = Array.from(this.inputFilesElem.files).reduce((acc, f) => acc + f.size, 0);
      const SIZE_LIMIT = FileOpsConstants.STREAM_ENCRYPTION_MIN_SIZE;
      
      if (totalSize > SIZE_LIMIT && this.fileStreamService.isSafari()) {
        await Swal.fire({
          icon: 'error',
          title: 'File Size Limit Exceeded',
          html: `The total selected file size is <b>${formatBytes(totalSize)}</b>, which exceeds the 150 MB limit for Safari browser. Please switch to a supported browser to process files directly to disk. <br><br> Supported browsers: Chrome (Android / Desktop), Firefox (Desktop), Edge (Desktop)`,
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
        await this.postActionHandling(false, laddaManager);
        return;
      }

      if (totalSize > SIZE_LIMIT) {
        await this.processAbove150mb();
      } else {
        await this.processBelow150mb();
      }

    } catch (error) {
      this.laddaManagerAction.stopAll();
      console.log(error);
      ElementHandler.arrowsToCross();
      ElementHandler.buttonRemoveTextAddFail('downloadFiles');
      ElementHandler.hide('downloadFiles');
    }
  }

  /**
   * Reads selected files, determines for each whether to encrypt or decrypt,
   * and processes them sequentially via 
   * stream processing (StreamSaver.js or showSaveFilePicker)
   *
   *
   * @async
   * @override
   * @returns {Promise<void>}
   */

  async processAbove150mb() {
    let result = false;
    
    for (let file of this.inputFilesElem.files) {
      const isEncrypted = await Cryptit.isEncrypted(file);
      this.laddaManagerAction.setProgressAll(0);
      
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
   * Encrypts a single via cryptit stream capabilities as a .bin File and records a download indicator of the result. 
   *
   * @async
   * @param {File} file - The raw file to encrypt.
   * @returns {Promise<boolean>} True on success, false on failure.
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
      console.log(err);
      this._appendDownloadLink('', `FAILED: ${middleString(file.name)}`, null, 'bg-secondary', outputFilesDiv);
      return false;
    }
  }

  /**
   * Decrypts a single via cryptit stream capabilities as a .bin File and records a download indicator of the result. 
   *
   * @async
   * @param {File} file - The encrypted file to decrypt.
   * @returns {Promise<boolean>} True on success, false on failure.
   */
  async decryptFileStream(file) {
    const { key } = this.getKeyData();
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length || !key) return false;
    const outputFilesDiv = document.getElementById('outputFiles');

    try {
      await this.fileStreamService.decryptFile(file, key, {onProgress: this.onProgressStream});
      const downloadName = file.name.replace(/\.bin$/i, '');
      this._appendDownloadLink('', `Downloaded: ${middleString(downloadName)}`, null, 'bg-blue', outputFilesDiv);
      return true;
    } catch (err) {
      console.log(err);
      this._appendDownloadLink('', `FAILED: ${middleString(downloadName)}`, null, 'bg-secondary', outputFilesDiv);
      return false;
    }
  }

  async processBelow150mb () {
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
   * Encrypts a single File, then appends a download link to the UI and records it.
   *
   * @async
   * @param {File} file - The file to encrypt.
   * @returns {Promise<boolean>} True on success, false on failure.
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
      this._appendDownloadLink('', `FAILED: ${fmiddleString(file.name)}`, null, 'bg-secondary', outputFilesDiv);
      this._batchState.failCount += 1;
      return false;
    }
  }

  /**
   * Decrypts a single .bin File and appends a download link of the result. Records it.
   *
   * @async
   * @param {File} file - The encrypted file to decrypt.
   * @returns {Promise<boolean>} True on success, false on failure.
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
   * Appends a Bootstrap-styled download link to a container.
   * (Fixed a scoping bug with `url` so it can be revoked.)
   *
   * @param {string}      downloadName   – exact filename for download
   * @param {string}      downloadText   – link text
   * @param {Blob|null}   blob           – Blob to download, or null on failure
   * @param {string}      bgColorClass   – e.g. "bg-primary"
   * @param {HTMLElement} parentDiv      – container element
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
   * Attaches the click handler for the “Download all as .zip” button.
   * Debounces by cloning the button first to remove previous handlers.
   * Uses an optional parameter to allow encrypted zip later (disabled by default).
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
   * Builds a .zip in-memory and triggers a download.
   *
   *
   * @private
   */
  async _buildAndOfferZip() {
    if (this._batchState.successCount < 2 || this._batchState.items.length < 2) return;

    const zip = new JSZip();

    // Add each successfully processed Blob to the archive (root)
    for (const item of this._batchState.items) {
      zip.file(item.name, item.blob);
    }

    // Produce a Blob using DEFLATE level 9 (best compression).
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
   * Triggers a file download for a given Blob.
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