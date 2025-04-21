import { EncryptionController } from './EncryptionController.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { argon2Service } from '../services/argon2Service.js';
import appState from '../state/AppState.js';

export class TextEncryptionController extends EncryptionController {
  constructor(services) {
    super(services);
  }

  async handleAction() {
    const { inputText } = this.formHandler.formValues;
    const laddaManager = new LaddaButtonManager('.action-button');
    laddaManager.startAll();
    laddaManager.setProgressAll(0.75);

    try {
      const isEncrypted = await this.encryptionService.isEncrypted(inputText);
      let result = false;
      if (isEncrypted) {
        result = await this.handleDecryption();
        laddaManager.setProgressAll(1);
        if (!result) {
          ElementHandler.arrowsToCross();
          this.formHandler.setFormValue('outputText', null);
          ElementHandler.setPlaceholderById('outputText', 'Decryption failed. Please check data or password.');
        }
      } else {
        result = await this.handleEncryption();
        laddaManager.setProgressAll(1);
        if (!result) {
          ElementHandler.arrowsToCross();
          this.formHandler.setFormValue('outputText', null);
          ElementHandler.setPlaceholderById('outputText', 'Encryption failed. Please check data or password.');
        }
      }
      await this.postActionHandling(result, laddaManager);
    } catch (error) {
      laddaManager.stopAll();
      ElementHandler.arrowsToCross();
    } finally {
      appState.setState({ isEncrypting: false });
    }
  }

  async handleEncryption() {
    const { inputText } = this.formHandler.formValues;
    const { key } = this.getKeyData();
    if (!inputText || !key) return false;
    const algo = 'aesgcm';
    try {
      const usedOptions = await argon2Service.getCurrentOptions(this.configManager);
      this.encryptionService.setargon2Difficulty(usedOptions.roundDifficulty);
      this.encryptionService.setSaltLengthDifficulty(usedOptions.saltDifficulty);
      const encryptedB64 = await this.encryptionService.encryptText(inputText, key, algo);
      this.formHandler.setFormValue('outputText', encryptedB64);
      return true;
    } catch (err) {
      return false;
    }
  }

  async handleDecryption() {
    const { inputText } = this.formHandler.formValues;
    const { key } = this.getKeyData();
    if (!inputText || !key) return false;
    try {
      const decrypted = await this.encryptionService.decryptText(inputText, key);
      this.formHandler.setFormValue('outputText', decrypted);
      return true;
    } catch (error) {
      return false;
    }
  }
}
