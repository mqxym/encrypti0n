// EncryptionController.js
import { ElementHandler } from '../helpers/ElementHandler.js';
import { delay } from '../utils/misc.js';

/**
 * @abstract
 * @class EncryptionController
 * @classdesc
 * Base class for text/file encryption controllers.  
 * Defines the common interface and shared post-action behavior.
 */
export class EncryptionController {
  /**
   * @param {Object} services
   * @param {EncryptionService} services.encryption - Underlying encryption service.
   * @param {FormHandler} services.form - Form handler for input/output fields.
   * @param {ConfigManager} services.config - Configuration manager.
   */
  constructor(services) {
    /** @protected */ this.encryptionService = services.encryption;
    /** @protected */ this.formHandler = services.form;
    /** @protected */ this.configManager = services.config;
  }

  /**
   * Orchestrates the encryption or decryption action.
   *
   * @async
   * @abstract
   * @throws {Error} If not implemented by subclass.
   */
  async handleAction() {
    throw new Error("Method 'handleAction' not implemented.");
  }

  /**
   * Performs encryption on the current input.
   *
   * @async
   * @abstract
   * @returns {Promise<boolean>} True if encryption succeeded, false otherwise.
   * @throws {Error} If not implemented by subclass.
   */
  async handleEncryption() {
    throw new Error("Method 'handleEncryption' not implemented.");
  }

  /**
   * Performs decryption on the current input.
   *
   * @async
   * @abstract
   * @returns {Promise<boolean>} True if decryption succeeded, false otherwise.
   * @throws {Error} If not implemented by subclass.
   */
  async handleDecryption() {
    throw new Error("Method 'handleDecryption' not implemented.");
  }

  /**
   * Provides shared UI feedback after an encryption/decryption attempt.
   *
   * @async
   * @param {boolean} result - True if the last action succeeded.
   * @param {LaddaButtonManager} laddaManager - Manager for button loading indicators.
   * @returns {Promise<void>}
   */
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

  /**
   * Retrieves the encryption/decryption key from the form.
   *
   * @protected
   * @returns {{ key: string, hideKey: boolean }}
   *   - key: the plaintext key value  
   *   - hideKey: whether the masked field is in use
   */
  getKeyData() {
    const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    return {
      key: hideKey ? keyPassword : keyBlank,
      hideKey,
    };
  }
}