import { formatBytes } from '../utils/fileUtils.js';
import { ElementHandler, EventBinder } from '../helpers/ElementHandler.js';
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
    /** @private */ this.slotService = services.slots;
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
    EventBinder.on('#showTextEncryption', 'click', () => this.showTextInput());
    EventBinder.on('#showFilesEncryption', 'click', () => this.showFileInput());
    EventBinder.on('#inputFiles', 'change', () => this.updateFileList());
    EventBinder.on('#hideInformation', 'click', () => this.setInformationTab());
    EventBinder.on('#inputText', 'input', (event) => this.handleDataChange(event));
    EventBinder.on('#copyOutput', 'click', () => this.copyOutput());
    EventBinder.on('#clearInput', 'click', () => this.clearInput());
    EventBinder.on('#clearInputFiles', 'click', () => this.clearInputFiles());
    EventBinder.on('.Argon2-Options', 'click', () => EventBinder.showModal('#argon2-modal'));
    EventBinder.on('#editSlots', 'click', async () => {
      await this.slotService.render();
      EventBinder.showModal('#editSlotsModal');
    });
    EventBinder.on('#encryptApplicationModal', 'click', () => this.handleAppEncryptModal());
    EventBinder.on('#importDataModal', 'click', () => EventBinder.showModal('#do-data-import'));
    EventBinder.on('#exportDataModal', 'click', () => EventBinder.showModal('#do-data-export'));
    EventBinder.on('#encryptApplicationPw', 'input', () =>
      this.showPasswordStrenght('encryptApplicationPw', 'password-strength', 'password-strength-text')
    );
    EventBinder.on('#exportDataPw', 'input', () =>
      this.showPasswordStrenght('exportDataPw', 'export-password-strength', 'export-password-strength-text')
    );
  }

  /**
   * Initializes the UI on application start:
   * - Resets UI
   * - Shows decryption modal if master password is set
   * - Otherwise loads slots and Argon2 options
   *
   * @public
   * @async
   * @returns {Promise<void>}
   */
  async initUI() {
    this.resetUIState();
    if (this.configManager.isUsingMasterPassword()) {
      this.handleMasterPasswordCase();
      ElementHandler.showModal('do-application-decryption');
      return;
    }
    await this.initializeApplication();
  }

  /**
   * Disables encryption button when a master password exists.
   *
   * @public
   * @returns {void}
   */
  handleMasterPasswordCase() {
    ElementHandler.disable('encryptApplicationModal');
    ElementHandler.removeHandler('encryptApplicationModal');
    ElementHandler.hide('export-no-masterpassword-set');
    ElementHandler.show('export-masterpassword-set');
    ElementHandler.disable('exportDataPw');
    ElementHandler.disable('exportDataPwConfirmation');
  }

  /**
   * Enables encryption button when a master password does not exist.
   *
   * @public
   * @returns {void}
   */
  handlePasswordlessCase() {
    ElementHandler.hide('removeApplicationEncryption');
    ElementHandler.show('encryptApplicationModal');
    ElementHandler.show('export-no-masterpassword-set');
    ElementHandler.hide('export-masterpassword-set');
    EventBinder.on('#encryptApplicationModal', 'click', () => this.handleAppEncryptModal());
  }

  /**
   * Loads application data (slot names and Argon2 options); on failure, shows an error alert.
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async initializeApplication() {
    this.handlePasswordlessCase();
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
    } catch (err) {
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
   * Opens the modal to initiate application encryption if not already encrypted.
   */
  handleAppEncryptModal() {
    if (this.configManager.isUsingMasterPassword()) return;
    ElementHandler.showModal('do-application-encryption');
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
      document.getElementById('outputText').setAttribute('placeholder', 'The decryption result appears here');
      document.querySelectorAll('.action-explanation').forEach(el => el.textContent = 'decryption');
      document.querySelectorAll('.action-button').forEach(el => el.setAttribute('data-bs-original-title', 'Decrypt with AES-GCM-256'));
      document.getElementById('outputFooter').textContent = 'Decrypted output is UTF-8 formatted.';
    } else {
      ElementHandler.pinkToBlueBorder('inputText');
      ElementHandler.blueToPinkBorder('outputText');
      ElementHandler.fillPillBlue('notEncryptedPill');
      ElementHandler.fillPillBlue('notEncryptedFilesPill');
      ElementHandler.emptyPillPink('encryptedPill');
      ElementHandler.emptyPillPink('encryptedFilesPill');
      ElementHandler.buttonClassBlueToPink('action-button');
      document.getElementById('outputText').setAttribute('placeholder', 'The encryption result appears here');
      document.querySelectorAll('.action-explanation').forEach(el => el.textContent = 'encryption');
      document.querySelectorAll('.action-button').forEach(el => el.setAttribute('data-bs-original-title', 'Encrypt with AES-GCM-256'));
      document.getElementById('outputFooter').textContent = 'Encrypted output is base64 formatted.';
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
    this.formHandler.setFormValue('inputFiles', '');
    document.getElementById('fileList').textContent = 'Selected files appear here...';

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
    document.getElementById('fileList').textContent = 'Selected files appear here...';
    document.getElementById('outputFiles').textContent = 'The encrypted files appears here';
  }

  /**
   * Resets key slot select to default placeholder names (Slot 1…Slot 5).
   *
   * @returns {void}
   */
  clearSlotNames() {
    const obj = {
      1: 'Slot 1',
      2: 'Slot 2',
      3: 'Slot 3',
      4: 'Slot 4',
      5: 'Slot 5',
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
    this.slotService.resetModal();
  }

  /**
   * Copies the output text to clipboard with validation and feedback.
   *
   * @async
   * @returns {Promise<void>}
   */
  async copyOutput() {
    await wrapAction('copyOutput', async () => {
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

  /**
   * Updates the visual strength indicator and label for a password input.
   *
   * Retrieves the value of the password field, computes its strength level,
   * and adjusts a progress bar’s width, color class, and accompanying text
   * to reflect "Very Weak", "Weak", "Medium", or "Strong".
   *
   * @param {string} pwFieldId - The DOM id of the password input element.
   * @param {string} barId     - The DOM id of the progress bar element.
   * @param {string} textId    - The DOM id of the text label element.
   * @returns {void}
   */

  showPasswordStrenght(pwFieldId, barId, textId) {
    const password = document.getElementById(pwFieldId).value;
    const strength = checkPasswordStrength.passwordStrength(password).id;

    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);

    // Remove previous strength classes
    bar.classList.remove('bg-danger', 'bg-warning', 'bg-info', 'bg-success');

    // Set based on strength level
    switch (strength) {
      case 0:
        bar.style.width = '10%';
        bar.classList.add('bg-danger');
        text.textContent = 'Strength: Very Weak';
        break;
      case 1:
        bar.style.width = '35%';
        bar.classList.add('bg-danger');
        text.textContent = 'Strength: Weak';
        break;
      case 2:
        bar.style.width = '65%';
        bar.classList.add('bg-warning');
        text.textContent = 'Strength: Medium';
        break;
      case 3:
        bar.style.width = '100%';
        bar.classList.add('bg-success');
        text.textContent = 'Strength: Strong';
        break;
    }
  }
}
