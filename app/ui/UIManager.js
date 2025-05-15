import { formatBytes } from '../utils/fileUtils.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import appState from '../state/AppState.js';
import { handleActionSuccess, handleActionError, wrapAction } from '../utils/controller.js';

/**
 * @class UIManager
 * @classdesc
 * Manages the application user interface: view toggles (text vs. file), input/output updates,
 * file listing, Argon2 options modal, and clipboard operations. Coordinates UI state with global appState.
 */
export class UIManager {
  /**
   * @param {Object} services
   * @param {FormHandler} services.form - Handler for form inputs/outputs.
   * @param {ConfigManager} services.config - Configuration manager for master password and slots.
   * @param {argon2Service} services.argon2 - Service for Argon2 difficulty options.
   * @param {StorageService} services.storage - Local storage service for UI preferences.
   * @param {EncryptionService} services.encryption - Encryption service for text/file operations.
   * @param {KeyManagementController} keyManagementController - Controller for key slot management.
   */
  constructor(services, keyManagementController) {
    /** @private */ this.formHandler = services.form;
    /** @private */ this.configManager = services.config;
    /** @private */ this.argon2Service = services.argon2;
    /** @private */ this.storageService = services.storage;
    /** @private */ this.encryptionService = services.encryption;
    /** @private */ this.keyManagementController = keyManagementController;
    this.bindEvents();
  }

  /**
   * Attaches event handlers for UI elements: view switches, file changes, Argon2 modal, etc.
   *
   * @private
   * @returns {void}
   */
  bindEvents() {
    $('#showTextEncryption').on('click', () => this.showTextInput());
    $('#showFilesEncryption').on('click', () => this.showFileInput());
    $('#inputFiles').on('change', () => this.updateFileList());
    $('#hideInformation').on('click', () => this.setInformationTab());
    $('#inputText').on('input', (event) => this.handleDataChange(event));
    $('#copyOutput').on('click', () => this.copyOutput());
    $('#clearInput').on('click', () => this.clearInput());
    $('#clearInputFiles').on('click', () => this.clearInputFiles());
    $('.Argon2-Options').on('click', () => $('#argon2-modal').modal('show'));
    $('#renameSlots').on('click', () => $('#renameSlotsModal').modal('show'));
  }

  /**
   * Initializes the UI on application start:
   * - Resets UI
   * - Shows decryption modal if master password is set
   * - Otherwise loads slots and Argon2 options
   *
   * @async
   * @returns {Promise<void>}
   */
  async initUI() {
    this.resetUIState();
    if (this.configManager.isUsingMasterPassword()) {
      this.handleMasterPasswordCase();
      return;
    }
    await this.initializeApplication();
  }

  /**
   * Disables encryption button and shows decryption modal when a master password exists.
   *
   * @private
   * @returns {void}
   */
  handleMasterPasswordCase() {
    ElementHandler.disable('encryptApplicationModal');
    $(document).off('click', '#encryptApplicationModal');
    $('#do-application-decryption').modal('show');
  }

  /**
   * Loads application data (slot names and Argon2 options); on failure, shows an error alert.
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async initializeApplication() {
    const initializationFailed = await this.loadApplicationData();
    if (initializationFailed) {
      await this.showInitializationError();
      return;
    }
    this.initializeKeyManagement();
  }

  /**
   * Reads slot names and Argon2 options; returns true if loading failed.
   *
   * @private
   * @async
   * @returns {Promise<boolean>}
   */
  async loadApplicationData() {
    try {
      const slotNames = await this.configManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, 'keySlot');
      await this.argon2Service.loadOptions();
      return false;
    } catch (err){
      return true;
    }
  }

  /**
   * Displays an error alert when application data cannot be decrypted.
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async showInitializationError() {
    await Swal.fire({
      icon: 'error',
      title: 'Failed to decrypt local data!',
      text: 'The data could be corrupted. Please try clearing all data.',
      showCancelButton: false,
      confirmButtonText: 'Ok',
    });
  }

  /**
   * Performs an initial key generation and toggles key visibility.
   *
   * @private
   * @returns {void}
   */
  initializeKeyManagement() {
    this.keyManagementController.keyGenerate();
    this.keyManagementController.toggleKey();
  }

  /**
   * Resets all UI fields and file listings to default state.
   *
   * @private
   * @returns {void}
   */
  resetUIState() {
    this.setInformationTab(false);
    this.formHandler.setFormValue('outputText', '');
    this.formHandler.setFormValue('inputText', '');
    this.clearFiles();
  }

  /**
   * Handles input text changes by updating encryption/decryption indicators.
   *
   * @private
   * @async
   * @param {Event} event - The input event containing the new text value.
   * @returns {Promise<void>}
   */
  async handleDataChange(event) {
    const inputText = event.target.value;
    const isEncrypted = await this.encryptionService.isEncrypted(inputText.trim());
    this.updateEncryptionState(isEncrypted);
  }

  /**
   * Updates UI styling and placeholders based on encryption state.
   *
   * @private
   * @param {boolean} isEncrypted - True if current input is encrypted.
   * @returns {void}
   */
  updateEncryptionState(isEncrypted) {
    if (isEncrypted) {
      ElementHandler.blueToPinkBorder('inputText');
      ElementHandler.pinkToBlueBorder('outputText');
      ElementHandler.emptyPillBlue('notEncryptedPill');
      ElementHandler.emptyPillBlue('notEncryptedFilesPill');
      ElementHandler.fillPillPink('encryptedPill');
      ElementHandler.fillPillPink('encryptedFilesPill');
      ElementHandler.buttonClassPinkToBlue('action-button');
      $('#outputText').attr('placeholder', 'The decryption result appears here');
      $('.action-explanation').text('decryption');
      $('.action-button').attr('data-bs-original-title', 'Decrypt with AES-GCM-256');
      $('#outputFooter').text('Decrypted output is UTF-8 formatted.');
    } else {
      ElementHandler.pinkToBlueBorder('inputText');
      ElementHandler.blueToPinkBorder('outputText');
      ElementHandler.fillPillBlue('notEncryptedPill');
      ElementHandler.fillPillBlue('notEncryptedFilesPill');
      ElementHandler.emptyPillPink('encryptedPill');
      ElementHandler.emptyPillPink('encryptedFilesPill');
      ElementHandler.buttonClassBlueToPink('action-button');
      $('#outputText').attr('placeholder', 'The encryption result appears here');
      $('.action-explanation').text('encryption');
      $('.action-button').attr('data-bs-original-title', 'Encrypt with AES-GCM-256');
      $('#outputFooter').text('Encrypted output is base64 formatted.');
    }
  }

  /**
   * Toggles visibility of the informational section and persists preference.
   *
   * @param {boolean} [toggle=true] - Whether to flip visibility state.
   * @returns {void}
   */
  setInformationTab(toggle = true) {
    const isCurrentlyHidden = this.storageService.getItem('encInfoHidden') === 'true';
    if (toggle) {
      const newHiddenState = !isCurrentlyHidden;
      this.storageService.setItem('encInfoHidden', newHiddenState.toString());
      newHiddenState ? $('.informationRow').hide() : $('.informationRow').show();
    } else {
      isCurrentlyHidden ? $('.informationRow').hide() : $('.informationRow').show();
    }
  }

  /**
   * Updates the file list display and sets encryption indicators accordingly.
   *
   * @async
   * @returns {Promise<void>}
   */
  async updateFileList() {
    const fileListElem = $('#fileList');
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length) {
      fileListElem.text('Selected files appear here...');
      return;
    }
    fileListElem.empty();
    const files = Array.from(inputFilesElem.files);
    const encryptionChecks = files.map(async (file) => {
      const isEncrypted = await this.encryptionService.isEncryptedFile(file);
      const badge = isEncrypted
        ? $('<span class="badge bg-pink rounded-pill me-1">').text(`${file.name} | ${formatBytes(file.size)}`)
        : $('<span class="badge bg-blue rounded-pill me-1">').text(`${file.name} | ${formatBytes(file.size)}`);
      fileListElem.append(badge);
      return isEncrypted;
    });
    const results = await Promise.all(encryptionChecks);
    if (results.every(Boolean)) {
      this.updateEncryptionState(true);
    }
  }

  /**
   * Shows the file-encryption UI panels and updates view state.
   *
   * @returns {void}
   */
  showFileInput() {
    ElementHandler.fillButtonGray('showFilesEncryption');
    ElementHandler.emptyButtonGray('showTextEncryption');
    ElementHandler.show('fileEncryptionInput');
    ElementHandler.hide('textEncryptionInput');
    ElementHandler.show('fileEncryptionOutput');
    ElementHandler.hide('textEncryptionOutput');
    this.updateFileList();
    appState.setState({ currentView: 'files' });
  }

  /**
   * Shows the text-encryption UI panels and updates view state.
   *
   * @returns {void}
   */
  showTextInput() {
    ElementHandler.emptyButtonGray('showFilesEncryption');
    ElementHandler.fillButtonGray('showTextEncryption');
    ElementHandler.hide('fileEncryptionInput');
    ElementHandler.show('textEncryptionInput');
    ElementHandler.show('textEncryptionOutput');
    ElementHandler.hide('fileEncryptionOutput');
    appState.setState({ currentView: 'text' });
  }

  /**
   * Clears the text input field and resets encryption indicators.
   *
   * @returns {void}
   */
  clearInput() {
    this.formHandler.setFormValue('inputText', '');
    this.handleDataChange({ target: { value: '' } });
  }

  /**
   * Clears the file input field and resets encryption indicators.
   *
   * @returns {void}
   */
    clearInputFiles() {
      $('#inputFiles').val('');
      $('#fileList').text('Selected files appear here...');

      this.updateEncryptionState(false);
    }

  /**
   * Clears password input fields (blank and masked).
   *
   * @returns {void}
   */
  clearPassword() {
    this.formHandler.setFormValue('keyBlank', '');
    this.formHandler.setFormValue('keyPassword', '');
  }

  /**
   * Clears selected files and resets file list/output placeholders.
   *
   * @returns {void}
   */
  clearFiles() {
    this.formHandler.setFormValue('inputFiles', '');
    $('#fileList').text('Selected files appear here...');
    $('#outputFiles').text('The encrypted files appears here');
  }

  /**
   * Resets key slot select to default placeholder names (Slot 1…Slot 10).
   *
   * @returns {void}
   */
  clearSlotNames() {
    const obj = {
      1: 'Slot 1', 2: 'Slot 2', 3: 'Slot 3', 4: 'Slot 4', 5: 'Slot 5',
      6: 'Slot 6', 7: 'Slot 7', 8: 'Slot 8', 9: 'Slot 9', 10: 'Slot 10',
    };
    ElementHandler.populateSelectWithSlotNames(obj, 'keySlot');
  }

  /**
   * Resets the entire UI: files, text, password fields, and slot names.
   *
   * @returns {void}
   */
  clearUI() {
    this.clearFiles();
    this.clearInput();
    this.clearPassword();
    this.clearSlotNames();
  }

  /**
   * Copies the output text to clipboard with validation and feedback.
   *
   * @async
   * @returns {Promise<void>}
   */
  async copyOutput() {
    await wrapAction(async () => {
      const { outputText } = this.formHandler.formValues;
      try {
        this.validateOutput(outputText);
        await navigator.clipboard.writeText(outputText);
        await handleActionSuccess('copyOutput');
      } catch {
        await handleActionError('copyOutput');
      }
    });
  }

  /**
   * Validates that the output text is a non-empty string.
   *
   * @private
   * @param {*} output - The value to validate.
   * @throws {Error} If output is empty or not a string.
   */
  validateOutput(output) {
    if (!output) {
      throw new Error('Output cannot be empty');
    }
    if (typeof output !== 'string') {
      throw new Error('Output must be a string');
    }
  }
}