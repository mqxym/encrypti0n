import { ElementHandler } from '../helpers/ElementHandler.js';
import { FormHandler } from '../helpers/FormHandler.js';
import { handleActionError, handleActionSuccess, wrapAction } from '../utils/controller.js';
import { pwGenWrapper } from '../passwordGenerator.js';
import { KeyManagementConstants } from '../constants/constants.js';

/**
 * @class KeyManagementController
 * @classdesc
 * Handles key generation, copying, loading, saving, renaming, and visibility toggling
 * for encryption keys within the application UI.
 */
export class KeyManagementController {
  /**
   * @param {Object} services
   * @param {Object} services.config - Configuration manager for persisting key slots.
   * @param {FormHandler} services.form - Form handler for reading and setting form values.
   */
  constructor(services) {
    /** @private */ this.configManager = services.config;
    /** @private */ this.formHandler = services.form;
    this.bindKeyManagementEvents();
  }

  /**
   * Binds UI events related to key management actions.
   *
   * @private
   * @returns {void}
   */
  bindKeyManagementEvents() {
    $('#renameSlotAction').on('click', () => this.changeSlotName());
    $('#keyGenerate').on('click', () => this.keyGenerate());
    $('#clearPassword').on('click', () => this.clearPassword());
    $('#keyCopy').on('click', () => this.keyCopy());
    $('#hideKey').on('change', () => this.toggleKey());
    $('#loadKey').on('click', () => this.loadKey());
    $('#saveKey').on('click', () => this.saveKey());
  }

  // ––––––– Key Management Methods –––––––

  /**
   * Generates a new random key, populates both blank and hidden key fields,
   * and displays success feedback.
   *
   * @async
   * @returns {Promise<void>}
   */
  async keyGenerate() {
    await wrapAction('keyGenerate', async () => {
      const randomKey = pwGenWrapper(
        KeyManagementConstants.KEY_LENGTH,
        KeyManagementConstants.ALLOWED_CHARACTERS
      );
      this.formHandler.setFormValue('keyBlank', randomKey);
      this.formHandler.setFormValue('keyPassword', randomKey);
      await handleActionSuccess('keyGenerate');
    });
  }

  /**
   * Copies the current key to the clipboard after validation
   * and displays success or error feedback.
   *
   * @async
   * @returns {Promise<void>}
   */
  async keyCopy() {
    await wrapAction('keyCopy',async () => {
      const { key } = this.getKeyData();
      try {
        this.validateKey(key);
        await navigator.clipboard.writeText(key);
        await handleActionSuccess('keyCopy');
      } catch (err) {
        await handleActionError('keyCopy');
      }
    });
  }

  /**
   * Toggles visibility between the masked password field and the plaintext field.
   *
   * @returns {void}
   */
  toggleKey() {
    if ($('#hideKey').is(':checked')) {
      ElementHandler.hide('keyBlank');
      ElementHandler.show('keyPassword');
      this.formHandler.setFormValue(
        'keyPassword',
        this.formHandler.formValues.keyBlank
      );
    } else {
      ElementHandler.hide('keyPassword');
      ElementHandler.show('keyBlank');
      this.formHandler.setFormValue(
        'keyBlank',
        this.formHandler.formValues.keyPassword
      );
    }
  }

  /**
   * Loads a key from the selected slot after validation,
   * populates form fields, and displays feedback.
   *
   * @async
   * @returns {Promise<void>}
   */
  async loadKey() {
    await wrapAction('loadKey', async () => {
      const { slot } = this.getKeyData();
      try {
        this.validateSlot(slot);
        const storedKey = await this.configManager.readSlotValue(slot);
        this.validateKey(storedKey);
        this.formHandler.setFormValue('keyBlank', storedKey);
        this.formHandler.setFormValue('keyPassword', storedKey);
        await handleActionSuccess('loadKey');
      } catch (error) {
        await handleActionError('loadKey');
      }
    });
  }

  /**
   * Saves the current key to the selected slot after validation
   * and displays success or error feedback.
   *
   * @async
   * @returns {Promise<void>}
   */
  async saveKey() {
    await wrapAction('saveKey', async () => {
      const { key, slot } = this.getKeyData();
      try {
        this.validateKeyInput(key, slot);
        await this.configManager.setSlotValue(slot, key);
        await handleActionSuccess('saveKey');
      } catch (err) {
        await handleActionError('saveKey');
      }
    });
  }


  /**
   * Clears both key input fields.
   *
   * @returns {void}
   */
  clearPassword() {
    this.formHandler.setFormValue('keyBlank', '');
    this.formHandler.setFormValue('keyPassword', '');
  }

  // ––––––– Validation Methods –––––––

  /**
   * Ensures the provided key is a non-empty string.
   *
   * @private
   * @param {*} key - The key value to validate.
   * @throws {Error} If the key is empty or not a string.
   */
  validateKey(key) {
    if (!key) {
      throw new Error('Key cannot be empty');
    }
    if (typeof key !== 'string') {
      throw new Error('Key must be a string');
    }
  }

  /**
   * Ensures the provided slot identifier is a non-empty string.
   *
   * @private
   * @param {*} slot - The slot value to validate.
   * @throws {Error} If the slot is empty or not a string.
   */
  validateSlot(slot) {
    if (!slot) {
      throw new Error('Slot cannot be empty');
    }
    if (typeof slot !== 'string') {
      throw new Error('Slot must be a string');
    }
  }

  /**
   * Validates both key and slot inputs.
   *
   * @private
   * @param {*} key - The key to validate.
   * @param {*} slot - The slot to validate.
   */
  validateKeyInput(key, slot) {
    this.validateKey(key);
    this.validateSlot(slot);
  }

  // ––––––– Helper Methods –––––––

  /**
   * Retrieves key-related form values, deciding which field to use
   * based on the hideKey toggle.
   *
   * @private
   * @returns {{ slot: string, key: string, hideKey: boolean }}
   */
  getKeyData() {
    const { keySlot, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    return {
      slot: keySlot,
      key: hideKey ? keyPassword : keyBlank,
      hideKey,
    };
  }
}