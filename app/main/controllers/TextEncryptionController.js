// TextEncryptionController.js
import { EncryptionController } from './EncryptionController.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { argon2Service } from '../ui/services/argon2Service.js';
import { delay } from '../utils/misc.js';
import { Cryptit } from '../../../assets/libs/cryptit/cryptit.browser.min.js';

/**
 * @class TextEncryptionController
 * @extends EncryptionController
 * @classdesc
 * Handles encryption and decryption of text inputs, updating the output field.
 */
export class TextEncryptionController extends EncryptionController {
  /**
   * @param {Object} services - Shared services (encryption, form, config).
   */
  constructor(services) {
    super(services);
  }

  /**
   * Determines if the input text is encrypted or plaintext,
   * invokes the appropriate handler, and provides UI feedback.
   *
   * @async
   * @override
   * @returns {Promise<void>}
   */
  async handleAction() {
    const { inputText } = this.formHandler.formValues;
    const laddaManager = new LaddaButtonManager('.action-button').startAll().setProgressAll(0.75);

    try {
      const isEncrypted = await Cryptit.isEncrypted(inputText);
      let result = false;

      if (isEncrypted) {
        await delay(150);
        result = await this.handleDecryption();
        laddaManager.setProgressAll(1);
        if (!result) {
          ElementHandler.arrowsToCross();
          this.formHandler.setFormValue('outputText', null);
          ElementHandler.setPlaceholderById('outputText', 'Decryption failed. Please check data or password.');
        }
      } else {
        await delay(150);
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
    }
  }

  /**
   * Encrypts the text from the input field and sets the Base64 output.
   *
   * @async
   * @override
   * @returns {Promise<boolean>} True on success, false on failure.
   */
  async handleEncryption() {
    const { inputText } = this.formHandler.formValues;
    let { key } = this.getKeyData();
    if (!inputText || !key) return false;
    this.insecurePasswordWarning(key);

    try {
      const usedOptions = await argon2Service.getCurrentOptions(this.configManager);
      this.cryptit.setDifficulty(usedOptions.roundDifficulty);
      this.cryptit.setSaltDifficulty(usedOptions.saltDifficulty);
      const encrypted = await this.cryptit.encryptText(inputText, key);
      const encryptedB64 = encrypted.base64;
      this.formHandler.setFormValue('outputText', encryptedB64);
      encrypted.clear();
      return true;
    } catch (err) {
      return false;
    } finally {
      key = null;
      this.formHandler.setFormValue('inputText', '');
    }
  }

  /**
   * Decrypts the Base64 input and sets the plaintext output.
   *
   * @async
   * @override
   * @returns {Promise<boolean>} True on success, false on failure.
   */
  async handleDecryption() {
    const { inputText } = this.formHandler.formValues;
    let { key } = this.getKeyData();
    if (!inputText || !key) return false;
    let decrypted;

    try {
      decrypted = await this.cryptit.decryptText(inputText, key);
      this.formHandler.setFormValue('outputText', decrypted.text);
      decrypted.clear();
      return true;
    } catch (error) {
      return false;
    } finally {
      key = null;
    }
  }
}