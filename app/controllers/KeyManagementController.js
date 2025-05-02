import { ElementHandler } from '../helpers/ElementHandler.js';
import { FormHandler } from '../helpers/FormHandler.js';
import { handleActionError, handleActionSuccess, wrapAction } from '../utils/controller.js';
import { pwGenWrapper } from '../passwordGenerator.js';
import { KeyManagementConstants } from '../constants/constants.js';

export class KeyManagementController {
  constructor(services) {
    this.configManager = services.config;
    this.formHandler = services.form;
    this.bindKeyManagementEvents();
  }

  /**
   * Bind key management related events.
   * Includes key generation, storage, and manipulation.
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

  async keyGenerate() {
    await wrapAction(async () => {
      const randomKey = pwGenWrapper(KeyManagementConstants.KEY_LENGTH, KeyManagementConstants.ALLOWED_CHARACTERS);
      this.formHandler.setFormValue('keyBlank', randomKey);
      this.formHandler.setFormValue('keyPassword', randomKey);
      await handleActionSuccess('keyGenerate');
    });
  }

  async keyCopy() {
    await wrapAction(async () => {
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

  toggleKey() {
    if ($('#hideKey').is(':checked')) {
      ElementHandler.hide('keyBlank');
      ElementHandler.show('keyPassword');
      this.formHandler.setFormValue('keyPassword', this.formHandler.formValues.keyBlank);
    } else {
      ElementHandler.hide('keyPassword');
      ElementHandler.show('keyBlank');
      this.formHandler.setFormValue('keyBlank', this.formHandler.formValues.keyPassword);
    }
  }

  async loadKey() {
    await wrapAction(async () => {
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

  async saveKey() {
    await wrapAction(async () => {
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

  async changeSlotName() {
    await wrapAction(async () => {
      const formHandlerLocal = new FormHandler('newSlotForm');
      formHandlerLocal.preventSubmitAction();
      const { keySlotChange, slotName } = formHandlerLocal.getFormValues();
      try {
        this.validateSlotName(keySlotChange, slotName);
        await this.configManager.setSlotName(keySlotChange, slotName);
        const slotNames = await this.configManager.readSlotNames();
        ElementHandler.populateSelectWithSlotNames(slotNames, 'keySlot');
        await handleActionSuccess('renameSlotAction');
        $('#slotName').val('');
      } catch (error) {
        await handleActionError('renameSlotAction');
      }
    });
  }

  clearPassword() {
    this.formHandler.setFormValue('keyBlank', '');
    this.formHandler.setFormValue('keyPassword', '');
  }

  // ––––––– Validation Methods –––––––

  validateKey(key) {
    if (!key) {
      throw new Error('Key cannot be empty');
    }
    if (typeof key !== 'string') {
      throw new Error('Key must be a string');
    }
  }

  validateSlot(slot) {
    if (!slot) {
      throw new Error('Slot cannot be empty');
    }
    if (typeof slot !== 'string') {
      throw new Error('Slot must be a string');
    }
  }

  validateKeyInput(key, slot) {
    this.validateKey(key);
    this.validateSlot(slot);
  }

  validateSlotName(slot, name) {
    if (!name) {
      throw new Error('Slot name cannot be empty');
    }
    if (typeof name !== 'string') {
      throw new Error('Slot name must be a string');
    }
    if (name.length > KeyManagementConstants.MAX_SLOT_NAME_LENGTH) {
      throw new Error(`Slot name cannot exceed ${KeyManagementConstants.MAX_SLOT_NAME_LENGTH} characters`);
    }
    this.validateSlot(slot);
  }

  // ––––––– Helper Methods –––––––

  getKeyData() {
    const { keySlot, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    return {
      slot: keySlot,
      key: hideKey ? keyPassword : keyBlank,
      hideKey,
    };
  }
}
