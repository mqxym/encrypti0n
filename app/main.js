class Main {

    constructor (formHandler) {
        this.formHandler = formHandler;

        if (!this.getFormValue("hideKey")) {
          toggleVisibility("keyBlank", false);
          toggleVisibility("keyPassword", true); 
        }

        if (this.readSettings()) {
          this.setSettings(this.readSettings());
        }

        $('#action').on('click', this.action.bind(this));
        $('#keyGenerate').on('click', this.keyGenerate.bind(this));
        $('#keyCopy').on('click', this.keyCopy.bind(this));
        $('#hideKey').on('change', this.toggleKey.bind(this));
        $('#loadKey').on('click', this.loadKey.bind(this));
        $('#saveKey').on('click', this.saveKey.bind(this));
        $('#saveSettings').on('click', this.saveSettings.bind(this));

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
      }
    }

    setSettings (header) {
      header = parseInt(header);

      let settings = {};

      settings["doAES"] = isBitSet(header, 0);
      settings["doBF"] = isBitSet(header, 1);
      settings["doXOR"] = isBitSet(header, 2);
      settings["doHashing"] = isBitSet(header, 3);
      settings["doHashSalting"] = isBitSet(header, 4);
      settings["doRoundOffset"] = isBitSet(header, 5);

      if (isBitSet(header, 6)) {
        settings["hashDifficulty"] = "low";
      } else if (isBitSet(header, 7)) {
        settings["hashDifficulty"] = "high";
      } else {
        settings["hashDifficulty"] = "medium";
      }

      console.log("Settings id " + this.readSettings() + " are loaded.");
      this.setFormValues(settings);
    }

    async action () {
      let key = "";
      if (this.getFormValue("hideKey")) {
        key = this.getFormValue("keyPassword");
      } else {
        key = this.getFormValue("keyBlank");
      }
      const text = this.getFormValue("inputText"); 

      if(!key) {
        console.log("No key set.");
        notificationError("No key", "Your key is empty.");
        return;
      }

      if(!text) {
        console.log("Input is empty.");
        notificationError("No input", "Your text input is empty.");
        return;
      }

      const header = this.checkForHeader(text);

      if (header) {
        this.setSettings(header);
      }

      const settings = this.getSettings();
      const methods = settings.methods;

      if (!methods.doAES && !methods.doBF && !methods.doXOR) {
        console.log("No encryption method set.");
        notificationError("No method", "No encryption method is set.");
        return;
      }

      //Hashes the password
      if(settings.doHashing) {
        FormHandler.toggleButton("action", true);
        if (settings.hashDifficulty == "medium" || settings.hashDifficulty == "high") {
          notificationWarning("Key hashing started", "Please wait while the hash process is running.");
        }
        
        await new Promise(r => setTimeout(r, 50));
        hashPassword(key, 
          settings.hashDifficulty, 
          settings.doRoundOffset, 
          settings.doHashSalting);
        FormHandler.toggleButton("action", false);

        if (settings.hashDifficulty == "medium" || settings.hashDifficulty == "high") {
          notificationSuccess("Process finished" , "Hash process finished.");
        }
        
      }

      

      if (header) {
        //If header: decrypt
        const cipher = removeBeforeFirstEqual(text);
        const decryptedText = this.decryptText(key, cipher, methods)
        if (!decryptedText) {
          notificationError("Decryption error", "Check your key or your input.");
        }
        this.setFormValue("output", decryptedText);

      } else {
        //encrypt
        const encryptedText = this.encryptText(key, text, methods);
        const header = this.generateHeader();
        this.setFormValue("output", header + "=" + encryptedText);       
      }

      //Notification
    }



    keyGenerate() {
      const seed = Math.random() + "+" + Math.random() + "+" + Math.random();
      const header = this.generateHeader() + "=";
      const key = header + CryptoJS.AES.encrypt(seed, seed).toString().substr(10);
      const formValues = {
        keyBlank: key,
        keyPassword: key
      };
      this.setFormValues(formValues);
    }

    keyCopy() {
      let keyWasHidden = false;

      if ($("#hideKey").is(":checked")) {
        $("#hideKey").prop("checked", false);
        this.toggleKey();
        keyWasHidden = true;
      }
      var input = $("#keyBlank")[0];
      input.select();
      
      // Copy the text inside the text field
      document.execCommand("copy");
      
      // Deselect the text field
      input.setSelectionRange(0, 0);

      /*if (keyWasHidden) {
        $("#hideKey").prop("checked", true);
        this.toggleKey();
      }*/
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

    //Encrypt text with the selected method
    //Returns b64 encrypted string
    encryptText (key, text, methods) {
      let encryptedText = text;
      
      if (methods.doXOR) {
        console.log("Start XOR Encryption...");
	      encryptedText = XORencrypt(key, encryptedText);
        encryptedText = hexToBase64(encryptedText);
      }
      if (methods.doBF) {
        console.log("Start Blowfish Encryption...");
	      encryptedText = CryptoJS.Blowfish.encrypt(encryptedText, key).toString().substr(10);
      }
      if (methods.doAES) {
        console.log("Start AES Encryption...");
	      encryptedText = CryptoJS.AES.encrypt(encryptedText, key).toString().substr(10);
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
          decrypted = CryptoJS.AES.decrypt("U2FsdGVkX1" + decrypted, key).toString(CryptoJS.enc.Utf8);
        }

        if (methods.doBF) {
          console.log("Start Blowfish Decryption...");
          decrypted = CryptoJS.Blowfish.decrypt("U2FsdGVkX1" + decrypted, key).toString(CryptoJS.enc.Utf8);
        }

        if (methods.doXOR) {
          console.log("Start XOR Decryption")
          decrypted = base64ToHex(decrypted);
          decrypted = XORdecrypt(key, decrypted);
        }
      
       
        return decrypted;
      }
      catch(err) {
        return "";
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

    //generates a numeric header for the settings enabled/disabled
    generateHeader () {
      let headerCode = 0;
      const settings = this.getSettings();

      if(settings.methods.doAES) headerCode +=1;
      if(settings.methods.doBF) headerCode +=2;
      if(settings.methods.doXOR) headerCode +=4;
      if(settings.doHashing) headerCode +=8;
      if(settings.doHashSalting) headerCode +=16;
      if(settings.doRoundOffset) headerCode +=32;
      if(settings.hashDifficulty === "low") headerCode +=64;
      if(settings.hashDifficulty === "high") headerCode += 128;

      return headerCode;

    }

    readSettings () {
      return localStorage.getItem("config");
    }

    saveSettings () {
      const header = this.generateHeader();
      localStorage.setItem("config", header);
      console.log("Settings id " + header + " are saved.");
      notificationSuccess("Settings saved", "Your settings have been saved.");
    }

    loadKey () {
      const keySlot = this.getFormValue("keySlot");

      if ( !keySlot) {
        console.log("No slot selected");
        notificationError("No key", "No key selected.");
        return;
      }

      const key = localStorage.getItem("key" + keySlot);

      if (!key) {
        console.log("No key in this slot.");
        notificationError("No key", "No key in this slot.");
        return;
      }

      const formValues = {
        keyBlank: key,
        keyPassword: key
      };

      this.setFormValues(formValues);
      notificationSuccess("Key loaded", "Key #" + keySlot + " was loaded.");
      console.log("Key #" + keySlot + " was loaded.");

    }

    saveKey () {
      const keySlot = this.getFormValue("keySlot");

      if ( !keySlot) {
        console.log("No slot selected");
        notificationError("No key", "No key selected.");
        return;
      }

      let key = "";

      if (this.getFormValue("hideKey")) {
        key = this.getFormValue("keyPassword");
      } else {
        key = this.getFormValue("keyBlank");
      }

      if(key) {
        localStorage.setItem("key"+keySlot, key);
        console.log("Key #" + keySlot + " was saved.")
        notificationSuccess("Key saved", "Key slot #" + keySlot + " was saved.");
      } else {
        console.log("No key found.");
        notificationError("No key", "Your key is empty.");
      }
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
          } else if ($(this).is('select')) {
            formValues[name] = value;
          } else if (!$(this).is('[readonly]')) { // Check if input is not readonly
            formValues[name] = value;
          }
        }
        
      });
      return formValues;
    }
  
    updateFormValues() {
      this.formValues = this.getFormValues();
    }

    setFormValues(valuesToSet) {
      for (const fieldName in valuesToSet) {
        if (valuesToSet.hasOwnProperty(fieldName)) {
          const $field = this.$form.find(`[name="${fieldName}"]`);
          if ($field.length) {
            if ($field.is(':checkbox')) {
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
