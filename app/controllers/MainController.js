import { FormHandler } from '../helpers/FormHandler.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
//import { ShowNotification } from '../helpers/ShowNotification.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { StorageService } from '../services/StorageService.js';
import { EncryptionService } from '../services/EncryptionService.js';
import { pbkdf2Service } from '../services/pbkdf2Service.js';
import { ConfigManager } from '../services/configManagement/ConfigManager.js';

export class MainController {
  /**
   * @param {string} formId - The id of the main form.
   */
  constructor(formId) {
    this.formHandler = new FormHandler(formId);
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
    this.pbkdf2Service = new pbkdf2Service('pbkdf2-modal', this.configManager);
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
    $('.PBKDF2-Options').on('click', () => $('#pbkdf2-modal').modal('show'));
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
      const slotNames = await this.configManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, "keySlot");
      await this.pbkdf2Service.loadOptions();
      this.keyGenerate();
      this.toggleKey();
    }
    this.setInformationTab(false);
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

  setInformationTab (toggle = true) {
    if (toggle === true) {
      if (this.storageService.getItem("encInfoHidden") === null || this.storageService.getItem("encInfoHidden") === "false" ) {
        this.storageService.setItem("encInfoHidden", "true");
        $(".informationRow").hide();
        $("#appRow").addClass("mb-5");
      } else if (this.storageService.getItem("encInfoHidden") === "true") {
        this.storageService.setItem("encInfoHidden", "false");
        $(".informationRow").show();
        $("#appRow").removeClass("mb-5");
      } 
    } else {
      if (this.storageService.getItem("encInfoHidden") === null || this.storageService.getItem("encInfoHidden") === "false" ) {
        $(".informationRow").show();
        $("#appRow").addClass("mb-5")
      } else if (this.storageService.getItem("encInfoHidden") === "true") {
        $(".informationRow").hide();
        $("#appRow").removeClass("mb-5");
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

  async handleActionText () {
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
      console.error('Action handling failed:', error);
      laddaManager.stopAll();
      ElementHandler.arrowsToCross();
    } finally {
      this.actionInProgress = false;
    }
  }

  async handleActionFiles () {
    const laddaManager = new LaddaButtonManager('.action-button');
    laddaManager.startAll();
    
    try {

      const inputFilesElem = $('#inputFiles')[0];
      const fileLength = inputFilesElem.files.length
      let result = false;
      let fileCounter = 0;
      $("#outputFiles").empty();
      for (let file of inputFilesElem.files) {
        const isEncrypted = await this.encryptionService.isEncryptedFile(file);
        laddaManager.setProgressAll(fileCounter / fileLength );
        if (isEncrypted) {
          result = await this.handleFileDecrypt(file);
          if (!result) {
            ElementHandler.arrowsToCross();
            this.formHandler.setFormValue('outputText', null);
            ElementHandler.setPlaceholderById('outputText', 'Decryption failed. Please check data or password.');
          }
        } else {
          result = await this.handleFileEncrypt(file);
          if (!result) {
            ElementHandler.arrowsToCross();
            this.formHandler.setFormValue('outputText', null);
            ElementHandler.setPlaceholderById('outputText', 'Encryption failed. Please check data or password.');
          }
        }
        ++fileCounter;
      }
      await this.postActionHandling(result, laddaManager);
    } catch (error) {
      console.error('Action handling failed:', error);
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ––––––– Text Encryption/Decryption Methods –––––––

  async handleEncrypt() {
    const { inputText, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    if (!inputText || !passphrase) return false;
    const algo = 'aesgcm';
    try {
      const usedOptions = await pbkdf2Service.getCurrentOptions(this.configManager);
      this.encryptionService.setPBKDF2Difficulty(usedOptions.roundDifficulty);
      this.encryptionService.setSaltLengthDifficulty( usedOptions.saltDifficulty);
      const encryptedB64 = await this.encryptionService.encryptText(
        inputText,
        passphrase,
        algo
      );
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
      console.error("Error Message:", error.message);
    console.error("Error Name:", error.name);
    console.error("Stack Trace:", error.stack);
    console.error("Full Error Object:", error);
      return false;
    }
  }

  async handleDataChange(event) {
    const inputText = event.target.value;
    const isEncrypted = await this.encryptionService.isEncrypted(inputText.trim());

    this.changeOperationVisuals(isEncrypted);
  }

  changeOperationVisuals (isEncrypted = false) {
    if (isEncrypted) {
      ElementHandler.blueToPinkBorder("inputText");
      ElementHandler.pinkToBlueBorder("outputText");
      ElementHandler.emptyPillBlue("notEncryptedPill");
      ElementHandler.emptyPillBlue("notEncryptedFilesPill");
      ElementHandler.fillPillPink("encryptedPill");
      ElementHandler.fillPillPink("encryptedFilesPill");
      ElementHandler.buttonClassPinkToBlue("action-button");
      $('#outputText').attr('placeholder', 'The decryption result appears here');
      $('.action-explanation').text('decryption');
      $('.action-button').attr('data-bs-original-title', 'Decrypt with AES-GCM-256');
      $('#outputFooter').text("Decrypted output is UTF-8 formatted.");
    } else {
      ElementHandler.pinkToBlueBorder("inputText");
      ElementHandler.blueToPinkBorder("outputText");
      ElementHandler.fillPillBlue("notEncryptedPill");
      ElementHandler.fillPillBlue("notEncryptedFilesPill");
      ElementHandler.emptyPillPink("encryptedPill");
      ElementHandler.emptyPillPink("encryptedFilesPill");
      ElementHandler.buttonClassBlueToPink("action-button");
      $('#outputText').attr('placeholder', 'The encryption result appears here');
      $('.action-explanation').text('encryption');
      $('.action-button').attr('data-bs-original-title', 'Encrypt with AES-GCM-256');
      $('#outputFooter').text("Encrypted output is base64 formatted.");
    }
  }

  // ––––––– Master Password & Application Encryption Methods –––––––

  async handleAppEncrypt() {
    ElementHandler.hide('encryptApplicationMissingPw');
    ElementHandler.hide('encryptApplicationMatchFail');
    const formHandlerLocal = new FormHandler("encryptApplicationForm");
    const { encryptApplicationMPw, encryptApplicationMPwConfirmation } = formHandlerLocal.getFormValues();
    if (!encryptApplicationMPw || !encryptApplicationMPwConfirmation) {
      ElementHandler.show('encryptApplicationMissingPw');
      return;
    }
    if (encryptApplicationMPw !== encryptApplicationMPwConfirmation) {
      ElementHandler.show('encryptApplicationMatchFail');
      return;
    }
    const laddaEncryptApplication = Ladda.create($('#encryptApplication')[0]);
    try {
      laddaEncryptApplication.start();
      laddaEncryptApplication.setProgress(0.7);
      await this.configManager.setMasterPassword(encryptApplicationMPw);
      $('#do-application-encryption').modal('hide');
      Swal.fire({
        icon: 'success',
        title: 'The application is encrypted!',
        text: "Remember your password.",
        timer: 2500,
        showCancelButton: false,
        confirmButtonText: "Ok",
      });
    } catch (err) {
      console.error(err);
    } finally {
      laddaEncryptApplication.stop();
    }
  }

  async handleAppDecrypt() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const formHandlerLocal = new FormHandler('applicationDecryptionForm');
    const { decryptApplicationMPw } = formHandlerLocal.getFormValues();
    if (!decryptApplicationMPw) {
      ElementHandler.buttonRemoveTextAddFail("decryptApplication");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("decryptApplication");
      this.actionInProgress = false;
      return;
    }
    const laddaDecryptApplication = Ladda.create($('#decryptApplication')[0]);
    try {
      laddaDecryptApplication.start();
      laddaDecryptApplication.setProgress(0.7);
      await this.configManager.unlockSession(decryptApplicationMPw);
      $('#do-application-decryption').modal('hide');
      const slotNames = await this.configManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, "keySlot");
      ElementHandler.show('removeApplicationEncryption');
      ElementHandler.hide('encryptApplicationModal');
      await this.pbkdf2Service.loadOptions();
      Swal.fire({
        icon: 'success',
        title: 'The application is decrypted!',
        text: "You can now use your saved data.",
        timer: 2500,
        showCancelButton: false,
        confirmButtonText: "Ok",
      });
      this.actionInProgress = false;
    } catch (err) {
      laddaDecryptApplication.stop();
      ElementHandler.buttonRemoveTextAddFail("decryptApplication");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("decryptApplication");
      this.actionInProgress = false;
    } finally {
      laddaDecryptApplication.stop();
    }
  }

  handleAppEncryptionRemove() {
    Swal.fire({
      icon: 'warning',
      title: 'Remove app encryption?',
      text: "You risk data exposure.",
      showCancelButton: true,
      confirmButtonText: "Remove",
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await this.configManager.removeMasterPassword();
          ElementHandler.hide('removeApplicationEncryption');
          ElementHandler.show('encryptApplicationModal');
          Swal.fire({
            icon: 'success',
            title: 'The encryption is removed',
            timer: 2500,
            showCancelButton: false,
            confirmButtonText: "Ok",
          });
        } catch (err) {
          console.error(err);
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
      fileListElem.text("No files selected.");
      return;
    }
    fileListElem.empty();
    const files = Array.from(inputFilesElem.files);
    const encryptionChecks = files.map(async file => {
      const isEncrypted = await this.encryptionService.isEncryptedFile(file);
      const li = isEncrypted 
        ? $('<span class="badge bg-pink rounded-pill me-1">').text(`${file.name} | ${this.formatBytes(file.size)}`)
        : $('<span class="badge bg-blue rounded-pill me-1">').text(`${file.name} | ${this.formatBytes(file.size)}`);
      fileListElem.append(li);
      return isEncrypted;
    });

    const results = await Promise.all(encryptionChecks);
    if (results.every(isEncrypted => isEncrypted)) {
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
      return;
    }
    const algo = 'aesgcm';
    const outputFilesDiv = $('#outputFiles');
    try {
      const usedOptions = await pbkdf2Service.getCurrentOptions(this.configManager);
      this.encryptionService.setPBKDF2Difficulty(usedOptions.roundDifficulty);
      this.encryptionService.setSaltLengthDifficulty( usedOptions.saltDifficulty);
      const blob = await this.encryptionService.encryptFile(file, passphrase, algo);
      const size = this.formatBytes(blob.size)
      const url = URL.createObjectURL(blob);
      const link = $('<a class="btn mb-1 btn-sm bg-pink text-white rounded-pill me-1">')
        .attr('href', url)
        .attr('download', file.name + ".enc")
        .text(`${file.name}.enc | ${size}`);
      outputFilesDiv.append(link)//.append('<br/>');
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async handleFileDecrypt(file) {
    const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length || !passphrase) {
      return;
    }
    const outputFilesDiv = $('#outputFiles');
    
    try {
      const decryptedBytes = await this.encryptionService.decryptFile(file, passphrase);
      const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const size = this.formatBytes(blob.size)
      if (blob.size === 0) {
        return false;
      }
      const downloadName = file.name.replace(".enc", "");
      const link = $('<a class="btn mb-1 btn-sm bg-blue text-white rounded-pill me-1">')
        .attr('href', url)
        .attr('download', downloadName)
        .text(`${downloadName} | ${size}`);
      outputFilesDiv.append(link)//.append('<br/>');
      return true;
    } catch (err) {
      console.error(err);
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
    ElementHandler.buttonRemoveTextAddSuccess("keyGenerate");
    await this.delay(1000);
    ElementHandler.buttonRemoveStatusAddText("keyGenerate");
    this.actionInProgress = false;

    function generateSecureRandomString(length) {
      const allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_+.,()[]*#?=&%$§€@";
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
      ElementHandler.buttonRemoveTextAddFail("keyCopy");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("keyCopy");
      this.actionInProgress = false;
      return;
    }
    try {
      await navigator.clipboard.writeText(keyToCopy);
      ElementHandler.buttonRemoveTextAddSuccess("keyCopy");
    } catch (err) {
      ElementHandler.buttonRemoveTextAddFail("keyCopy");
    } finally {
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("keyCopy");
      this.actionInProgress = false;
    }
  }

  toggleKey() {
    if ($("#hideKey").is(":checked")) {
      ElementHandler.hide("keyBlank");
      ElementHandler.show("keyPassword");
      this.formHandler.setFormValue("keyPassword", this.formHandler.formValues.keyBlank);
    } else {
      ElementHandler.hide("keyPassword");
      ElementHandler.show("keyBlank");
      this.formHandler.setFormValue("keyPassword", this.formHandler.formValues.keyBlank);
    }
  }

  async loadKey() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const { keySlot } = this.formHandler.formValues;
    if (!keySlot) {
      ElementHandler.buttonRemoveTextAddFail("loadKey");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("loadKey");
      this.actionInProgress = false;
      return;
    }
    try {
      const storedKey = await this.configManager.readSlotValue(keySlot);
      if (!storedKey) {
        ElementHandler.buttonRemoveTextAddFail("loadKey");
        await this.delay(1000);
        ElementHandler.buttonRemoveStatusAddText("loadKey");
        this.actionInProgress = false;
        return;
      }
      this.formHandler.setFormValue('keyBlank', storedKey);
      this.formHandler.setFormValue('keyPassword', storedKey);
      ElementHandler.buttonRemoveTextAddSuccess("loadKey");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("loadKey");
    } catch (error) {
      ElementHandler.buttonRemoveTextAddFail("loadKey");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("loadKey");
    }
    this.actionInProgress = false;
  }

  async saveKey() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const { keySlot, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    if (!keySlot) {
      ElementHandler.buttonRemoveTextAddFail("saveKey");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("saveKey");
      this.actionInProgress = false;
      return;
    }
    const keyToSave = hideKey ? keyPassword : keyBlank;
    if (!keyToSave) {
      ElementHandler.buttonRemoveTextAddFail("saveKey");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("saveKey");
      this.actionInProgress = false;
      return;
    }
    try {
      await this.configManager.setSlotValue(keySlot, keyToSave);
      ElementHandler.buttonRemoveTextAddSuccess("saveKey");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("saveKey");
    } catch (err) {
      ElementHandler.buttonRemoveTextAddFail("saveKey");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("saveKey");
    }
    this.actionInProgress = false;
  }

  async changeSlotName() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const formHandlerLocal = new FormHandler("newSlotForm");
    const { keySlotChange, slotName } = formHandlerLocal.getFormValues();
    if (!keySlotChange || !slotName) {
      ElementHandler.buttonRemoveTextAddFail("renameSlotAction");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("renameSlotAction");
      this.actionInProgress = false;
      return;
    }
    try {
      await this.configManager.setSlotName(keySlotChange, slotName);
      const slotNames = await this.configManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, "keySlot");
      ElementHandler.buttonRemoveTextAddSuccess("renameSlotAction");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("renameSlotAction");
      $('#slotName').val('');
    } catch (error) {
      ElementHandler.buttonRemoveTextAddFail("renameSlotAction");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("renameSlotAction");
    }
    this.actionInProgress = false;
  }

  // ––––––– Data Clearing and Utility –––––––

  removeAllData() {
    Swal.fire({
      icon: 'error',
      title: 'Clear all data?',
      text: "All local data will be rewritten with default values. This action can't be undone.",
      showCancelButton: true,
      confirmButtonText: "Clear",
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await this.configManager.deleteAllConfigData();
        await this.initUI();
        $('#do-application-decryption').modal('hide');
        Swal.fire({
          icon: 'success',
          title: 'All data deleted!',
          text: "The application is cleared.",
          timer: 2500,
          showCancelButton: false,
          confirmButtonText: "Ok",
        });
      }
    });
  }

  clearInput() {
    this.formHandler.setFormValue("inputText", "");
    this.handleDataChange({ target: { value: "" } });
  }

  async copyOutput() {
    const { outputText } = this.formHandler.formValues;
    if (this.actionInProgressCopy) return;
    this.actionInProgressCopy = true;
    if (!outputText) {
      ElementHandler.buttonRemoveTextAddFail("copyOutput");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("copyOutput");
      this.actionInProgressCopy = false;
      return;
    }
    try {
      await navigator.clipboard.writeText(outputText);
      ElementHandler.buttonRemoveTextAddSuccess("copyOutput");
    } catch (err) {
      ElementHandler.buttonRemoveTextAddFail("copyOutput");
    } finally {
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("copyOutput");
      this.actionInProgressCopy = false;
    }
  }
}