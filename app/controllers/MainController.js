import { FormHandler } from '../helpers/FormHandler.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { StorageService } from '../services/StorageService.js';
import { EncryptionService } from '../services/EncryptionService.js';
import { argon2Service } from '../services/argon2Service.js';
import { ActivityService } from '../services/ActivityService.js';
import { ConfigManager } from '../services/configManagement/ConfigManager.js';

export class MainController {
  /**
   * @param {string} formId - The id of the main form.
   */
  constructor(formId) {
    this.formHandler = new FormHandler(formId);
    this.formHandler.preventSubmitAction();
    // Application state and version
    this.doFiles = false;
    this.actionInProgress = false;
    this.actionInProgressCopy = false;
  }

  /**
   * Initialize the controller
   */
  async init() {
    this.configManager = await ConfigManager.create();
    this.storageService = new StorageService();
    this.encryptionService = new EncryptionService();
    this.argon2Service = new argon2Service('argon2-modal', this.configManager);
    this.bindUIEvents();
    this.initUI();
  }

  /**
   * Bind all App DOM events.
   */
  bindUIEvents() {
    // General actions
    $('.action-button').on('click', () => this.handleAction());
    $('#hideInformation').on('click', () => this.setInformationTab());
    $('#inputText').on('input', (event) => this.handleDataChange(event));
    $('#showTextEncryption').on('click', () => this.showTextInput());
    $('#showFilesEncryption').on('click', () => this.showFileInput());
    $('.Argon2-Options').on('click', () => $('#argon2-modal').modal('show'));
    $('#renameSlots').on('click', () => $('#renameSlotsModal').modal('show'));

    // Master password actions
    $('#encryptApplication').on('click', () => this.handleAppEncrypt());
    $('#decryptApplication').on('click', () => this.handleAppDecrypt());
    $('#removeApplicationEncryption').on('click', () => this.handleAppEncryptionRemove());
    $('#encryptApplicationModal').on('click', () => this.handleAppEncryptModal());

    // Text and output actions
    $('#clearInput').on('click', () => this.clearInput());
    $('#copyOutput').on('click', () => this.copyOutput());

    // Key management
    $('#renameSlotAction').on('click', () => this.changeSlotName());
    $('#keyGenerate').on('click', () => this.keyGenerate());
    $('#clearPassword').on('click', () => this.clearPassword());
    $('#keyCopy').on('click', () => this.keyCopy());
    $('#hideKey').on('change', () => this.toggleKey());
    $('#loadKey').on('click', () => this.loadKey());
    $('#saveKey').on('click', () => this.saveKey());

    // Local data clearing
    $('#removeAllData').on('click', () => this.removeAllData());
    $('#removeLocalDataDecryptionModal').on('click', () => this.removeAllData());

    // File input and file operations
    $('#inputFiles').on('change', () => this.updateFileList());
  }

  /**
   * Initialize the UI and check for app encryption
   */
  async initUI() {
    if (this.configManager.isUsingMasterPassword()) {
      ElementHandler.disable('encryptApplicationModal');
      $(document).off('click', '#encryptApplicationModal');
      $('#do-application-decryption').modal('show');
    } else {
      let slotNames;
      let failure = false;
      try {
        slotNames = await this.configManager.readSlotNames();
      } catch (err) {
        failure = true;
      }
      
      ElementHandler.populateSelectWithSlotNames(slotNames, 'keySlot');
      try {
        await this.argon2Service.loadOptions();
      } catch (err) {
        failure = true;
      }

      if (failure) {
        Swal.fire({
          icon: 'error',
          title: 'Failed to decrypt local data!',
          text: 'The data could be corrupted. Please try clearing all data.',
          showCancelButton: false,
          confirmButtonText: 'Ok',
        });
      }
      
      this.keyGenerate();
      this.toggleKey();
    }
    // clear input data
    this.setInformationTab(false);
    this.formHandler.setFormValue('outputText', '');
    this.formHandler.setFormValue('inputText', '');
    this.formHandler.setFormValue('outputText', '');
    this.clearFiles();
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

  // ––––––– UI Toggle Methods –––––––

  showFileInput() {
    ElementHandler.fillButtonGray('showFilesEncryption');
    ElementHandler.emptyButtonGray('showTextEncryption');
    ElementHandler.show('fileEncryptionInput');
    ElementHandler.hide('textEncryptionInput');
    ElementHandler.show('fileEncryptionOutput');
    ElementHandler.hide('textEncryptionOutput');
    this.updateFileList();
    this.doFiles = true;
  }

  showTextInput() {
    ElementHandler.emptyButtonGray('showFilesEncryption');
    ElementHandler.fillButtonGray('showTextEncryption');
    ElementHandler.hide('fileEncryptionInput');
    ElementHandler.show('textEncryptionInput');
    ElementHandler.show('textEncryptionOutput');
    ElementHandler.hide('fileEncryptionOutput');
    this.doFiles = false;
  }

  setInformationTab(toggle = true) {
    const isCurrentlyHidden = this.storageService.getItem('encInfoHidden') === 'true';
    
    if (toggle) {
      const newHiddenState = !isCurrentlyHidden;
      this.storageService.setItem('encInfoHidden', newHiddenState.toString());
      
      if (newHiddenState) {
        $('.informationRow').hide();
        $('#appRow').removeClass('mb-5');
      } else {
        $('.informationRow').show();
        $('#appRow').addClass('mb-5');
      }
    } else {
      if (isCurrentlyHidden) {
        $('.informationRow').hide();
        $('#appRow').removeClass('mb-5');
      } else {
        $('.informationRow').show();
        $('#appRow').addClass('mb-5');
      }
    }
  }

  // ––––––– Action Orchestration –––––––

  async handleAction() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;

    if (!this.doFiles) {
      await this.handleActionText();
    } else {
      await this.handleActionFiles();
    }
  }

  async handleActionText() {
    const { inputText } = this.formHandler.formValues;
    const laddaManager = new LaddaButtonManager('.action-button');
    laddaManager.startAll();
    laddaManager.setProgressAll(0.75);

    try {
      const isEncrypted = await this.encryptionService.isEncrypted(inputText);
      let result = false;
      if (isEncrypted) {
        result = await this.handleDecrypt();
        laddaManager.setProgressAll(1);
        if (!result) {
          ElementHandler.arrowsToCross();
          this.formHandler.setFormValue('outputText', null);
          ElementHandler.setPlaceholderById('outputText', 'Decryption failed. Please check data or password.');
        }
      } else {
        result = await this.handleEncrypt();
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
    } finally {
      this.actionInProgress = false;
    }
  }

  async handleActionFiles() {
    const laddaManager = new LaddaButtonManager('.action-button');
    laddaManager.startAll();

    try {
      const inputFilesElem = $('#inputFiles')[0];
      const fileLength = inputFilesElem.files.length;
      let result = false;
      let fileCounter = 0;
      $('#outputFiles').empty();
      
      if (fileLength === 0) {
        ElementHandler.arrowsToCross();
        $('#outputFiles').html('Encryption / Decryption failed. Please check data or password.')
        await this.postActionHandling(false, laddaManager);
        return;
      }

      for (let file of inputFilesElem.files) {
        const isEncrypted = await this.encryptionService.isEncryptedFile(file);
        laddaManager.setProgressAll(fileCounter / fileLength);
        if (isEncrypted) {
          result = await this.handleFileDecrypt(file);
          if (!result) {
            ElementHandler.arrowsToCross();
          }
        } else {
          result = await this.handleFileEncrypt(file);
          if (!result) {
            ElementHandler.arrowsToCross();
          }
        }
        ++fileCounter;
      }
      await this.postActionHandling(result, laddaManager);
    } catch (error) {
      laddaManager.stopAll();
      ElementHandler.arrowsToCross();
    } finally {
      this.actionInProgress = false;
    }
  }

  async postActionHandling(result, laddaManager) {
    if (result) {
      laddaManager.stopAll();
      ElementHandler.arrowsToCheck();
      await this.delay(2500);
      ElementHandler.checkToArrows();
    } else {
      laddaManager.stopAll();
      await this.delay(2500);
      ElementHandler.crossToArrows();
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ––––––– Text Encryption/Decryption Methods –––––––

  async handleEncrypt() {
    const { inputText, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    if (!inputText || !passphrase) return false;
    const algo = 'aesgcm';
    try {
      const usedOptions = await argon2Service.getCurrentOptions(this.configManager);
      this.encryptionService.setargon2Difficulty(usedOptions.roundDifficulty);
      this.encryptionService.setSaltLengthDifficulty(usedOptions.saltDifficulty);
      const encryptedB64 = await this.encryptionService.encryptText(inputText, passphrase, algo);
      this.formHandler.setFormValue('outputText', encryptedB64);
      return true;
    } catch (err) {
      return false;
    }
  }

  async handleDecrypt() {
    const { inputText, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    if (!inputText || !passphrase) return false;
    try {
      const decrypted = await this.encryptionService.decryptText(inputText, passphrase);
      this.formHandler.setFormValue('outputText', decrypted);
      return true;
    } catch (error) {
      return false;
    }
  }

  async handleDataChange(event) {
    const inputText = event.target.value;
    const isEncrypted = await this.encryptionService.isEncrypted(inputText.trim());

    this.changeOperationVisuals(isEncrypted);
  }

  changeOperationVisuals(isEncrypted = false) {
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

  // ––––––– Master Password & Application Encryption Methods –––––––

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
      laddaEncryptApplication.stop();
    }
  }

  async handleAppDecrypt() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const formHandlerLocal = new FormHandler('applicationDecryptionForm');
    formHandlerLocal.preventSubmitAction();
    const { decryptApplicationMPw } = formHandlerLocal.getFormValues();
    if (!decryptApplicationMPw) {
      ElementHandler.buttonRemoveTextAddFail('decryptApplication');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('decryptApplication');
      this.actionInProgress = false;
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
      this.actionInProgress = false;
    } catch (err) {
      laddaDecryptApplication.stop();
      ElementHandler.buttonRemoveTextAddFail('decryptApplication');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('decryptApplication');
      this.actionInProgress = false;
    } finally {
      laddaDecryptApplication.stop();
    }
  }

  lockApplicationAfterInactivity () {
    this.configManager.lockSession();
    this.clearUI();
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

  // ––––––– File Operations, Encryption & Decryption –––––––

  async updateFileList() {
    const fileListElem = $('#fileList');
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length) {
      fileListElem.text('No files selected.');
      return;
    }
    fileListElem.empty();
    const files = Array.from(inputFilesElem.files);
    const encryptionChecks = files.map(async (file) => {
      const isEncrypted = await this.encryptionService.isEncryptedFile(file);
      const li = isEncrypted
        ? $('<span class="badge bg-pink rounded-pill me-1">').text(`${file.name} | ${this.formatBytes(file.size)}`)
        : $('<span class="badge bg-blue rounded-pill me-1">').text(`${file.name} | ${this.formatBytes(file.size)}`);
      fileListElem.append(li);
      return isEncrypted;
    });

    const results = await Promise.all(encryptionChecks);
    if (results.every((isEncrypted) => isEncrypted)) {
      this.changeOperationVisuals(true);
    }
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  async handleFileEncrypt(file) {
    const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    if (!passphrase) {
      return false;
    }
    const algo = 'aesgcm';
    const outputFilesDiv = $('#outputFiles');
    try {
      const usedOptions = await argon2Service.getCurrentOptions(this.configManager);
      this.encryptionService.setargon2Difficulty(usedOptions.roundDifficulty);
      this.encryptionService.setSaltLengthDifficulty(usedOptions.saltDifficulty);
      const blob = await this.encryptionService.encryptFile(file, passphrase, algo);
      const size = this.formatBytes(blob.size);
      const url = URL.createObjectURL(blob);
      const link = $('<a class="btn mb-1 btn-sm bg-pink text-white rounded-pill me-1">')
        .attr('href', url)
        .attr('download', file.name + '.enc')
        .text(`${file.name}.enc | ${size}`);
      outputFilesDiv.append(link); //.append('<br/>');
      return true;
    } catch (err) {
      const link = $('<a class="btn mb-1 btn-sm bg-secondary text-white rounded-pill me-1">')
        .text(`FAILED: ${file.name}`);
      outputFilesDiv.append(link);
      return false;
    }
  }

  async handleFileDecrypt(file) {
    const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length || !passphrase) {
      return false;
    }
    const outputFilesDiv = $('#outputFiles');

    try {
      const decryptedBytes = await this.encryptionService.decryptFile(file, passphrase);
      const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const size = this.formatBytes(blob.size);
      if (blob.size === 0) {
        return false;
      }
      const downloadName = file.name.replace('.enc', '');
      const link = $('<a class="btn mb-1 btn-sm bg-blue text-white rounded-pill me-1">')
        .attr('href', url)
        .attr('download', downloadName)
        .text(`${downloadName} | ${size}`);
      outputFilesDiv.append(link); //.append('<br/>');
      return true;
    } catch (err) {
      const link = $('<a class="btn mb-1 btn-sm bg-secondary text-white rounded-pill me-1">')
        .text(`FAILED: ${file.name}`);
      outputFilesDiv.append(link);
      return false;
    }
  }

  // ––––––– Key Management Methods –––––––

  async keyGenerate() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const randomKey = generateSecureRandomString(24);
    this.formHandler.setFormValue('keyBlank', randomKey);
    this.formHandler.setFormValue('keyPassword', randomKey);
    ElementHandler.buttonRemoveTextAddSuccess('keyGenerate');
    await this.delay(1000);
    ElementHandler.buttonRemoveStatusAddText('keyGenerate');
    this.actionInProgress = false;

    function generateSecureRandomString(length) {
      const allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_+.,()[]*#?=&%$§€@!%^{}|;':/<>?";
      const allowedLength = allowed.length; // 67 characters
      const result = [];
      const cryptoObj = window.crypto || window.msCrypto;
      // We can only safely use bytes < maxMultiple without bias.
      const maxMultiple = Math.floor(256 / allowedLength) * allowedLength; // 256 % 67 = 55, so maxMultiple = 201

      while (result.length < length) {
        // Request enough random bytes. This may yield extra bytes that we might not use.
        const randomBytes = new Uint8Array(length - result.length);
        cryptoObj.getRandomValues(randomBytes);
        for (let i = 0; i < randomBytes.length && result.length < length; i++) {
          if (randomBytes[i] < maxMultiple) {
            result.push(allowed[randomBytes[i] % allowedLength]);
          }
        }
      }
      return result.join('');
    }
  }

  async keyCopy() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const keyToCopy = hideKey ? keyPassword : keyBlank;
    if (!keyToCopy) {
      ElementHandler.buttonRemoveTextAddFail('keyCopy');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('keyCopy');
      this.actionInProgress = false;
      return;
    }
    try {
      await navigator.clipboard.writeText(keyToCopy);
      ElementHandler.buttonRemoveTextAddSuccess('keyCopy');
    } catch (err) {
      ElementHandler.buttonRemoveTextAddFail('keyCopy');
    } finally {
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('keyCopy');
      this.actionInProgress = false;
    }
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
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const { keySlot } = this.formHandler.formValues;
    if (!keySlot) {
      ElementHandler.buttonRemoveTextAddFail('loadKey');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('loadKey');
      this.actionInProgress = false;
      return;
    }
    try {
      const storedKey = await this.configManager.readSlotValue(keySlot);
      if (!storedKey) {
        ElementHandler.buttonRemoveTextAddFail('loadKey');
        await this.delay(1000);
        ElementHandler.buttonRemoveStatusAddText('loadKey');
        this.actionInProgress = false;
        return;
      }
      this.formHandler.setFormValue('keyBlank', storedKey);
      this.formHandler.setFormValue('keyPassword', storedKey);
      ElementHandler.buttonRemoveTextAddSuccess('loadKey');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('loadKey');
    } catch (error) {
      ElementHandler.buttonRemoveTextAddFail('loadKey');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('loadKey');
    }
    this.actionInProgress = false;
  }

  async saveKey() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const { keySlot, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    if (!keySlot) {
      ElementHandler.buttonRemoveTextAddFail('saveKey');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('saveKey');
      this.actionInProgress = false;
      return;
    }
    const keyToSave = hideKey ? keyPassword : keyBlank;
    if (!keyToSave) {
      ElementHandler.buttonRemoveTextAddFail('saveKey');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('saveKey');
      this.actionInProgress = false;
      return;
    }
    try {
      await this.configManager.setSlotValue(keySlot, keyToSave);
      ElementHandler.buttonRemoveTextAddSuccess('saveKey');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('saveKey');
    } catch (err) {
      ElementHandler.buttonRemoveTextAddFail('saveKey');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('saveKey');
    }
    this.actionInProgress = false;
  }

  async changeSlotName() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const formHandlerLocal = new FormHandler('newSlotForm');
    formHandlerLocal.preventSubmitAction();
    const { keySlotChange, slotName } = formHandlerLocal.getFormValues();
    if (!keySlotChange || !slotName) {
      ElementHandler.buttonRemoveTextAddFail('renameSlotAction');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('renameSlotAction');
      this.actionInProgress = false;
      return;
    }
    try {
      await this.configManager.setSlotName(keySlotChange, slotName);
      const slotNames = await this.configManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, 'keySlot');
      ElementHandler.buttonRemoveTextAddSuccess('renameSlotAction');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('renameSlotAction');
      $('#slotName').val('');
    } catch (error) {
      ElementHandler.buttonRemoveTextAddFail('renameSlotAction');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('renameSlotAction');
    }
    this.actionInProgress = false;
  }

  // ––––––– Data Clearing and Utility –––––––

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
        this.clearUI();
        await this.configManager.deleteAllConfigData();
        await this.initUI();
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

  clearInput() {
    this.formHandler.setFormValue('inputText', '');
    this.handleDataChange({ target: { value: '' } });
  }

  clearPassword() {
    this.formHandler.setFormValue('keyBlank', '');
    this.formHandler.setFormValue('keyPassword', '');
  }

  clearFiles() {
    this.formHandler.setFormValue('inputFiles', '');
    $('#fileList').html('');
    $('#outputFiles').html('The encrypted files appears here');
  }

  clearSlotNames() {
    const obj = { 1: "Slot 1", 2: "Slot 2", 3: "Slot 3", 4: "Slot 4", 5: "Slot 5", 6: "Slot 6", 7: "Slot 7", 8: "Slot 8", 9: "Slot 9", 10: "Slot 10" };
    ElementHandler.populateSelectWithSlotNames(obj, 'keySlot');
  }

  clearUI () {
    this.clearFiles();
    this.clearInput();
    this.clearPassword();
    this.clearSlotNames();
  }

  async copyOutput() {
    const { outputText } = this.formHandler.formValues;
    if (this.actionInProgressCopy) return;
    this.actionInProgressCopy = true;
    if (!outputText) {
      ElementHandler.buttonRemoveTextAddFail('copyOutput');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('copyOutput');
      this.actionInProgressCopy = false;
      return;
    }
    try {
      await navigator.clipboard.writeText(outputText);
      ElementHandler.buttonRemoveTextAddSuccess('copyOutput');
    } catch (err) {
      ElementHandler.buttonRemoveTextAddFail('copyOutput');
    } finally {
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('copyOutput');
      this.actionInProgressCopy = false;
    }
  }
}
