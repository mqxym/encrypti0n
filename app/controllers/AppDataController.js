import { ElementHandler } from '../helpers/ElementHandler.js';
import { FormHandler } from '../helpers/FormHandler.js';
import { ActivityService } from '../services/ActivityService.js';
import { handleActionError } from '../utils/controller.js';
import { AppDataConstants } from '../constants/constants.js';
import appState from '../state/AppState.js';

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
    $('#encryptApplication').on('click', () => this.handleAppEncrypt());
    $('#decryptApplication').on('click', () => this.handleAppDecrypt());
    $('#removeApplicationEncryption').on('click', () => this.handleAppEncryptionRemove());
    $('#encryptApplicationModal').on('click', () => this.handleAppEncryptModal());
    $('#removeAllData').on('click', () => this.removeAllData());
    $('#removeLocalDataDecryptionModal').on('click', () => this.removeAllData());
    $('#clearClipboard').on('click', () => this.clearClipboard());
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

    const laddaEncryptApplication = Ladda.create($('#encryptApplication')[0]);
    if (appState.state.isEncrypting) return;
    appState.setState({ isEncrypting: true });

    try {
      laddaEncryptApplication.start();
      laddaEncryptApplication.setProgress(0.7);
      await this.configManager.setMasterPassword(encryptApplicationMPw);
      ElementHandler.hideModal('do-application-encryption');
      ElementHandler.show('removeApplicationEncryption');
      ElementHandler.hide('encryptApplicationModal');
      this.initActivityService();
      Swal.fire({
        icon: 'success',
        title: 'The application is encrypted!',
        text: 'Remember your password.',
        timer: 2500,
        showCancelButton: false,
        confirmButtonText: 'Ok',
      });
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
      appState.setState({ isEncrypting: false });
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
    if (appState.state.isEncrypting) return;
    appState.setState({ isEncrypting: true });
    const formHandlerLocal = new FormHandler('applicationDecryptionForm');
    formHandlerLocal.preventSubmitAction();
    const { decryptApplicationMPw } = formHandlerLocal.getFormValues();
    formHandlerLocal.setFormValue('decryptApplicationMPw', '');
    const laddaDecryptApplication = Ladda.create($('#decryptApplication')[0]);
    try {
      this.validatePassword(decryptApplicationMPw);
      laddaDecryptApplication.start();
      laddaDecryptApplication.setProgress(0.7);
      await this.configManager.unlockSession(decryptApplicationMPw);
      ElementHandler.hideModal('do-application-decryption');
      const slotNames = await this.configManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, 'keySlot');
      ElementHandler.show('removeApplicationEncryption');
      ElementHandler.hide('encryptApplicationModal');
      await this.argon2Service.loadOptions();
      this.initActivityService();
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
      appState.setState({ isEncrypting: false });
    }
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
          ElementHandler.hide('removeApplicationEncryption');
          ElementHandler.show('encryptApplicationModal');
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
   * Opens the modal to initiate application encryption if not already encrypted.
   */
  handleAppEncryptModal() {
    if (this.configManager.isUsingMasterPassword()) return;
    ElementHandler.showModal('do-application-encryption');
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

  async clearClipboard () {
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