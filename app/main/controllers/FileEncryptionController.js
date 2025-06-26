// FileEncryptionController.js
import { EncryptionController } from './EncryptionController.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { formatBytes } from '../utils/fileUtils.js';
import { argon2Service } from '../ui/services/argon2Service.js';
/**
 * @class FileEncryptionController
 * @extends EncryptionController
 * @classdesc
 * Handles encryption and decryption of File objects in fixed-size chunks,
 * updating the UI with download links for each result.
 */
export class FileEncryptionController extends EncryptionController {
  /**
   * @param {Object} services - Shared services (encryption, form, config).
   */
  constructor(services) {
    super(services);
  }

  /**
   * Reads selected files, determines for each whether to encrypt or decrypt,
   * and processes them sequentially.
   *
   * @async
   * @override
   * @returns {Promise<void>}
   */
  async handleAction() {
    const laddaManager = new LaddaButtonManager('.action-button').startAll();
    try {
      const inputFilesElem = $('#inputFiles')[0];
      const fileLength = inputFilesElem.files.length;
      let result = false;
      let fileCounter = 0;
      $('#outputFiles').empty();

      if (fileLength === 0) {
        ElementHandler.arrowsToCross();
        $('#outputFiles').text('Encryption / Decryption failed. Please check data or password.');
        await this.postActionHandling(false, laddaManager);
        return;
      }

      for (let file of inputFilesElem.files) {
        const isEncrypted = await this.encryptionService.isEncryptedFile(file);
        laddaManager.setProgressAll(fileCounter / fileLength);
        if (isEncrypted) {
          result = await this.handleDecryption(file);
          if (!result) ElementHandler.arrowsToCross();
        } else {
          result = await this.handleEncryption(file);
          if (!result) ElementHandler.arrowsToCross();
        }
        ++fileCounter;
      }
      await this.postActionHandling(result, laddaManager);
    } catch (error) {
      laddaManager.stopAll();
      ElementHandler.arrowsToCross();
    }
  }

  /**
   * Encrypts a single File using AES-GCM and Argon2 options,
   * then appends a download link to the UI.
   *
   * @async
   * @param {File} file - The file to encrypt.
   * @returns {Promise<boolean>} True on success, false on failure.
   */
  async handleEncryption(file) {
    const { key } = this.getKeyData();
    if (!key) return false;
    this.insecurePasswordWarning(key);
    const algo = 'aesgcm';
    const outputFilesDiv = document.getElementById('outputFiles');
    try {
      const usedOptions = await argon2Service.getCurrentOptions(this.configManager);
      this.encryptionService.setargon2Difficulty(usedOptions.roundDifficulty);
      this.encryptionService.setSaltLengthDifficulty(usedOptions.saltDifficulty);

      const blob = await this.encryptionService.encryptFile(file, key, algo);
      const size = formatBytes(blob.size);
      this._appendDownloadLink(`${file.name}.bin`, `${file.name}.bin | ${size}`, blob, 'bg-pink', outputFilesDiv);
      return true;
    } catch (err) {
      this._appendDownloadLink('',`FAILED: ${file.name}`,  null, 'bg-secondary', outputFilesDiv);
      return false;
    }
  }

  /**
   * Decrypts a single .bin File and appends a download link of the result.
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
      const decryptedBytes = await this.encryptionService.decryptFile(file, key);
      const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
      const size = formatBytes(blob.size);
      if (blob.size === 0) return false;
      const downloadName = file.name.replace('.bin', '');
      this._appendDownloadLink(downloadName, `${downloadName} | ${size}`, blob, 'bg-blue', outputFilesDiv);
      return true;
    } catch (err) {
      this._appendDownloadLink('',`FAILED: ${file.name}`,  null, 'bg-secondary', outputFilesDiv);
      return false;
    }
  }

  /**
   * Appends a Bootstrap-styled download link to a container.
   *
   * @param {string}      downloadName   – the exact text for the download filename
   * @param {string}      downloadText   – the exact text for the link 
   * @param {Blob}        blob           – the Blob or File to download
   * @param {string}      bgColorClass   – Bootstrap bg-color class (e.g. "bg-primary")
   * @param {HTMLElement} parentDiv      – container element to append the link into
   */
  _appendDownloadLink(downloadName, downloadText, blob, bgColorClass, parentDiv) {
    const link = document.createElement('a');

    if (blob !== null) {
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = downloadName;
    }

    link.textContent = downloadText;
    link.className = ['btn', 'btn-sm', 'mb-1', bgColorClass, 'text-white', 'rounded-pill', 'me-1'].join(' ');

    parentDiv.appendChild(link);

    link.addEventListener('click', () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
}
