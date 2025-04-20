import { ElementHandler } from '../helpers/ElementHandler.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { argon2Service } from '../services/argon2Service.js';
import { delay } from '../utils/misc.js';
import appState from '../state/AppState.js';

export class TextEncryptionController {
    constructor(services) {
      this.encryptionService = services.encryption;
      this.formHandler = services.form;
      this.configManager = services.config;
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
          appState.setState({isEncrypting : false});
        }
    }
  
    async handleEncryption() {
          const { inputText, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
          const passphrase = hideKey ? keyPassword : keyBlank;
          if (!inputText || !passphrase) return false;
          const algo = 'aesgcm';
          try {
            const usedOptions = await argon2Service.getCurrentOptions(this.configManager);
            this.encryptionService.setargon2Difficulty(usedOptions.roundDifficulty);
            this.encryptionService.setSaltLengthDifficulty(usedOptions.saltDifficulty);
            const encryptedB64 = await this.encryptionService.encryptText(inputText, passphrase, algo);
            this.formHandler.setFormValue('outputText', encryptedB64);
            return true;
          } catch (err) {
            return false;
          }
    }
  
    async handleDecryption() {
        const { inputText, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
        const passphrase = hideKey ? keyPassword : keyBlank;
        if (!inputText || !passphrase) return false;
        try {
          const decrypted = await this.encryptionService.decryptText(inputText, passphrase);
          this.formHandler.setFormValue('outputText', decrypted);
          return true;
        } catch (error) {
          return false;
        }
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

      delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
  }