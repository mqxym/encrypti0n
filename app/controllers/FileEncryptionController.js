import { EncryptionController } from './EncryptionController.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { formatBytes } from '../utils/fileUtils.js';
import { argon2Service } from '../services/argon2Service.js';
import appState from '../state/AppState.js';

export class FileEncryptionController extends EncryptionController {
  constructor(services) {
    super(services);
  }

  async handleAction() {
    const laddaManager = new LaddaButtonManager('.action-button');
    laddaManager.startAll();

    try {
      const inputFilesElem = $('#inputFiles')[0];
      const fileLength = inputFilesElem.files.length;
      let result = false;
      let fileCounter = 0;
      $('#outputFiles').empty();

      if (fileLength === 0) {
        ElementHandler.arrowsToCross();
        $('#outputFiles').html('Encryption / Decryption failed. Please check data or password.');
        await this.postActionHandling(false, laddaManager);
        return;
      }

      for (let file of inputFilesElem.files) {
        const isEncrypted = await this.encryptionService.isEncryptedFile(file);
        laddaManager.setProgressAll(fileCounter / fileLength);
        if (isEncrypted) {
          result = await this.handleDecryption(file);
          if (!result) {
            ElementHandler.arrowsToCross();
          }
        } else {
          result = await this.handleEncryption(file);
          if (!result) {
            ElementHandler.arrowsToCross();
          }
        }
        ++fileCounter;
      }
      await this.postActionHandling(result, laddaManager);
    } catch (error) {
      laddaManager.stopAll();
      ElementHandler.arrowsToCross();
    } finally {
      appState.setState({ isEncrypting: false });
    }
  }

  async handleEncryption(file) {
    const { key } = this.getKeyData();
    if (!key) {
      return false;
    }
    const algo = 'aesgcm';
    const outputFilesDiv = $('#outputFiles');
    try {
      const usedOptions = await argon2Service.getCurrentOptions(this.configManager);
      this.encryptionService.setargon2Difficulty(usedOptions.roundDifficulty);
      this.encryptionService.setSaltLengthDifficulty(usedOptions.saltDifficulty);
      const blob = await this.encryptionService.encryptFile(file, key, algo);
      const size = formatBytes(blob.size);
      const url = URL.createObjectURL(blob);
      const link = $('<a class="btn mb-1 btn-sm bg-pink text-white rounded-pill me-1">')
        .attr('href', url)
        .attr('download', file.name + '.bin')
        .text(`${file.name}.bin | ${size}`);
      outputFilesDiv.append(link);
      return true;
    } catch (err) {
      const link = $('<a class="btn mb-1 btn-sm bg-secondary text-white rounded-pill me-1">').text(
        `FAILED: ${file.name}`
      );
      outputFilesDiv.append(link);
      return false;
    }
  }

  async handleDecryption(file) {
    const { key } = this.getKeyData();
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length || !key) {
      return false;
    }
    const outputFilesDiv = $('#outputFiles');

    try {
      const decryptedBytes = await this.encryptionService.decryptFile(file, key);
      const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const size = formatBytes(blob.size);
      if (blob.size === 0) {
        return false;
      }
      const downloadName = file.name.replace('.enc', '');
      const link = $('<a class="btn mb-1 btn-sm bg-blue text-white rounded-pill me-1">')
        .attr('href', url)
        .attr('download', downloadName)
        .text(`${downloadName} | ${size}`);
      outputFilesDiv.append(link); //.append('<br/>');
      return true;
    } catch (err) {
      const link = $('<a class="btn mb-1 btn-sm bg-secondary text-white rounded-pill me-1">').text(
        `FAILED: ${file.name}`
      );
      outputFilesDiv.append(link);
      return false;
    }
  }
}
