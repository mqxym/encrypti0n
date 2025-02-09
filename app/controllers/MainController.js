import { FormHandler } from '../helpers/FormHandler.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { ShowNotification } from '../helpers/ShowNotification.js';
import { LaddaButtonManager } from '../helpers/LaddaButtonHandler.js';
import { StorageService } from '../services/StorageService.js';
import { EncryptionService } from '../services/EncryptionService.js';
import { pbkdf2Service } from '../services/pbkdf2Service.js';
import { ConfigManager } from '../services/configManagement/ConfigManager.js';


/**
 * Binds to UI elements and orchestrates:
 * - text encryption/decryption
 * - file encryption/decryption
 * - saving/loading keys
 * - renaming slots
 * - saving settings
 * - clearing local data
 */
export class MainController {
  constructor(formId) {
    // Dependencies
    this.formHandler = new FormHandler(formId);
    this.storageService = new StorageService();
    this.encryptionService = new EncryptionService();
    this.confManager = new ConfigManager();
    this.pbkdf2Service = new pbkdf2Service('pbkdf2-modal',this.confManager);

    this.appVersion = "3.0.0a4";
    this.doFiles = false;
    
    this.bindButtons();
    this.initUI();
  }

  // Example of your original "bindInputs" approach:
  bindButtons() {
   
    document.querySelectorAll('.action-button').forEach(button => {
      button.addEventListener('click', () => {
          this.handleAction(); 
        });
    });

    document.getElementById('inputText').addEventListener('input', (event) => this.handleDataChange(event));
    document.getElementById('showTextEncryption').addEventListener('click', () => this.showTextInput());
    document.getElementById('showFilesEncryption').addEventListener('click', () => this.showFileInput());
    document.getElementById('PBKDF2Options').addEventListener('click', () => $('#pbkdf2-modal').modal('show'));
    document.getElementById('renameSlots').addEventListener('click', () => $('#renameSlotsModal').modal('show'));
    /*
    // Master password encryption of the application:
    */
    
    document.getElementById('encryptApplication').addEventListener('click', () => this.handleAppEncrypt());
    document.getElementById('decryptApplication').addEventListener('click', () => this.handleAppDecrypt());
    document.getElementById('removeApplicationEncryption').addEventListener('click', () => this.handleAppEncryptionRemove());
    document.getElementById('encryptApplicationModal').addEventListener('click', () => this.handleAppEncryptModal());
    // document.getElementById('removeApplicationEncryption').addEventListener('click', () => this.handleAppEncryptionRemove());
    
    // Clear text / copy output:
    document.getElementById('clearInput').addEventListener('click', () => this.clearInput());
    document.getElementById('copyOutput').addEventListener('click', () => this.copyOutput());
    
    document.getElementById('renameSlotAction').addEventListener('click', () => this.changeSlotName());
    /*
    // File input:
    document.getElementById('inputFiles').addEventListener('change', () => this.updateFileList());
    //document.getElementById('fileEncrypt').addEventListener('click', () => this.handleFileEncrypt());
    //document.getElementById('fileDecrypt').addEventListener('click', () => this.handleFileDecrypt());

    // Manage keys:
    */
    document.getElementById('keyGenerate').addEventListener('click', () => this.keyGenerate());
    document.getElementById('keyCopy').addEventListener('click', () => this.keyCopy());
    document.getElementById('hideKey').addEventListener('change', () => this.toggleKey());
    document.getElementById('loadKey').addEventListener('click', () => this.loadKey());
    document.getElementById('saveKey').addEventListener('click', () => this.saveKey());

    document.getElementById('removeAllData').addEventListener('click', () => this.removeAllData());
    document.getElementById('removeLocalDataDecryptionModal').addEventListener('click', () => this.removeAllData());
    
  }

  async initUI() {
    $(".version").text(this.appVersion);

    if (this.confManager.isUsingMasterPassword()) {
      ElementHandler.disable('encryptApplicationModal');
      $(document).off('click', '#encryptApplicationModal');
      $('#do-application-decryption').modal('show');
    } else {
      const slotNames = await this.confManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, "keySlot");
      await this.pbkdf2Service.loadOptions();
    }
    // no crypto api error message
    if (!window.crypto || !window.crypto.subtle) {
      Swal.fire({
        icon: 'error',
        title: 'Your browser does not support this application.',
        text: "Please update your browser or system.",
        showCancelButton: false,
        confirmButtonText: "Ok"
      })
    }
    //this.updateFileList();
  }

  showFileInput () {
    ElementHandler.fillButtonGray('showFilesEncryption');
    ElementHandler.emptyButtonGray('showTextEncryption');
    ElementHandler.show('fileEncryptionInput');
    ElementHandler.hide('textEncryptionInput');
    ElementHandler.show('fileEncryptionOutput');
    ElementHandler.hide('textEncryptionOutput');
    this.doFiles = true;
  }

  showTextInput () {
    ElementHandler.emptyButtonGray('showFilesEncryption');
    ElementHandler.fillButtonGray('showTextEncryption');
    ElementHandler.hide('fileEncryptionInput');
    ElementHandler.show('textEncryptionInput');
    ElementHandler.show('textEncryptionOutput');
    ElementHandler.hide('fileEncryptionOutput');
    this.doFiles = false;
  }

  async handleAction() {
    const { inputText } = this.formHandler.formValues;
  
    if (this.actionInProgress) return;
  
    this.actionInProgress = true;

    const laddaManager = new LaddaButtonManager('.action-button');
    laddaManager.startAll();
    laddaManager.setProgressAll(0.75);
  
    try {
      const isEncrypted = await this.encryptionService.isEncrypted(inputText);
      let result = false;
  
      if (isEncrypted) {
        ElementHandler.fillButtonClassBlue('action-button');
        result = await this.handleDecrypt();
        laddaManager.setProgressAll(1);
        if (!result) {
          ElementHandler.arrowsToCross();
        }
        ElementHandler.emptyButtonClassBlue('action-button');
      } else {
        ElementHandler.fillButtonClassPink('action-button');
        result = await this.handleEncrypt();
        laddaManager.setProgressAll(1);
        if (!result) {
          ElementHandler.arrowsToCross();
        }
        ElementHandler.emptyButtonClassPink('action-button');
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

  /**********************************
   * Simple text encryption/decryption
   **********************************/
  async handleEncrypt() {
    const { inputText, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    if (!inputText || !passphrase) {
      return false;
    }
    const algo = 'aesgcm';
   
    try {
      const usedOptions = await pbkdf2Service.getCurrentOptions(this.confManager);
      const encryptedB64 = await this.encryptionService.encryptData(inputText, passphrase, algo, usedOptions.roundDifficulty, usedOptions.saltDifficulty);
      this.formHandler.setFormValue('outputText', encryptedB64);
      return true;
    } catch (err) {
      return false;
    }
  }

  async handleDecrypt() {
    const { inputText, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    if (!inputText || !passphrase) {
      return false;
    }
    try {
      const decrypted = await this.encryptionService.decryptData(inputText, passphrase);
      this.formHandler.setFormValue('outputText', decrypted);
      return true;
    } catch (err) {
      return false;
    }
  }

  async handleDataChange (event) {
    const inputText = event.target.value;

    const isEncrypted = await this.encryptionService.isEncrypted(inputText.trim());

    if (isEncrypted) {
      ElementHandler.blueToPinkBorder("inputText");
      ElementHandler.pinkToBlueBorder("outputText");
      ElementHandler.emptyPillBlue("notEncryptedPill");
      ElementHandler.fillPillPink("encryptedPill");
      ElementHandler.buttonClassPinkToBlueOutline("action-button");
      document.getElementById('outputText').setAttribute('placeholder', 'The decryption result appears here');
      document.querySelectorAll('.action-explanation').forEach(span => {
        span.textContent = 'decryption';
     });
        document.querySelectorAll('.action-button').forEach(button => {
          button.setAttribute('data-bs-original-title', 'Decrypt with AES-GCM-256');
      });
      document.getElementById('outputFooter').textContent = "Decrypted output is UTF-8 formatted.";
    } else {
      ElementHandler.pinkToBlueBorder("inputText");
      ElementHandler.blueToPinkBorder("outputText");
      ElementHandler.fillPillBlue("notEncryptedPill");
      ElementHandler.emptyPillPink("encryptedPill");
      ElementHandler.buttonClassBlueToPinkOutline("action-button");
      document.getElementById('outputText').setAttribute('placeholder', 'The encryption result appears here');
      document.querySelectorAll('.action-explanation').forEach(span => {
        span.textContent = 'encryption';
      });
      document.querySelectorAll('.action-button').forEach(button => {
          button.setAttribute('data-bs-original-title', 'Encrypt with AES-GCM-256');
      });
      document.getElementById('outputFooter').textContent = "Encrypted output is base64 formatted.";
    }
  }

  /**********************************
   * Master Password encryption (application-level)
   **********************************/
  async handleAppEncrypt() {
    
    ElementHandler.hide('encryptApplicationMissingPw');
    ElementHandler.hide('encryptApplicationMatchFail');
    
    const { encryptApplicationMPw, encryptApplicationMPwConfirmation } = new FormHandler("encryptApplicationForm").getFormValues();
    if (!encryptApplicationMPw || !encryptApplicationMPwConfirmation) {
      ElementHandler.show('encryptApplicationMissingPw');
      return;
    }
    if (encryptApplicationMPw !== encryptApplicationMPwConfirmation) {
      ElementHandler.show('encryptApplicationMatchFail');
      return;
    }
    const laddaEncryptApplication = Ladda.create(document.getElementById('encryptApplication'));

    try {
      laddaEncryptApplication.start();
      laddaEncryptApplication.setProgress(0.7);
      await this.confManager.setMasterPassword(encryptApplicationMPw);
      Swal.fire({
        icon: 'success',
        title: 'The application is encrypted!',
        text: "Remember your password",
        timer: 2500,
        showCancelButton: false,
        confirmButtonText: "Ok",
      });
      
    } catch (err) {
      
    } finally {
      laddaEncryptApplication.stop();
    }   
  }

  async handleAppDecrypt() {
    if (this.actionInProgress) return;
    this.actionInProgress = true;

    const { decryptApplicationMPw } = new FormHandler('applicationDecryptionForm').getFormValues();
    if (!decryptApplicationMPw) {
      ElementHandler.buttonRemoveTextAddFail('decryptApplication');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('decryptApplication');
      this.actionInProgress = false;
      return;
    }
    const laddaDecryptApplication = Ladda.create(document.getElementById('decryptApplication'));

    try {
      laddaDecryptApplication.start();
      laddaDecryptApplication.setProgress(0.7);

      await this.confManager.unlockSession(decryptApplicationMPw);
      $('#do-application-decryption').modal('hide');
      const slotNames = await this.confManager.readSlotNames();
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
      ElementHandler.buttonRemoveTextAddFail('decryptApplication');
      await this.delay(500);
      ElementHandler.buttonRemoveStatusAddText('decryptApplication');
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
            await this.confManager.removeMasterPassword();
            ElementHandler.hide('removeApplicationEncryption');
            ElementHandler.show('encryptApplicationModal');
            Swal.fire({
              icon: 'success',
              title: 'The encryption is removed',
              //text: "Remember your password",
              timer: 2500,
              showCancelButton: false,
              confirmButtonText: "Ok",
            });
            
          } catch (err) {
            
            
          }
        } 
    });
    
  }

  handleAppEncryptModal () {
    if (this.confManager.isUsingMasterPassword()) {
      return;
    }
    $('#do-application-encryption').modal('show')
  }

  /**********************************
   * File-based encryption/decryption
   **********************************/
  updateFileList() {
    const fileListElem = document.getElementById('fileList');
    const inputFilesElem = document.getElementById('inputFiles');
    if (!inputFilesElem.files.length) {
      fileListElem.textContent = "No files selected.";
      return;
    }
    fileListElem.textContent = "";
    Array.from(inputFilesElem.files).forEach(file => {
      const li = document.createElement('li');
      li.textContent = `${file.name} (${file.size} bytes)`;
      fileListElem.appendChild(li);
    });
  }

  async handleFileEncrypt() {
    const { keyBlank, keyPassword, hideKey, algorithmChoice } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    const inputFilesElem = document.getElementById('inputFiles');
    if (!inputFilesElem.files.length || !passphrase) {
      alert("Please select files and provide passphrase.");
      return;
    }

    const algo = algorithmChoice || 'aesgcm';
    const outputFilesDiv = document.getElementById('outputFiles');
    outputFilesDiv.innerHTML = "Encrypted files (download links):<br/>";

    for (let file of inputFilesElem.files) {
      const arrayBuf = await file.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuf);

      try {
        const encryptedB64 = await this.encryptionService.encryptData(fileBytes, passphrase, algo);
        // Offer download
        const blob = new Blob([encryptedB64], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = file.name + ".encrypted.txt";
        link.textContent = `Download Encrypted ${file.name}`;
        outputFilesDiv.appendChild(link);
        outputFilesDiv.appendChild(document.createElement('br'));
      } catch (err) {
        console.error(err);
        alert(`File encryption failed for ${file.name}: ${err.message}`);
      }
    }
  }

  async handleFileDecrypt() {
    const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const passphrase = hideKey ? keyPassword : keyBlank;
    const inputFilesElem = document.getElementById('inputFiles');
    if (!inputFilesElem.files.length || !passphrase) {
      alert("Please select files and provide passphrase.");
      return;
    }

    const outputFilesDiv = document.getElementById('outputFiles');
    outputFilesDiv.innerHTML = "Decrypted files (download links):<br/>";

    for (let file of inputFilesElem.files) {
      const arrayBuf = await file.arrayBuffer();
      // We assume it’s a text file containing base64 with header + ciphertext
      const fileText = new TextDecoder().decode(new Uint8Array(arrayBuf));

      try {
        const decryptedBytes = await this.encryptionService.decryptData(fileText, passphrase);
        // Convert decryptedBytes (string) back to Blob for download
        const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = file.name.replace(".encrypted.txt", "") + ".decrypted";
        link.textContent = `Download Decrypted ${file.name}`;
        outputFilesDiv.appendChild(link);
        outputFilesDiv.appendChild(document.createElement('br'));
      } catch (err) {
        console.error(err);
        alert(`File decryption failed for ${file.name}: ${err.message}`);
      }
    }
  }

  /**********************************
   * Key management (slots)
   **********************************/
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
    navigator.clipboard.writeText(keyToCopy).then(async () => {
      ElementHandler.buttonRemoveTextAddSuccess("keyCopy");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("keyCopy");
      this.actionInProgress = false;
    }, async err => {
      ElementHandler.buttonRemoveTextAddFail("keyCopy");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("keyCopy");
      this.actionInProgress = false;
      return;
    });
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
      this.formHandler.setFormValue("keyPassword", this.formHandler.formValues.keyBlankkeyPassword);
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
      const storedKey = await this.confManager.readSlotValue(keySlot);
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
      // If app is encrypted, you’d encrypt it with the master password
      await this.confManager.setSlotValue(keySlot, keyToSave);
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

    const { keySlotChange, slotName } = new FormHandler("newSlotForm").getFormValues();
    if (!keySlotChange || !slotName) {
      ElementHandler.buttonRemoveTextAddFail("renameSlotAction");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("renameSlotAction");
      this.actionInProgress = false;
      return;
    }
    try {
      await this.confManager.setSlotName(keySlotChange, slotName);

      const slotNames = await this.confManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, "keySlot");
      ElementHandler.buttonRemoveTextAddSuccess("renameSlotAction");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("renameSlotAction");
      $('#slotName').val('');
      this.actionInProgress = false;
    } catch (error) {
      ElementHandler.buttonRemoveTextAddFail("renameSlotAction");
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText("renameSlotAction");
      this.actionInProgress = false;
    }
  }

  /**********************************
   * Clearing local data
   **********************************/

  removeAllData() {
    Swal.fire({
      icon: 'error',
      title: 'Clear all data?',
      text: "This action can't be undone.",
      showCancelButton: true,
      confirmButtonText: "Clear",
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
        if (result.isConfirmed) {
          await this.confManager.deleteAllConfigData();
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

  /**********************************
   * Utility
   **********************************/
  clearInput() {
    this.formHandler.setFormValue("inputText", "");
    let event = { target: { value : ""},};
    this.handleDataChange(event);
  }

  copyOutput() {
    const { outputText } = this.formHandler.formValues;
    if (!outputText) {
      return;
    }
    navigator.clipboard.writeText(outputText).then(() => {;
    }, err => {
      console.error(err);
    });
  }
}