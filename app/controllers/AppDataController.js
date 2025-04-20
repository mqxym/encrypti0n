import { ElementHandler } from '../helpers/ElementHandler.js';
import { FormHandler } from '../helpers/FormHandler.js'
import { ActivityService } from '../services/ActivityService.js';
import { delay } from '../utils/misc.js';
import appState from '../state/AppState.js';


export class AppDataController {
    constructor(services) {
      this.configManager = services.config;
      this.formHandler = services.form;
      this.argon2Service = services.argon2;
      this.UIManager;
      this.bindEvents();
    }

    setUIManager (uiManager) {
        this.UIManager = uiManager;
    }


    bindEvents () {
        $('#encryptApplication').on('click', () => this.handleAppEncrypt());
        $('#decryptApplication').on('click', () => this.handleAppDecrypt());
        $('#removeApplicationEncryption').on('click', () => this.handleAppEncryptionRemove());
        $('#encryptApplicationModal').on('click', () => this.handleAppEncryptModal());
        $('#removeAllData').on('click', () => this.removeAllData());
        $('#removeLocalDataDecryptionModal').on('click', () => this.removeAllData());
    }

    initActivityService() {
        // Create the activity service to detect inactivity
        if (typeof this.activityService !== 'undefined') return;
        this.activityService = new ActivityService(300, this.lockApplicationAfterInactivity.bind(this));
        this.activityService.startCountdown("#inactivityCountdown");
        this.activityService.start();
      }
    
      stopActivityService() {
        if (typeof this.activityService === 'undefined') return;
        this.activityService.stop();
      }

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
        appState.setState({isEncrypting : true});

        try {
          laddaEncryptApplication.start();
          laddaEncryptApplication.setProgress(0.7);
          await this.configManager.setMasterPassword(encryptApplicationMPw);
          $('#do-application-encryption').modal('hide');
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
          appState.setState({isEncrypting : false});
          laddaEncryptApplication.stop();
        }
      }
    
      async handleAppDecrypt() {
        if (appState.state.isEncrypting) return;
        appState.setState({isEncrypting : true});
        const formHandlerLocal = new FormHandler('applicationDecryptionForm');
        formHandlerLocal.preventSubmitAction();
        const { decryptApplicationMPw } = formHandlerLocal.getFormValues();
        if (!decryptApplicationMPw) {
          ElementHandler.buttonRemoveTextAddFail('decryptApplication');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('decryptApplication');
          appState.setState({actionInProgress : false});
          return;
        }
        formHandlerLocal.setFormValue('decryptApplicationMPw', '');
        const laddaDecryptApplication = Ladda.create($('#decryptApplication')[0]);
        try {
          laddaDecryptApplication.start();
          laddaDecryptApplication.setProgress(0.7);
          await this.configManager.unlockSession(decryptApplicationMPw);
          $('#do-application-decryption').modal('hide');
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
          appState.setState({isEncrypting : false});
        } catch (err) {
          laddaDecryptApplication.stop();
          ElementHandler.buttonRemoveTextAddFail('decryptApplication');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('decryptApplication');
          appState.setState({isEncrypting : false});
        } finally {
          laddaDecryptApplication.stop();
        }
      }
    
      lockApplicationAfterInactivity () {
        this.configManager.lockSession();
        this.UIManager.clearUI();
        this.stopActivityService();
        this.formHandler.setFormValue('outputText', ''); 
        $('#do-application-decryption').modal('show');
      }
    
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
    
      handleAppEncryptModal() {
        if (this.configManager.isUsingMasterPassword()) return;
        $('#do-application-encryption').modal('show');
      }

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
            cancelButton: 'btn btn-outline-secondary'
          },
          buttonsStyling: false
        }).then(async (result) => {
          if (result.isConfirmed) {
            this.stopActivityService();
            this.UIManager.clearUI();
            await this.configManager.deleteAllConfigData();
            await this.UIManager.initUI();
            $('#do-application-decryption').modal('hide');
            Swal.fire({
              icon: 'success',
              title: 'All data deleted!',
              text: 'The application is cleared.',
              timer: 2500,
              showCancelButton: false,
              confirmButtonText: 'Ok',
              customClass: {
                popup: 'rounded-3',
                confirmButton: 'btn btn-primary'
              },
              buttonsStyling: false
            });
          }
        });
      }
}