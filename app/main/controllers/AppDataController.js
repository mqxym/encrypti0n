import { ElementHandler, EventBinder } from '../helpers/ElementHandler.js';
import { FormHandler } from '../helpers/FormHandler.js';
import { ActivityService } from '../services/ActivityService.js';
import { handleActionError } from '../utils/controller.js';
import { AppDataConstants } from '../constants/constants.js';
import { wrapAction } from '../utils/controller.js';
import { readFileAsBuffer, creaeDownloadData } from '../utils/fileUtils.js';

/**
 * @class AppDataController
 * @classdesc
 * Manages application-level encryption/decryption actions, UI bindings,
 * inactivity locking, and data removal workflows.
 */
export class AppDataController {
  /**
   * @param {Object} services
   * @param {Object} services.config - Configuration manager for master password and session.
   * @param {Object} services.form - Form handling utilities.
   * @param {Object} services.argon2 - Argon2-based key handling service.
   */
  constructor(services) {
    /** @private */ this.configManager = services.config;
    /** @private */ this.formHandler = services.form;
    /** @private */ this.argon2Service = services.argon2;
    /** @private {Object} UI manager instance, set later */ this.UIManager;
    this.bindEvents();
  }

  /**
   * Sets the UI manager instance used to manipulate the UI.
   *
   * @param {Object} uiManager - The main UI manager controller.
   */
  setUIManager(uiManager) {
    this.UIManager = uiManager;
  }

  /**
   * Binds click events on various buttons to their corresponding handlers.
   */
  bindEvents() {
    EventBinder.on('#encryptApplication', 'click', () => wrapAction('encryptApplication', this.handleAppEncrypt.bind(this)));
    EventBinder.on('#decryptApplication', 'click', () => wrapAction('decryptApplication', this.handleAppDecrypt.bind(this)));
    EventBinder.on('#removeApplicationEncryption', 'click', () => this.handleAppEncryptionRemove());
    EventBinder.on('#removeAllData', 'click', () => this.removeAllData());
    EventBinder.on('#removeLocalDataDecryptionModal', 'click', () => this.removeAllData());
    EventBinder.on('#clearClipboard', 'click', () => this.clearClipboard());
    EventBinder.on('#exportDataBtn', 'click', () => wrapAction('exportData', this.handleExportData.bind(this)));
    EventBinder.on('#importDataBtn', 'click', () => wrapAction('importData', this.handleImportData.bind(this)));
  }

  /**
   * Initializes the inactivity ActivityService if not already running.
   * Begins countdown display and starts the inactivity timer.
   */
  initActivityService() {
    if (typeof this.activityService !== 'undefined') return;
    this.activityService = new ActivityService(
      AppDataConstants.APP_DATA_LOCK_TIMEOUT,
      this.lockApplicationAfterInactivity.bind(this)
    );
    this.activityService.startCountdown('#inactivityCountdown');
    this.activityService.start();
  }

  /**
   * Stops the inactivity ActivityService if it exists.
   */
  stopActivityService() {
    if (typeof this.activityService === 'undefined') return;
    this.activityService.stop();
  }

  /**
   * Handles encrypting the entire application:
   * - Validates and confirms master password input
   * - Derives and sets the master password
   * - Updates the UI and starts inactivity locking
   *
   * @async
   * @returns {Promise<void>}
   */
  async handleAppEncrypt() {
    ElementHandler.hide('encryptApplicationMissingPw');
    ElementHandler.hide('encryptApplicationMatchFail');
    const formHandlerLocal = new FormHandler('encryptApplicationForm');
    formHandlerLocal.preventSubmitAction();
    const { encryptApplicationMPw, encryptApplicationMPwConfirmation } = formHandlerLocal.getFormValues();
    if (!encryptApplicationMPw || !encryptApplicationMPwConfirmation) {
      ElementHandler.show('encryptApplicationMissingPw');
      return;
    }
    if (encryptApplicationMPw !== encryptApplicationMPwConfirmation) {
      ElementHandler.show('encryptApplicationMatchFail');
      return;
    }
    formHandlerLocal.setFormValue('encryptApplicationMPw', '');
    formHandlerLocal.setFormValue('encryptApplicationMPwConfirmation', '');

    const laddaEncryptApplication = this._laddaStart(document.getElementById('encryptApplication'));

    try {
      await this.configManager.setMasterPassword(encryptApplicationMPw);
      ElementHandler.hideModal('do-application-encryption');
      this._reactAppUnlockedStatus();
      Swal.fire({
        icon: 'success',
        title: 'The application is encrypted!',
        text: 'Remember your password.',
        timer: 2500,
        showCancelButton: false,
        confirmButtonText: 'Ok',
      });
      this.UIManager.handleMasterPasswordCase();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to encrypt the application!',
        text: 'Please try again or report the bug.',
        timer: 2500,
        showCancelButton: false,
        confirmButtonText: 'Ok',
      });
    } finally {
      laddaEncryptApplication.stop();
    }
  }

  /**
   * Handles decrypting the entire application:
   * - Validates master password input
   * - Unlocks the session and loads slot names & Argon2 options
   * - Updates the UI and starts inactivity locking
   *
   * @async
   * @returns {Promise<void>}
   */
  async handleAppDecrypt() {
    const formHandlerLocal = new FormHandler('applicationDecryptionForm');
    formHandlerLocal.preventSubmitAction();
    const { decryptApplicationMPw } = formHandlerLocal.getFormValues();
    formHandlerLocal.setFormValue('decryptApplicationMPw', '');

    const laddaDecryptApplication = this._laddaStart(document.getElementById('decryptApplication'));

    try {
      this.validatePassword(decryptApplicationMPw);

      await this.configManager.unlockSession(decryptApplicationMPw);
      ElementHandler.hideModal('do-application-decryption');

      const loadingResult = await this.UIManager.loadApplicationData();
      if (loadingResult) throw Error('Failed to load application data');

      this._reactAppUnlockedStatus();

      Swal.fire({
        icon: 'success',
        title: 'The application is decrypted!',
        text: 'You can now use your saved data.',
        timer: 2500,
        showCancelButton: false,
        confirmButtonText: 'Ok',
      });
    } catch (err) {
      laddaDecryptApplication.stop();
      await handleActionError('decryptApplication');
    } finally {
      laddaDecryptApplication.stop();
    }
  }

  /**
   * Updates the UI to reflect that the application is unlocked:
   * shows the “removeApplicationEncryption” element, hides the encryption modal,
   * and initializes the activity service.
   * @private
   * @returns {void}
   */
  _reactAppUnlockedStatus() {
    ElementHandler.show('removeApplicationEncryption');
    ElementHandler.hide('encryptApplicationModal');
    this.initActivityService();
  }

  /**
   * Starts a Ladda button spinner on the given element and sets its initial progress.
   * @private
   * @param {HTMLElement|string} id - The target button element or its selector.
   * @returns {Ladda} The Ladda instance for further control.
   */
  _laddaStart(id) {
    const ladda = Ladda.create(id);
    ladda.start();
    ladda.setProgress(0.7);
    return ladda;
  }

  /**
   * Callback invoked when inactivity timeout elapses.
   * Locks the session, clears UI, stops activity service,
   * and prompts for re-authentication.
   */
  lockApplicationAfterInactivity() {
    this.configManager.lockSession();
    this.UIManager.clearUI();
    this.stopActivityService();
    this.formHandler.setFormValue('outputText', '');
    ElementHandler.showModal('do-application-decryption');
  }

  /**
   * Prompts user to confirm removal of application encryption,
   * and if confirmed, removes the master password and updates UI.
   */
  handleAppEncryptionRemove() {
    Swal.fire({
      icon: 'warning',
      title: 'Remove app encryption?',
      text: 'You risk data exposure.',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          this.stopActivityService();
          await this.configManager.removeMasterPassword();
          this.UIManager.handlePasswordlessCase();
          Swal.fire({
            icon: 'success',
            title: 'The encryption is removed.',
            timer: 2500,
            showCancelButton: false,
            confirmButtonText: 'Ok',
          });
        } catch (err) {
          Swal.fire({
            icon: 'error',
            title: 'The removal of app encryption failed.',
            showCancelButton: false,
            confirmButtonText: 'Ok',
          });
        }
      }
    });
  }

  /**
   * Prompts user to confirm clearing all local data, and if confirmed,
   * deletes all config data, resets UI, and shows success feedback.
   */
  removeAllData() {
    Swal.fire({
      icon: 'warning',
      title: 'Clear all data?',
      text: "All local data from main app v3 will be rewritten with default values. This action can't be undone.",
      showCancelButton: true,
      confirmButtonText: '<i class="mdi mdi-delete me-1"></i> Clear',
      cancelButtonText: '<i class="mdi mdi-cancel me-1"></i>Cancel',
      customClass: {
        popup: 'rounded-3',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-outline-secondary',
      },
      buttonsStyling: false,
    }).then(async (result) => {
      if (result.isConfirmed) {
        this.stopActivityService();
        this.UIManager.clearUI();
        await this.configManager.deleteAllConfigData();
        await this.UIManager.initUI();
        ElementHandler.hideModal('do-application-decryption');
        Swal.fire({
          icon: 'success',
          title: 'All data deleted!',
          text: 'The application is cleared.',
          timer: 2500,
          showCancelButton: false,
          confirmButtonText: 'Ok',
          customClass: {
            popup: 'rounded-3',
            confirmButton: 'btn btn-primary',
          },
          buttonsStyling: false,
        });
      }
    });
  }

  /**
   * Handles exporting the application configuration:
   * - Prevents default form submission
   * - Exports using master password if enabled, otherwise validates and encrypts using user-provided password
   * - Provides user feedback via loading spinner and alerts
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async handleExportData() {
    const formHandlerLocal = new FormHandler('exportDataForm');
    formHandlerLocal.preventSubmitAction();
    let laddaExport;

    try {
      if (this.configManager.isUsingMasterPassword()) {
        laddaExport = this._laddaStart(document.getElementById('exportDataBtn')); // Start Ladda here for this path
        const exportOperationPromise = this.configManager.exportConfig(null);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('Export process timed out after 40 seconds.')),
            AppDataConstants.EXPORT_PROCESS_TIMEOUT
          );
        });
        const data = await Promise.race([exportOperationPromise, timeoutPromise]);
        this._downloadExport(data);
      } else {
        ElementHandler.hide('exportDataMatchFail');
        ElementHandler.hide('exportDataMissingPw');
        const { exportDataPw, exportDataPwConfirmation } = formHandlerLocal.getFormValues();

        if (!exportDataPw || !exportDataPwConfirmation) {
          ElementHandler.show('exportDataMissingPw');
          return;
        }
        if (exportDataPw !== exportDataPwConfirmation) {
          ElementHandler.show('exportDataMatchFail');
          formHandlerLocal.setFormValue('exportDataPw', '');
          formHandlerLocal.setFormValue('exportDataPwConfirmation', '');
          return;
        }

        formHandlerLocal.setFormValue('exportDataPw', '');
        formHandlerLocal.setFormValue('exportDataPwConfirmation', '');

        laddaExport = this._laddaStart(document.getElementById('exportDataBtn'));

        this.validatePassword(exportDataPw);
        const exportOperationPromise = this.configManager.exportConfig(exportDataPw);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('Export process timed out after 40 seconds.')),
            AppDataConstants.EXPORT_PROCESS_TIMEOUT
          );
        });
        const data = await Promise.race([exportOperationPromise, timeoutPromise]);
        this._downloadExport(data);
        Swal.fire({
          icon: 'success',
          title: 'Export Successful',
          text: 'Your data has been successfully prepared for download.',
          timer: 2500,
          showCancelButton: false,
          confirmButtonText: 'Ok',
        });
      }
    } catch (err) {
      formHandlerLocal.setFormValue('exportDataPw', '');
      formHandlerLocal.setFormValue('exportDataPwConfirmation', '');

      let title = 'Failed to export the configuration!';
      let text = 'Please try again or report the bug.';

      if (err.message && err.message.includes('timed out')) {
        title = 'Export Timed Out';
        text = err.message;
      } else if (err.message && err.message.toLowerCase().includes('key cannot be empty')) {
        title = 'Export Failed';
        text = 'Password cannot be empty.';
      }
      Swal.fire({
        icon: 'error',
        title: title,
        text: text,
        timer: 3000,
        showCancelButton: false,
        confirmButtonText: 'Ok',
      });
    } finally {
      if (laddaExport) {
        laddaExport.stop();
      }
    }
  }

  /**
   * Handles exporting the application configuration:
   * - Prevents default form submission
   * - Exports using master password if enabled, otherwise validates and encrypts using user-provided password
   * - Provides user feedback via loading spinner and alerts
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async handleImportData() {
    const formHandlerLocal = new FormHandler('importDataForm');
    formHandlerLocal.preventSubmitAction();
    let { importDataPw } = formHandlerLocal.getFormValues();

    const laddaImport = this._laddaStart(document.getElementById('importDataBtn'));

    try {
      this.validatePassword(importDataPw); // Initial validation outside timeout

      const fileInput = document.getElementById('importDataFile');
      const file = fileInput.files[0];
      if (!file) {
        Swal.fire({
          icon: 'error',
          title: 'Import Failed',
          text: 'No file selected. Please choose a file to import.',
          timer: 2500,
          showCancelButton: false,
          confirmButtonText: 'Ok',
        });
        return;
      }

      const importOperationPromise = (async () => {
        const binaryContent = await readFileAsBuffer(file, AppDataConstants.READ_FILE_TIMEOUT);
        return await this.configManager.importConfig(binaryContent, importDataPw);
      })();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Import process timed out after 40 seconds.')),
          AppDataConstants.IMPORT_PROCESS_TIMEOUT
        );
      });

      const result = await Promise.race([importOperationPromise, timeoutPromise]);

      // Clear form values AFTER successful import logic, but before Swal success messages
      formHandlerLocal.setFormValue('importDataPw', '');
      document.getElementById('importDataFile').value = '';

      if (result === 'storedWithMasterPassword') {
        Swal.fire({
          icon: 'success',
          title: 'Application data successfully imported with a master password!',
          text: 'You can now use your saved data. Your master password is now required when re-entering the application.',
          showCancelButton: false,
          confirmButtonText: 'Ok',
        });
        
        const loadingResult = await this.UIManager.loadApplicationData();
        if (loadingResult) throw Error('Failed to load application data');
        this.UIManager.handleMasterPasswordCase();
        this._reactAppUnlockedStatus();

      } else if (result === 'storedWithDeviceKey') {
        Swal.fire({
          icon: 'success',
          title: 'Application data successfully imported with export password!',
          text: 'You can now use your saved data.',
          timer: 3500,
          showCancelButton: false,
          confirmButtonText: 'Ok',
        });
        await this.UIManager.initUI();

      } else {
        throw new Error('Unknown return code from importConfig.');
      }
      ElementHandler.hideModal('do-data-import');

    } catch (err) {
      formHandlerLocal.setFormValue('importDataPw', '');

      let title = 'Failed to import the configuration!';
      let text = 'Please check data or password.';

      if (err.message && err.message.includes('timed out')) {
        title = 'Import Timed Out';
        text = err.message;
      } else if (err.message && err.message.includes('No file selected')) {
        title = 'Import Failed';
        text = 'No file selected. Please choose a file to import.';
      } else if (err.message && err.message.toLowerCase().includes('key cannot be empty')) {
        title = 'Import Failed';
        text = 'Password cannot be empty. Please enter a password.';
      }

      Swal.fire({
        icon: 'error',
        title: title,
        text: text,
        timer: 3500,
        showCancelButton: false,
        confirmButtonText: 'Ok',
      });
    } finally {
      importDataPw = null;
      if (laddaImport) {
        laddaImport.stop();
      }
    }
  }

  /**
   * Triggers download of exported data as a file named "export.dat".
   * @private
   * @param {string|ArrayBuffer} data - The serialized configuration data to download.
   * @returns {void}
   */
  _downloadExport(buffer) {
     const suffix = crypto
      .getRandomValues(new Uint8Array(6))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    const export_name = `export_${suffix}`;
    const extension = '.dat';

    creaeDownloadData(buffer, export_name, extension)
  }

  /**
   * Validates that a provided password is a non-empty string.
   *
   * @param {*} password - The password value to validate.
   * @throws {Error} If the password is empty or not a string.
   */
  validatePassword(password) {
    if (!password) {
      throw new Error('Key cannot be empty');
    }
    if (typeof password !== 'string') {
      throw new Error('Key must be a string');
    }
  }
  /**
   * Clears the system clipboard and notifies the user of success or failure.
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async clearClipboard() {
    try {
      await navigator.clipboard.writeText('');
      Swal.fire({
        icon: 'success',
        title: 'Clipboard cleared.',
        timer: 2500,
        showCancelButton: false,
        confirmButtonText: 'Ok',
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to clear clipboard',
        text: '',
        showCancelButton: false,
        confirmButtonText: 'Ok',
      });
    }
  }
}
