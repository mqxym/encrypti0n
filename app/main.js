class Main {

    constructor (formHandler) {
        this.formHandler = formHandler;

        if (!this.getFormValue("hideKey")) {
          toggleVisibility("keyBlank", false);
          toggleVisibility("keyPassword", true); 
        }

        if (this.readCryptoSettings()) {
          if (this.readGeneralSettings()) {
            this.setSettings(this.readCryptoSettings(), this.readGeneralSettings());
          } else {
            this.setSettings(this.readCryptoSettings());
          }
        }

        this.changeType();
        this.toggleHashing();

        $('input[type=radio][name=type]').on('change', this.changeType.bind(this));
        $('#inputFiles').on('change', this.updateFileList.bind(this));

        $('#action').on('click', this.action.bind(this));
        $('#clearInput').on('click', this.clearInput.bind(this));
        $('#copyOutput').on('click', this.copyOutput.bind(this));

        $('#keyGenerate').on('click', this.keyGenerate.bind(this));
        $('#keyCopy').on('click', this.keyCopy.bind(this));
        $('#hideKey').on('change', this.toggleKey.bind(this));
        $('#loadKey').on('click', this.loadKey.bind(this));
        $('#saveKey').on('click', this.saveKey.bind(this));

        $('#saveSettings').on('click', this.saveSettings.bind(this));
        $('#doHashing').on('change', this.toggleHashing.bind(this));

    }

    getFormValue(name) {
        return this.formHandler.formValues[name];
    }

    setFormValue (key, value) {
      let valuesToSet = {};
      valuesToSet[key] = value;
      this.formHandler.setFormValues(valuesToSet);
    }

    setFormValues (values) {
      this.formHandler.setFormValues(values);
    }

    getMethods () {
      return {
        doAES: this.getFormValue("doAES"),
        doBF: this.getFormValue("doBF"),
        doXOR: this.getFormValue("doXOR"),
      };
    }

    getSettings () {
      return {
        methods: this.getMethods(),
        doHashing: this.getFormValue("doHashing"),
        doHashSalting: this.getFormValue("doHashSalting"),
        doRoundOffset: this.getFormValue("doRoundOffset"),
        hashDifficulty: this.getFormValue("hashDifficulty"),
        type: this.getFormValue("type"),
        saveHashes: this.getFormValue("saveHashes"),
      }
    }

    setSettings (cryptoHeader, generalSettingsHeader = false) {
      const cHeader = parseInt(cryptoHeader);

      let settings = {};

      settings["doAES"] = isBitSet(cHeader, 0);
      settings["doBF"] = isBitSet(cHeader, 1);
      settings["doXOR"] = isBitSet(cHeader, 2);
      settings["doHashing"] = isBitSet(cHeader, 3);
      settings["doHashSalting"] = isBitSet(cHeader, 4);
      settings["doRoundOffset"] = isBitSet(cHeader, 5);

      if (isBitSet(cHeader, 6)) {
        settings["hashDifficulty"] = "low";
      } else if (isBitSet(cHeader, 7)) {
        settings["hashDifficulty"] = "high";
      } else {
        settings["hashDifficulty"] = "medium";
      }

      if(generalSettingsHeader) {
        const gsHeader = parseInt(generalSettingsHeader);
        if (isBitSet(gsHeader, 0)) {
          settings["type"] = "doText";
        } else if (isBitSet(gsHeader, 1)) {
          settings["type"] = "doFiles";
        }
        settings["saveHashes"] = isBitSet(gsHeader, 2);
      }

      console.log("Crypto settings id " + this.readCryptoSettings() + " are loaded.");
      console.log("General settings id " + this.readCryptoSettings() + " are loaded.");
      this.setFormValues(settings);
    }

    changeType () {
      const selectedRadioValue = $('input[type=radio][name=type]:checked').val();

      if (selectedRadioValue === "doText") {
        toggleVisibility("inputText", false);
        toggleVisibility("inputFilesDiv", true);
        toggleVisibility("fileList", true);
        toggleVisibility("outputText", false);
        toggleVisibility("outputFiles", true);
        toggleVisibility("divClearInput", false);
        toggleVisibility("divCopyOutput", false);
        console.log("Use text encryption.");
      } else {
        toggleVisibility("inputText", true);
        toggleVisibility("inputFilesDiv", false);
        toggleVisibility("fileList", false);
        toggleVisibility("outputText", true);
        toggleVisibility("outputFiles", false);
        toggleVisibility("divClearInput", true);
        toggleVisibility("divCopyOutput", true);
        console.log("Use file encryption.");
      }
    }

    updateFileList() {
      const fileList = $('#inputFiles')[0].files;
      const fileListContainer = $('#fileList');
      fileListContainer.empty();

      if (fileList.length === 0) {
        fileListContainer.text("No files selected.");
      } else {
        fileListContainer.text("Selected files:");
        const ul = $('<ul>');
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const li = $('<li>').text(`${file.name} (${formatBytes(file.size)})`);
          ul.append(li);
        }
        fileListContainer.append(ul);
      }
    }

    clearInput() {
      this.setFormValue("inputText", "");
    }

    copyOutput() {
      copyTextElement("outputText");
      ShowNotification.success("Success", "Your output was copied.");
    }

    async action () {
      if (this.getFormValue("type") === "doFiles") {
        ShowNotification.error("Error", "File encryption is not supported right now.");
        return;
      }

      let key = "";
      if (this.getFormValue("hideKey")) {
        key = this.getFormValue("keyPassword");
      } else {
        key = this.getFormValue("keyBlank");
      }
      const text = this.getFormValue("inputText"); 

      if(!key) {
        console.log("No key set.");
        ShowNotification.error("No key", "Your key is empty.");
        return;
      }

      if(!text && this.getFormValue("type") === "doText") {
        console.log("Input is empty.");
        ShowNotification.error("No input", "Your text input is empty.");
        return;
      }

      const cryptoHeader = this.checkForHeader(text);

      if (cryptoHeader) {
        this.setSettings(cryptoHeader);
        this.toggleHashing(); //When needed activate the hashing checkboxes
      }

      const settings = this.getSettings();
      const methods = settings.methods;

      if (!methods.doAES && !methods.doBF && !methods.doXOR) {
        console.log("No encryption method set.");
        ShowNotification.error("No method", "No encryption method is set.");
        return;
      }

      //Hashes the password
      if(settings.doHashing) {
        FormHandler.toggleButton("action", true);
        if (settings.hashDifficulty == "medium" || settings.hashDifficulty == "high") {
          ShowNotification.warning("Key hashing started", "Please wait while the hash process is running.");
        }
        
        await new Promise(r => setTimeout(r, 50));
        hashPassword(key, 
          settings.hashDifficulty, 
          settings.doRoundOffset, 
          settings.doHashSalting);
        FormHandler.toggleButton("action", false);

        if (settings.hashDifficulty == "medium" || settings.hashDifficulty == "high") {
          ShowNotification.success("Process finished" , "Hash process finished.");
        }
        
      }

      

      if (cryptoHeader) {
        //If cryptoHeader: decrypt
        const cipher = removeBeforeFirstEqual(text);
        const decryptedText = this.decryptText(key, cipher, methods)
        if (!decryptedText) {
          ShowNotification.error("Decryption error", "Check your key or your input.");
        }
        this.setFormValue("outputText", decryptedText);

      } else {
        //encrypt
        const encryptedText = this.encryptText(key, text, methods);
        const cryptoHeader = this.generateCryptoHeader();
        this.setFormValue("outputText", cryptoHeader + "=" + encryptedText);       
      }

      //Notification
    }

    //Encrypt text with the selected method
    //Returns b64 encrypted string
    encryptText (key, text, methods) {
      let encryptedText = text;
      
      if (methods.doXOR) {
        console.log("Start XOR Encryption...");
	      encryptedText = CryptoWrapper.encryptXOR(encryptedText, key);
      }
      if (methods.doBF) {
        console.log("Start Blowfish Encryption...");
	      encryptedText = CryptoWrapper.encryptBF(encryptedText, key);
      }
      if (methods.doAES) {
        console.log("Start AES Encryption...");
	      encryptedText = CryptoWrapper.encryptAES(encryptedText, key);
      }
      return encryptedText;
    }


    //Decrypt text with the selected methods
    //Returns utf-8 encoded string
    decryptText (key, cipher, methods) {
      try {

        let decrypted = cipher; 

        if (methods.doAES) {
          console.log("Start AES Decryption...");  
          decrypted = CryptoWrapper.decryptAES(decrypted, key);
        }

        if (methods.doBF) {
          console.log("Start Blowfish Decryption...");
          decrypted = CryptoWrapper.decryptBF(decrypted, key);
        }

        if (methods.doXOR) {
          console.log("Start XOR Decryption")
          decrypted = CryptoWrapper.decryptXOR(decrypted, key);
        }
      
       
        return decrypted;
      }
      catch(err) {
        return "";
      }
    }

    keyGenerate() {
      const seed = Math.random() + "+" + Math.random() + "+" + Math.random();
      const key = CryptoJS.AES.encrypt(seed, "69.420" + seed).toString().substr(10);
      const formValues = {
        keyBlank: key,
        keyPassword: key
      };
      this.setFormValues(formValues);
    }

    keyCopy() {
      if ($("#hideKey").is(":checked")) {
        if(this.getFormValue("keyPassword") === "") {
          ShowNotification.error("Error", "No key to copy.");
          console.log("No key to copy.");
          return;
        }
      } else {
        if(this.getFormValue("keyBlank") === "") {
          ShowNotification.error("Error", "No key to copy.");
          console.log("No key to copy.");
          return;
        }
      }
      

      if (localStorage.getItem("copyAlert")) {
        if ($("#hideKey").is(":checked")) {
          checkCheckbox("hideKey", false);
          this.toggleKey();
        }
        copyTextElement("keyBlank");
        ShowNotification.success("Success", "Your key was copied.");
      } else {
        if ($("#hideKey").is(":checked")) {
          //Sweet alert
          swal({
            title: "Reveal key?",
            text: "When you copy a key it will be shown.",
            type: "warning",
            confirmButtonText: "Copy, don't show again",
            showCancelButton: true,
            className: "custom-modal",
          }, function (confirmed) {
            if (confirmed) {
              Main.keyCopyAfterAlert();
              localStorage.setItem("copyAlert", "true");
            }
          });
        } else {
          copyTextElement("keyBlank");
          ShowNotification.success("Success", "Your key was copied.");
        }
      }
    }

    static keyCopyAfterAlert () {
      if ($("#hideKey").is(":checked")) {
        checkCheckbox("hideKey", false);
        //ToggleKey
        toggleVisibility("keyBlank", false);
        toggleVisibility("keyPassword", true);
        $("#keyBlank").val($("#keyPassword").val());
        console.log("Show password");

      }
      copyTextElement("keyBlank");   
      ShowNotification.success("Success", "Your key was copied."); 
    }

    toggleKey () {
      if ($("#hideKey").is(":checked")) {
        toggleVisibility("keyBlank", true);
        toggleVisibility("keyPassword", false);
        this.setFormValue("keyPassword", this.getFormValue("keyBlank"));
        console.log("Hide password");
      } else {
        toggleVisibility("keyBlank", false);
        toggleVisibility("keyPassword", true);
        this.setFormValue("keyBlank", this.getFormValue("keyPassword"));
        console.log("Show password");
      }
    }

    toggleHashing () {
      if ($("#doHashing").is(":checked")) {
        disableElement("doRoundOffset", false);
        disableElement("doHashSalting", false);
        disableElement("hashDifficulty", false);
      } else {
        disableElement("doRoundOffset", true);
        disableElement("doHashSalting", true);
        disableElement("hashDifficulty", true);
      }
    }

    //Returns header or false 
    checkForHeader (inputString) {
      if (inputString.length < 5) {
        return false;
      }

      if (!inputString.includes('=')) {
        return false; 
      }

      const equalPosition = inputString.indexOf('=');

      if (equalPosition >= 1 && equalPosition <= 4) {
        const charactersBeforeEqual = inputString.substring(0, equalPosition);
        if (!isNaN(charactersBeforeEqual)) {
          return parseInt(charactersBeforeEqual);
        }
      }

      return false;
    }

    generateGeneralSettingsHeader() {
      let headerCode = 0;
      const settings = this.getSettings();

      console.log(settings);

      if (settings.type === "doText") headerCode +=1;
      if (settings.type === "doFiles") headerCode +=2;
      if (settings.saveHashes) headerCode += 4;
      
      return headerCode;
    }

    //generates a numeric header for the hash settings enabled/disabled
    generateCryptoHeader () {
      let headerCode = 0;
      const settings = this.getSettings();

      if(settings.methods.doAES) headerCode +=1;
      if(settings.methods.doBF) headerCode +=2;
      if(settings.methods.doXOR) headerCode +=4;
      //Other settings not needed when hashing disabled
      if(settings.doHashing) {
        headerCode +=8;
      } else {
        return headerCode;
      }
      if(settings.doHashSalting) headerCode +=16;
      if(settings.doRoundOffset) headerCode +=32;
      if(settings.hashDifficulty === "low") headerCode +=64;
      if(settings.hashDifficulty === "high") headerCode += 128;

      return headerCode;

    }

    readCryptoSettings () {
      return localStorage.getItem("cryptoConfig");
    }

    readGeneralSettings () {
      return localStorage.getItem("generalConfig");
    }

    saveSettings () {
      const cryptoSettingsHeader = this.generateCryptoHeader();
      const generalSettingsHeader = this.generateGeneralSettingsHeader();
      localStorage.setItem("cryptoConfig", cryptoSettingsHeader);
      localStorage.setItem("generalConfig", generalSettingsHeader);

      console.log("Crypto settings id " + cryptoSettingsHeader + " and general config id "+ generalSettingsHeader +" are saved.");
      ShowNotification.success("Settings saved", "Your settings have been saved.");
    }

    loadKey () {
      const keySlot = this.getFormValue("keySlot");

      if ( !keySlot) {
        console.log("No slot selected");
        ShowNotification.error("No key", "No key selected.");
        return;
      }

      let key = localStorage.getItem("key" + keySlot);

      if (!key) {
        console.log("No key in this slot.");
        ShowNotification.error("No key", "No key in this slot.");
        return;
      }

      key = CryptoWrapper.decryptAES(key, "Don't decrypt this, please.");

      if (!key) {
        console.log("Error while decrypting saved key.");
        ShowNotification.error("Error", "Could not decrypt saved key.");
        return;
      }

      const formValues = {
        keyBlank: key,
        keyPassword: key
      };

      this.setFormValues(formValues);
      ShowNotification.success("Key loaded", "Key #" + keySlot + " was loaded.");
      console.log("Key #" + keySlot + " was loaded.");

    }

    saveKey () {
      const keySlot = this.getFormValue("keySlot");

      if ( !keySlot) {
        console.log("No slot selected");
        ShowNotification.error("No key", "No key selected.");
        return;
      }

      let key = "";

      if (this.getFormValue("hideKey")) {
        key = this.getFormValue("keyPassword");
      } else {
        key = this.getFormValue("keyBlank");
      }

      if(key) {
        key = CryptoWrapper.encryptAES(key, "Don't decrypt this, please.");
        localStorage.setItem("key"+keySlot, key);
        console.log("Key #" + keySlot + " was saved.")
        ShowNotification.success("Key saved", "Key slot #" + keySlot + " was saved.");
      } else {
        console.log("No key found.");
        ShowNotification.error("No key", "Your key is empty.");
      }
    }


}

class ShowNotification {
  static success (title, content) {
    $.Notification.notify('success','top right',title , content);
  }
  static warning (title, content) {
    $.Notification.notify('warning','top right',title , content);
  }
  static error (title, content) {
    $.Notification.notify('error','top right',title , content);
  }
}

class CryptoWrapper {
  static encryptAES (text, key) {
    return CryptoJS.AES.encrypt(text, key).toString().substr(10);
  }

  static encryptBF (text, key) {
    return CryptoJS.Blowfish.encrypt(text, key).toString().substr(10);
  }

  static encryptXOR (text, key) {
    const encryptedText = XORencrypt(key, text);
    return hexToBase64(encryptedText);
  }

  static decryptAES (b64Cipher, key) {
    return CryptoJS.AES.decrypt("U2FsdGVkX1" + b64Cipher, key).toString(CryptoJS.enc.Utf8);
  }

  static decryptBF (b64Cipher, key) {
    return CryptoJS.Blowfish.decrypt("U2FsdGVkX1" + b64Cipher, key).toString(CryptoJS.enc.Utf8);
  }

  static decryptXOR (b64Cipher, key) {
    const hexCipher = base64ToHex(b64Cipher);
    return XORdecrypt(key, hexCipher);
  }
}

class FormHandler {
    constructor(formId) {
      this.formId = formId;
      this.$form = $('#' + formId);
  
      // Initialize form values
      this.formValues = this.getFormValues();
  
      // Bind form change event to update form values
      this.$form.on('change', this.updateFormValues.bind(this));
    }
  
    getFormValues() {
      const formValues = {};
      this.$form.find(':input').each(function() {
        const name = $(this).attr('name');
        const value = $(this).val();
  
        if (name) {
          if ($(this).is(':checkbox')) {
            formValues[name] = $(this).is(':checked');
          } else if ($(this).is(':radio')) {
            if ($(this).is(':checked')) {
              formValues[name] = value;
            }
          } else if ($(this).is('select')) {
            formValues[name] = value;
          } else if (!$(this).is('[readonly]')) { // Check if input is not readonly
            formValues[name] = value;
          }
        }
        
      });
      //console.log(formValues);
      return formValues;
    }
  
    updateFormValues() {
      this.formValues = this.getFormValues();
    }

    setFormValues(valuesToSet) {
      //console.log(valuesToSet);
      for (const fieldName in valuesToSet) {
        if (valuesToSet.hasOwnProperty(fieldName)) {
          const $field = this.$form.find(`[name="${fieldName}"]`);
          if ($field.length) {
            if ($field.is(':checkbox') || $field.is(':radio')) {
              $field.prop('checked', valuesToSet[fieldName]);
            } else {
              $field.val(valuesToSet[fieldName]);
            }
          }
        }
      }
  
      // Update form values and output
      this.updateFormValues();
    }

    static toggleButton(id, disable) {
      var button = $("#" + id);
      button.prop("disabled", disable);
    }
  
  }



$(document).ready(function () {
  const main = new Main(new FormHandler('mainForm'));

});
