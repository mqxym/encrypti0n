import { FormHandler } from '../helpers/FormHandler.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { ShowNotification } from '../helpers/ShowNotification.js';
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
    this.storageService = new StorageService();
    this.encryptionService = new EncryptionService();
    this.configManager = new ConfigManager();
    this.pbkdf2Service = new pbkdf2Service('pbkdf2-modal', this.configManager);
    
    // Application state and version
    this.appVersion = "3.0.0a5";
    this.doFiles = false;
    this.actionInProgress = false;
    this.actionInProgressCopy = false;
  }

  /**
   * Initialize the controller
   */
  init() {
    this.bindUIEvents();
    this.initUI();
  }

  /**
   * Bind all DOM events using jQuery.
   */
  bindUIEvents() {
    // General actions
    $('.action-button').on('click', () => this.handleAction());
    $('#inputText').on('input', (event) => this.handleDataChange(event));
    $('#showTextEncryption').on('click', () => this.showTextInput());
    $('#showFilesEncryption').on('click', () => this.showFileInput());
    $('#PBKDF2Options').on('click', () => $('#pbkdf2-modal').modal('show'));
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
   * Initialize the UI with default values and perform compatibility checks.
   */
  async initUI() {
    $(".version").text(this.appVersion);
    if (this.configManager.isUsingMasterPassword()) {
      ElementHandler.disable('encryptApplicationModal');
      $(document).off('click', '#encryptApplicationModal');
      $('#do-application-decryption').modal('show');
    } else {
      const slotNames = await this.configManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, "keySlot");
      await this.pbkdf2Service.loadOptions();
      const randomKey = Math.random().toString(36).substring(2) + Date.now().toString(36);
      this.formHandler.setFormValue('keyBlank', randomKey);
      this.formHandler.setFormValue('keyPassword', randomKey);
    }
  }

  // ––––––– UI Toggle Methods –––––––

  showFileInput() {
    ElementHandler.fillButtonGray('showFilesEncryption');
    ElementHandler.emptyButtonGray('showTextEncryption');
    ElementHandler.show('fileEncryptionInput');
    ElementHandler.hide('textEncryptionInput');
    ElementHandler.show('fileEncryptionOutput');
    ElementHandler.hide('textEncryptionOutput');
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

  // ––––––– Action Orchestration –––––––

  async handleAction() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
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

  // ––––––– Encryption/Decryption Methods –––––––

  async handleEncrypt() {
    const { inputText, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    if (!inputText || !passphrase) return false;
    const algo = 'aesgcm';
    try {
      const usedOptions = await pbkdf2Service.getCurrentOptions(this.configManager);
      const encryptedB64 = await this.encryptionService.encryptData(
        inputText,
        passphrase,
        algo,
        usedOptions.roundDifficulty,
        usedOptions.saltDifficulty
      );
      this.formHandler.setFormValue('outputText', encryptedB64);
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async handleDecrypt() {
    const { inputText, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    if (!inputText || !passphrase) return false;
    try {
      const decrypted = await this.encryptionService.decryptData(inputText, passphrase);
      this.formHandler.setFormValue('outputText', decrypted);
      return true;
    } catch (err) {
      return false;
    }
  }

  async handleDataChange(event) {
    const inputText = event.target.value;
    const isEncrypted = await this.encryptionService.isEncrypted(inputText.trim());

    if (isEncrypted) {
      ElementHandler.blueToPinkBorder("inputText");
      ElementHandler.pinkToBlueBorder("outputText");
      ElementHandler.emptyPillBlue("notEncryptedPill");
      ElementHandler.fillPillPink("encryptedPill");
      ElementHandler.buttonClassPinkToBlue("action-button");
      $('#outputText').attr('placeholder', 'The decryption result appears here');
      $('.action-explanation').text('decryption');
      $('.action-button').attr('data-bs-original-title', 'Decrypt with AES-GCM-256');
      $('#outputFooter').text("Decrypted output is UTF-8 formatted.");
    } else {
      ElementHandler.pinkToBlueBorder("inputText");
      ElementHandler.blueToPinkBorder("outputText");
      ElementHandler.fillPillBlue("notEncryptedPill");
      ElementHandler.emptyPillPink("encryptedPill");
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
        text: "Remember your password",
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

  // ––––––– File Operations –––––––

  updateFileList() {
    const fileListElem = $('#fileList');
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length) {
      fileListElem.text("No files selected.");
      return;
    }
    fileListElem.empty();
    Array.from(inputFilesElem.files).forEach(file => {
      const li = $('<li>').text(`${file.name} (${file.size} bytes)`);
      fileListElem.append(li);
    });
  }

  async handleFileEncrypt() {
    const { keyBlank, keyPassword, hideKey, algorithmChoice } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length || !passphrase) {
      alert("Please select files and provide passphrase.");
      return;
    }
    const algo = algorithmChoice || 'aesgcm';
    const outputFilesDiv = $('#outputFiles');
    outputFilesDiv.html("Encrypted files (download links):<br/>");

    for (let file of inputFilesElem.files) {
      const arrayBuf = await file.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuf);
      try {
        const encryptedB64 = await this.encryptionService.encryptData(fileBytes, passphrase, algo);
        const blob = new Blob([encryptedB64], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = $('<a>')
          .attr('href', url)
          .attr('download', file.name + ".encrypted.txt")
          .text(`Download Encrypted ${file.name}`);
        outputFilesDiv.append(link).append('<br/>');
      } catch (err) {
        console.error(err);
        alert(`File encryption failed for ${file.name}: ${err.message}`);
      }
    }
  }

  async handleFileDecrypt() {
    const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length || !passphrase) {
      alert("Please select files and provide passphrase.");
      return;
    }
    const outputFilesDiv = $('#outputFiles');
    outputFilesDiv.html("Decrypted files (download links):<br/>");

    for (let file of inputFilesElem.files) {
      const arrayBuf = await file.arrayBuffer();
      const fileText = new TextDecoder().decode(new Uint8Array(arrayBuf));
      try {
        const decryptedBytes = await this.encryptionService.decryptData(fileText, passphrase);
        const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const downloadName = file.name.replace(".encrypted.txt", "") + ".decrypted";
        const link = $('<a>')
          .attr('href', url)
          .attr('download', downloadName)
          .text(`Download Decrypted ${file.name}`);
        outputFilesDiv.append(link).append('<br/>');
      } catch (err) {
        console.error(err);
        alert(`File decryption failed for ${file.name}: ${err.message}`);
      }
    }
  }

  // ––––––– Key Management Methods –––––––

  async keyGenerate() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    const randomKey = Math.random().toString(36).substring(2) + Date.now().toString(36);
    this.formHandler.setFormValue('keyBlank', randomKey);
    this.formHandler.setFormValue('keyPassword', randomKey);
    ElementHandler.buttonRemoveTextAddSuccess("keyGenerate");
    await this.delay(1000);
    ElementHandler.buttonRemoveStatusAddText("keyGenerate");
    this.actionInProgress = false;
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
      console.log("Hide password");
    } else {
      ElementHandler.hide("keyPassword");
      ElementHandler.show("keyBlank");
      this.formHandler.setFormValue("keyPassword", this.formHandler.formValues.keyBlank);
      console.log("Show password");
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