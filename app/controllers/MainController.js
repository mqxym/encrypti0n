import { FormHandler } from '../helpers/FormHandler.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { StorageService } from '../services/StorageService.js';
import { EncryptionService } from '../services/EncryptionService.js';
import { ApplicationEncryptionManager } from '../services/ApplicationEncryptionManager.js';


/**
 * Binds to UI elements and orchestrates:
 * - text encryption/decryption
 * - file encryption/decryption
 * - saving/loading keys
 * - renaming slots
 * - saving settings
 * - toggling master password usage
 * - clearing local data
 */
export class MainController {
  constructor(formId) {
    // Dependencies
    this.formHandler = new FormHandler(formId);
    this.storageService = new StorageService();
    this.encryptionService = new EncryptionService();
    this.appEncManager = new ApplicationEncryptionManager();

    // Keep references to your needed UI elements (IDs from index.html):
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
    /*
    // Master password encryption of the application:
    document.getElementById('encryptApplication').addEventListener('click', () => this.handleAppEncrypt());
    document.getElementById('decryptApplication').addEventListener('click', () => this.handleAppDecrypt());
    document.getElementById('removeApplicationEncryption').addEventListener('click', () => this.handleAppEncryptionRemove());
    */
    // Clear text / copy output:
    document.getElementById('clearInput').addEventListener('click', () => this.clearInput());
    document.getElementById('copyOutput').addEventListener('click', () => this.copyOutput());
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
    /*
    document.getElementById('downloadSavedKeys').addEventListener('click', () => this.downloadSavedKeys());
    document.getElementById('keyUpload').addEventListener('change', (e) => this.keyUpload(e));

    // Slot names:
    document.getElementById('changeSlotName').addEventListener('click', () => this.changeSlotName());

    // Settings:
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
    document.getElementById('setGc').addEventListener('click', () => this.setGc());
    document.getElementById('setCc').addEventListener('click', () => this.setCc());

    // Toggling hashing, master PW usage, etc.:
    document.getElementById('doHashing').addEventListener('change', () => this.toggleHashing());
    document.getElementById('useMasterPW').addEventListener('change', () => this.toggleMasterPassword());

    // Clear local data:
    document.getElementById('removeSavedHashes').addEventListener('click', () => this.removeSavedHashes());
    document.getElementById('removeSavedKeys').addEventListener('click', () => this.removeSavedKeys());
    document.getElementById('removeSlotNames').addEventListener('click', () => this.removeSlotNames());
    document.getElementById('removeConfig').addEventListener('click', () => this.removeConfig());
    document.getElementById('removeAllData').addEventListener('click', () => this.removeAllData());
    */
  }

  initUI() {
    this.actionLadda = Ladda.create(document.getElementById('actionRight'));

    const isEncrypted = this.appEncManager.checkIfEncrypted();
    if (isEncrypted) {
      // e.g. show a modal to prompt the user to enter master password
      console.log('Application is encrypted, please decrypt...');
      // You might show a bootstrap modal with id #do-application-decryption
      // For demonstration, we just log.
    }
    //this.updateFileList();
  }

  async handleAction() {
    const { inputText } = this.formHandler.formValues;
    if (this.actionInProgress) return;
    this.actionInProgress = true;
    this.actionLadda.start();
    this.actionLadda.setProgress(0.75);
    let result = false;
    

    const isEncrypted = await this.encryptionService.isEncrypted(inputText);

    if (isEncrypted) {
      ElementHandler.fillButtonClassBlue('action-button');
      result = await this.handleDecrypt();
      this.actionLadda.setProgress(1);
      if (result) {
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        ElementHandler.arrowsToCross();
      } 
      ElementHandler.emptyButtonClassBlue('action-button');
    } else {
      ElementHandler.fillButtonClassPink('action-button');
      result = await this.handleEncrypt();
      this.actionLadda.setProgress(1);
      if (result) {
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        ElementHandler.arrowsToCross();
      }
     
      ElementHandler.emptyButtonClassPink('action-button');
    }
    

    if (result) {
      this.actionLadda.stop();
      ElementHandler.arrowsToCheck();
      await new Promise(resolve => setTimeout(resolve, 2500));
      ElementHandler.checkToArrows();
    } else {
      this.actionLadda.stop();
      await new Promise(resolve => setTimeout(resolve, 2500));
      ElementHandler.crossToArrows();
    }

    this.actionInProgress = false;
   
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
      const encryptedB64 = await this.encryptionService.encryptData(inputText, passphrase, algo);
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
    const { encryptApplicationMPw, encryptApplicationMPwConfirmation } = this.formHandler.formValues;
    if (!encryptApplicationMPw || !encryptApplicationMPwConfirmation) {
      alert("Please fill in both password fields.");
      return;
    }
    if (encryptApplicationMPw !== encryptApplicationMPwConfirmation) {
      alert("Master password confirmation does not match!");
      return;
    }
    // if app is already encrypted, pass oldMPw to re-encrypt
    let oldMPw = null;
    const isEncrypted = this.appEncManager.checkIfEncrypted();
    if (isEncrypted) {
      // ask user for old master password or retrieve it from memory if you stored it
      oldMPw = "oldPasswordHere";
    }
    try {
      await this.appEncManager.encryptApplication(encryptApplicationMPw, oldMPw);
      alert("Application encryption successful!");
    } catch (err) {
      console.error(err);
      alert("Error encrypting application: " + err.message);
    }
  }

  async handleAppDecrypt() {
    const { decryptApplicationMPw } = this.formHandler.formValues;
    if (!decryptApplicationMPw) {
      alert("Please provide master password to decrypt.");
      return;
    }
    try {
      await this.appEncManager.decryptApplication(decryptApplicationMPw);
      alert("Application decryption successful!");
    } catch (err) {
      console.error(err);
      alert("Error decrypting application: " + err.message);
    }
  }

  handleAppEncryptionRemove() {
    // pass the current master password if needed
    const { decryptApplicationMPw } = this.formHandler.formValues;
    try {
      this.appEncManager.removeApplicationEncryption(decryptApplicationMPw);
      alert("Application encryption removed!");
    } catch (err) {
      console.error(err);
      alert("Error removing application encryption: " + err.message);
    }
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
  keyGenerate() {
    // Generate a random passphrase-like string
    const randomKey = Math.random().toString(36).substring(2) + Date.now().toString(36);
    this.formHandler.setFormValue('keyBlank', randomKey);
    this.formHandler.setFormValue('keyPassword', randomKey);
  }

  keyCopy() {
    const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    const keyToCopy = hideKey ? keyPassword : keyBlank;
    if (!keyToCopy) {
      return;
    }
    navigator.clipboard.writeText(keyToCopy).then(() => {
     
    }, err => {
      console.error(err);
      
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

  loadKey() {
    const { keySlot } = this.formHandler.formValues;
    if (!keySlot) {
      return;
    }
    const storedKey = this.storageService.getItem("encKey" + keySlot);
    if (!storedKey) {
      return;
    }
    // If application is encrypted, you might need to decrypt this storedKey with master PW
    // else just set it
    this.formHandler.setFormValue('keyBlank', storedKey);
    this.formHandler.setFormValue('keyPassword', storedKey);
  }

  saveKey() {
    const { keySlot, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
    if (!keySlot) {
      return;
    }
    const keyToSave = hideKey ? keyPassword : keyBlank;
    if (!keyToSave) {
      return;
    }
    // If app is encrypted, you’d encrypt it with the master password
    this.storageService.setItem("encKey" + keySlot, keyToSave);
  }

  changeSlotName() {
    const { keySlotChange, slotName } = this.formHandler.formValues;
    if (!keySlotChange || !slotName) {
      return;
    }
    // You have an existing “slotNames” in localStorage
    let slotNamesJSON = this.storageService.getItem("slotNames");
    let slotNames = slotNamesJSON ? JSON.parse(slotNamesJSON) : {};
    slotNames[keySlotChange] = slotName;
    this.storageService.setItem("slotNames", JSON.stringify(slotNames));
    alert(`Slot #${keySlotChange} renamed to "${slotName}".`);
  }

  downloadSavedKeys() {
    // Gather all keys, config, slot names, etc. into an object
    let exportedData = {};
    for (let i = 1; i <= 10; i++) {
      const k = this.storageService.getItem("key" + i);
      if (k) {
        exportedData["key" + i] = k;
      }
    }
    // Include config or slot names if desired
    exportedData["cryptoConfig"] = this.storageService.getItem("cryptoConfig") || "";
    exportedData["generalConfig"] = this.storageService.getItem("generalConfig") || "";
    exportedData["slotNames"] = this.storageService.getItem("slotNames") || "";

    const json = JSON.stringify(exportedData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = "keysBackup.json";
    link.click();
    URL.revokeObjectURL(url);
    alert("Saved keys (and config) downloaded as JSON.");
  }

  keyUpload(e) {
    const file = e.target.files[0];
    if (!file) {
      alert("No file selected.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        // Re-import 
        Object.keys(data).forEach(k => {
          this.storageService.setItem(k, data[k]);
        });
        alert("Keys (and config) successfully uploaded.");
      } catch (err) {
        console.error(err);
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  /**********************************
   * Settings
   **********************************/
  saveSettings() {
    // Example: store some bits from form 
    const ccValue = this.generateCryptoHeader();
    const gcValue = this.generateGeneralSettingsHeader();
    this.storageService.setItem("cryptoConfig", ccValue.toString());
    this.storageService.setItem("generalConfig", gcValue.toString());
    alert("Settings saved with cryptoConfig=" + ccValue + " & generalConfig=" + gcValue);
  }

  setGc() {
    // Example usage from your code
    const { gcValue } = this.formHandler.formValues;
    this.storageService.setItem("generalConfig", gcValue);
    alert("General config updated => " + gcValue);
  }

  setCc() {
    const { ccValue } = this.formHandler.formValues;
    this.storageService.setItem("cryptoConfig", ccValue);
    alert("Crypto config updated => " + ccValue);
  }

  toggleHashing() {
    console.log("Hashing toggled => adjust UI checkboxes, etc.");
  }

  toggleMasterPassword() {
    console.log("Master password usage toggled => show/hide input...");
  }

  generateCryptoHeader() {
    // Return an integer from form settings
    return 42; // placeholder
  }

  generateGeneralSettingsHeader() {
    return 7; // placeholder
  }

  /**********************************
   * Clearing local data
   **********************************/
  removeSavedHashes() {
    this.storageService.deleteStoredHashes();
    alert("Saved hashes cleared.");
  }

  removeSavedKeys() {
    this.storageService.deleteStoredKeys();
    alert("Saved keys cleared.");
  }

  removeSlotNames() {
    this.storageService.deleteSlotNames();
    alert("Slot names cleared.");
  }

  removeConfig() {
    this.storageService.deleteConfigs();
    alert("Configs cleared.");
  }

  removeAllData() {
    this.storageService.deleteAllData();
    alert("All data cleared.");
  }

  /**********************************
   * Utility
   **********************************/
  clearInput() {
    this.formHandler.setFormValue("inputText", "");
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