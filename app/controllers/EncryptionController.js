import { ElementHandler } from '../helpers/ElementHandler.js';
import { delay } from '../utils/misc.js';

export class EncryptionController {
  constructor(services) {
    this.encryptionService = services.encryption;
    this.formHandler = services.form;
    this.configManager = services.config;
  }

  async handleAction() {
    throw new Error("Method 'handleAction' not implemented.");
  }

  async handleEncryption() {
    throw new Error("Method 'handleEncryption' not implemented.");
  }

  async handleDecryption() {
    throw new Error("Method 'handleDecryption' not implemented.");
  }

  async postActionHandling(result, laddaManager) {
    if (result) {
      laddaManager.stopAll();
      ElementHandler.arrowsToCheck();
      await delay(2500);
      ElementHandler.checkToArrows();
    } else {
      laddaManager.stopAll();
      await delay(2500);
      ElementHandler.crossToArrows();
    }
  }

  getKeyData() {
    const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    return {
      key: hideKey ? keyPassword : keyBlank,
      hideKey,
    };
  }
}
