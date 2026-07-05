// UIManager.js

/**
 * @fileoverview
 * The UI orchestration layer for the app. This manager wires DOM controls,
 * listens to user actions (view switches, file selection, clipboard, modals),
 * and coordinates state with {@link appState}. It also calculates and displays
 * a per-device memory budget that decides whether file operations are handled
 * **in-memory** (with Blob-backed downloads and optional ZIP bundling) or
 * **streamed to disk** (via File System Access API / StreamSaver through the
 * FileStreamService instance supplied by the base controller).
 *
 * Key responsibilities:
 * - Bind UI events to controller operations.
 * - Render selected files, sizes, and encryption state badges.
 * - Toggle between Text and File views and update explanatory hints/tooltips.
 * - Initialize application data (slot names, Argon2 options).
 * - Show app-encryption / import / export modals when requested.
 * - Manage a device-aware memory budget and surface it in the UI.
 *
 * ### External dependencies (globals / environment)
 * - jQuery (`$`) for simple DOM queries and text updates.
 * - `Swal` (SweetAlert2) for user-friendly modals.
 * - `checkPasswordStrength` global for password strength scoring.
 *
 * ### Notes
 * - This class does not perform encryption itself; it delegates to services
 *   provided by the base controller and other modules.
 */

import { formatBytes } from '../utils/fileUtils.js';
import { ElementHandler, EventBinder } from '../helpers/ElementHandler.js';
import appState from '../state/AppState.js';
import { handleActionSuccess, handleActionError, wrapAction } from '../utils/controller.js';
import { Cryptit } from '../../../assets/libs/cryptit/cryptit.browser.min.js';
import { middleString } from '../utils/misc.js';
import getInMemoryProcessingBudgetBytes from '../utils/memoryBudget.js';

/**
 * Service bag expected by {@link UIManager}'s constructor.
 * Only the fields used directly here are listed. Additional fields may be
 * present and consumed by other layers.
 *
 * @typedef {Object} UIManagerServices
 * @property {FormHandler} form - Adapter for getting/setting form control values.
 * @property {ConfigManager} config - Manages master password and key slots.
 * @property {argon2Service} argon2 - Loads and exposes Argon2 difficulty options.
 * @property {SlotsService} slots - Renders/controls the key slot management modal.
 * @property {StorageService} storage - Simple key/value storage for UI preferences.
 * @property {EncryptionService} encryption - Text/file crypto operations (indirect).
 * @property {FileStreamService} fss - Streaming sink helper (used for Safari checks).
 */

/**
 * @class UIManager
 * @classdesc
 * Manages the application user interface: view toggles (text vs. file), input/output
 * updates, file listing, Argon2 options modal, and clipboard operations. Coordinates
 * UI state with global {@link appState}.
 */
export class UIManager {
  /**
   * Create the UI manager and wire required services.
   *
   * @param {UIManagerServices} services
   * @param {KeyManagementController} keyManagementController - Controller for slot generation/toggling.
   */
  constructor(services, keyManagementController) {
    /** @private */ this.formHandler = services.form;
    /** @private */ this.configManager = services.config;
    /** @private */ this.argon2Service = services.argon2;
    /** @private */ this.slotService = services.slots;
    /** @private */ this.storageService = services.storage;
    /** @private */ this.keyManagementController = keyManagementController;
    /** @private */ this.fileStreamService = services.fss;
    this.bindEvents();
    
    /** @private */ this.passwordStrengthTimers = {};
    /** @private */ this.passwordStrengthCache = {};
  }

  /**
   * Attach event handlers for UI elements: view switches, file changes, modals, etc.
   *
   * DOM IDs/classes referenced:
   * - `#showTextEncryption`, `#showFilesEncryption` — view toggles.
   * - `#inputFiles` — `<input type="file">` for multi-file selection.
   * - `#hideInformation` — toggle the information panel visibility.
   * - `#inputText` — plaintext / ciphertext input area.
   * - `#copyOutput`, `#clearInput`, `#clearInputFiles` — actions.
   * - `#argon2-modal`, `#editSlotsModal`, `#do-data-import`, etc. — modals.
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
    EventBinder.on('#changeMasterPasswordModal', 'click', () => {
      if (this.configManager.isLocked()) return;
      EventBinder.showModal('#do-masterpassword-rotation')
    });
    EventBinder.on('#exportDataModal', 'click', () => EventBinder.showModal('#do-data-export'));
    EventBinder.on('#encryptApplicationPw', 'input', () =>
      this.showPasswordStrenght('encryptApplicationPw', 'password-strength', 'password-strength-text')
    );
    EventBinder.on('#newApplicationMPw', 'input', () =>
      this.showPasswordStrenght('newApplicationMPw', 'password-strength-rotate', 'password-strength-rotate-text')
    );
    EventBinder.on('#exportDataPw', 'input', () =>
      this.showPasswordStrenght('exportDataPw', 'export-password-strength', 'export-password-strength-text')
    );
  }

  /**
   * Initialize UI at app startup:
   * - Reset UI state.
   * - Compute and store the device-aware memory budget.
   * - Show browser-specific size limit hints.
   * - If a master password is configured, prompt for decryption; otherwise
   *   load app data (slot names, Argon2 options) and initialize key management.
   *
   * @public
   * @async
   * @returns {Promise<void>}
   */
  async initUI() {
    this.resetUIState();

    appState.setState({memoryBudget: this.getMemoryBudget()})

    if (!this.fileStreamService.isSafari()) {
      ElementHandler.hide('sizeLimitSafari');
      ElementHandler.show('sizeLimitOther');
    } else {
      ElementHandler.show('sizeLimitSafari');
      ElementHandler.hide('sizeLimitOther');
    }

    if (this.configManager.isUsingMasterPassword()) {
      this.handleMasterPasswordCase();
      ElementHandler.showModal('do-application-decryption');
      return;
    }
    await this.initializeApplication();
  }

  /**
   * Calculate a conservative in-memory processing limit for this device.
   *
   * Uses {@link getInMemoryProcessingBudgetBytes} (which returns a safe upper
   * bound for transient processing) and then:
   * - halves it (≈/2.2) to leave extra headroom for JS objects & UI.
   * - rounds to the nearest 10 MB for user-facing presentation.
   *
   * @returns {number} A rounded byte budget (≥ 10 MB), suitable for total file size thresholds.
   *
   * @example
   * const budget = ui.getMemoryBudget();
   * document.querySelector('.device-max').textContent = formatBytes(budget);
   */
  getMemoryBudget() {
    const memoryBudget = Math.floor(getInMemoryProcessingBudgetBytes() / 2.2);
    const tenMB = 10 * 1024 * 1024;
    const memoryBudgetRounded= Math.round(memoryBudget / tenMB) * tenMB;
    return memoryBudgetRounded;
  }

  /**
   * Update UI to reflect that a master password is already set (locked mode).
   *
   * Disables controls that should not be used when the app is encrypted and
   * exposes options relevant to a locked state (export flows, rotation, etc.).
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
    ElementHandler.disable('rotatePasswordLessKeys');
    ElementHandler.hideClass('rotateInterface');
    ElementHandler.show('changeMasterPasswordModal');
  }

  /**
   * Update UI to reflect passwordless mode (no master password configured).
   *
   * Enables app-encryption entry points and export flows that do not require
   * the master password.
   *
   * @public
   * @returns {void}
   */
  handlePasswordlessCase() {
    ElementHandler.hide('removeApplicationEncryption');
    ElementHandler.hide('changeMasterPasswordModal')
    ElementHandler.show('encryptApplicationModal');
    ElementHandler.show('export-no-masterpassword-set');
    ElementHandler.hide('export-masterpassword-set');
    ElementHandler.showClass('rotateInterface');
    EventBinder.on('#encryptApplicationModal', 'click', () => this.handleAppEncryptModal());
  }

  /**
   * Load application data (slot names and Argon2 options), with error handling
   * that shows a user-facing alert if decryption fails.
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
   * Read slot names and Argon2 options.
   *
   * @private
   * @async
   * @returns {Promise<boolean>} `false` on success; `true` if loading failed.
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
   * Show a generic initialization error modal (e.g., corrupted local data).
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
   * Perform an initial key generation and toggle key visibility in the UI.
   *
   * @private
   * @returns {void}
   */
  initializeKeyManagement() {
    this.keyManagementController.keyGenerate();
    this.keyManagementController.toggleKey();
  }

  /**
   * Reset high-level UI state to defaults: hide info panel, clear text and file fields.
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
   * Handle input text changes by checking whether the content is encrypted
   * (using {@link Cryptit.isEncrypted}) and updating placeholder styles and
   * button tooltips accordingly.
   *
   * @private
   * @async
   * @param {Event & { target: HTMLTextAreaElement }} event - Input event from the text area.
   * @returns {Promise<void>}
   */
  async handleDataChange(event) {
    const inputText = event.target.value;
    const isEncrypted = await Cryptit.isEncrypted(inputText.trim());
    this.updateEncryptionState(isEncrypted);
  }

  /**
   * Open the app-encryption modal if the app is not already protected by a master password.
   *
   * @returns {void}
   */
  handleAppEncryptModal() {
    if (this.configManager.isUsingMasterPassword()) return;
    ElementHandler.showModal('do-application-encryption');
  }

  /**
   * Update styling, pills, placeholders, and tooltips based on encryption state.
   *
   * @private
   * @param {boolean} isEncrypted - Whether current input looks like ciphertext.
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
   * Toggle visibility of the informational section and persist user preference.
   *
   * Preference key: `encInfoHidden` in {@link StorageService}.
   *
   * @param {boolean} [toggle=true] - If `true`, flip current state; if `false`, apply persisted state.
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
   * Render the selected file list, compute aggregate size vs. device budget,
   * and color the size label when the selection exceeds the memory limit.
   *
   * Also checks each file with {@link Cryptit.isEncrypted} to color-code badges
   * and potentially flips the UI to “decrypt” posture when all are encrypted.
   *
   * @async
   * @returns {Promise<void>}
   *
   * @example
   * // Automatically called when #inputFiles changes
   * await ui.updateFileList();
   */
  async updateFileList() {
    const fileListElem = $('#fileList');
    const inputFilesElem = $('#inputFiles')[0];
    const usedSizeElem = $('#usedSize'); // label showing total size vs. budget
    const { memoryBudget } = appState.state
    const SIZE_LIMIT = memoryBudget;
    
    document.querySelectorAll('.device-max').forEach(el => {
      el.textContent = formatBytes(SIZE_LIMIT);
    });

  if (!inputFilesElem.files.length) {
      fileListElem.text('Selected files appear here...');
      usedSizeElem.text('0 MB').removeClass('text-danger');
      return;
    }

    fileListElem.empty();
    const files = Array.from(inputFilesElem.files);

    const totalSize = files.reduce((acc, file) => acc + file.size, 0);

    usedSizeElem.text(formatBytes(totalSize));

    if (totalSize > SIZE_LIMIT) {
      usedSizeElem.addClass('text-danger');
    } else {
      usedSizeElem.removeClass('text-danger');
    }

    const encryptionChecks = files.map(async (file) => {
      const isEncrypted = await Cryptit.isEncrypted(file);
      const badge = isEncrypted
        ? $('<span class="badge bg-pink rounded-pill me-1">')
            .text(`${middleString(file.name)} | ${formatBytes(file.size)}`)
        : $('<span class="badge bg-blue rounded-pill me-1">')
            .text(`${middleString(file.name)} | ${formatBytes(file.size)}`);
      fileListElem.append(badge);
      return isEncrypted;
    });

    const results = await Promise.all(encryptionChecks);
    if (results.every(Boolean)) {
      this.updateEncryptionState(true);
    }
  }

  /**
   * Switch to the File Encryption view (and update state).
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
   * Switch to the Text Encryption view (and update state).
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
   * Clear the text input field and reset encryption indicators to "not encrypted".
   *
   * @returns {void}
   */
  clearInput() {
    this.formHandler.setFormValue('inputText', '');
    this.handleDataChange({ target: { value: '' } });
  }

  /**
   * Clear the file input field, reset file list placeholder, and set encryption UI to "not encrypted".
   *
   * @returns {void}
   */
  clearInputFiles() {
    this.formHandler.setFormValue('inputFiles', '');
    document.getElementById('fileList').textContent = 'Selected files appear here...';

    this.updateEncryptionState(false);
  }

  /**
   * Clear both password fields (visible and masked).
   *
   * @returns {void}
   */
  clearPassword() {
    this.formHandler.setFormValue('keyBlank', '');
    this.formHandler.setFormValue('keyPassword', '');
  }

  /**
   * Clear selected files and reset file I/O placeholders.
   *
   * @returns {void}
   */
  clearFiles() {
    this.formHandler.setFormValue('inputFiles', '');
    document.getElementById('fileList').textContent = 'Selected files appear here...';
    document.getElementById('outputFiles').textContent = 'The encrypted files appears here';
  }

  /**
   * Reset key slot selection control to default placeholder names (Slot 1…5).
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
   * Clear text, files, passwords, and slot names. Resets the slots modal as well.
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
   * Copy the output text to the clipboard with validation and success/failure UI feedback.
   *
   * Uses {@link wrapAction} to standardize async action UX and
   * {@link handleActionSuccess}/{@link handleActionError} for status styling.
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
   * Validate that the clipboard output is a non-empty string.
   *
   * @private
   * @param {*} output - Value to validate.
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
   * Update a password strength progress bar and label for a given input field.
   *
   * Debounces zxcvbn calls to avoid running it too often on slower devices.
   *
   * @param {string} pwFieldId
   * @param {string} barId
   * @param {string} textId
   * @returns {void}
   */
  showPasswordStrenght(pwFieldId, barId, textId) {
    clearTimeout(this.passwordStrengthTimers[pwFieldId]);

    this.passwordStrengthTimers[pwFieldId] = setTimeout(() => {
      const password = document.getElementById(pwFieldId).value;

      let strength;

      if (this.passwordStrengthCache[password] !== undefined) {
        strength = this.passwordStrengthCache[password];
      } else {
        const result = zxcvbn(password);
        strength = result.score;
        this.passwordStrengthCache[password] = strength;
      }

      const bar = document.getElementById(barId);
      const text = document.getElementById(textId);

      bar.classList.remove('bg-danger', 'bg-warning', 'bg-info', 'bg-success');

      switch (strength) {
        case 0:
          bar.style.width = '10%';
          bar.classList.add('bg-danger');
          text.textContent = 'Strength: Very Weak';
          break;
        case 1:
          bar.style.width = '10%';
          bar.classList.add('bg-danger');
          text.textContent = 'Strength: Very Weak';
          break;
        case 2:
          bar.style.width = '35%';
          bar.classList.add('bg-danger');
          text.textContent = 'Strength: Weak';
          break;
        case 3:
          bar.style.width = '65%';
          bar.classList.add('bg-warning');
          text.textContent = 'Strength: Medium';
          break;
        case 4:
          bar.style.width = '100%';
          bar.classList.add('bg-success');
          text.textContent = 'Strength: Strong';
          break;
      }
    }, 150);
  }
}