class Main {

    constructor (formHandler) {
        this.formHandler = formHandler;
        $('#action').on('click', this.action.bind(this));
        $('#hideKey').on('change', this.toggleKey.bind(this));

        //his.generateHeader();
    }

    getFormValue(name) {
        return this.formHandler.formValues[name];
    }

    setFormValue (key, value) {
      let valuesToSet = {};
      valuesToSet[key] = value;
      this.formHandler.setFormValues(valuesToSet);
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

    action () {
      const key = this.getFormValue("keyPassword");
      const text = this.getFormValue("inputText");
      const methods = this.getMethods(); 

      const encryptedText = this.encrypt(key, text, methods);
      const header = this.generateHeader();
      this.setFormValue("output", header + encryptedText);
    }

    toggleKey () {
      if ($("#hideKey").is(":checked")) {
        $("#keyBlank").addClass("hidden");
        $("#keyPassword").removeClass("hidden");
        this.setFormValue("keyPassword", this.getFormValue("keyBlank"));
        console.log("Hide password");
      } else {
        $("#keyBlank").removeClass("hidden");
        $("#keyPassword").addClass("hidden");
        this.setFormValue("keyBlank", this.getFormValue("keyPassword"));
        console.log("Show password");
      }
    }

    encrypt (key, text, methods) {
      let encryptedText = text;
      
      if (methods.doXOR) {
        console.log("Start XOR Encryption...");
	      encryptedText = XORencrypt(key, encryptedText);
        encryptedText = hexToBase64(encryptedText);
      }
      if (methods.doBF) {
        console.log("Start Blowfish Encryption...");
	      encryptedText = CryptoJS.Blowfish.encrypt(encryptedText, key).toString();
      }
      if (methods.doAES) {
        console.log("Start AES Encryption...");
	      encryptedText = CryptoJS.AES.encrypt(encryptedText, key).toString();
      }
      return encryptedText;
    }

    decrypt (key, cipher, methods) {
      try {

        decrypted = cipher; 

        if (methods.doAES) {
          console.log("Start AES Decryption...");
          decrypted = CryptoJS.AES.decrypt(decrypted, key).toString(CryptoJS.enc.Utf8);
        }

        if (methods.doBF) {
          console.log("Start Blowfish Decryption...");
          decrypted = CryptoJS.Blowfish.decrypt(decrypted, key).toString(CryptoJS.enc.Utf8);
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


    checkForHeader (input) {

    }

    generateHeader () {
      let headerCode = 0;
      const settings = this.getSettings();
      console.log(settings);

      if(settings.methods.doAES) headerCode +=1;

      if(settings.methods.doBF) headerCode +=2;

      if(settings.methods.doXOR) headerCode +=4;

      if(settings.doHashing) headerCode +=8;

      if(settings.doHashSalting) headerCode +=16;

      if(settings.doRoundOffset) headerCode +=32;

      if(settings.hashDifficulty === "low") headerCode +=64;

      if(settings.hashDifficulty === "high") headerCode += 128;

      return headerCode + "=";

    }

    readHeader (input) {

    }

    readSettings () {

    }

    saveSettings () {

    }

    readKey () {

    }

    saveKey () {

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
        
      /*const valuesToSet = {
          name: 'John Doe',
          subscribe: true,
          interest: 'music',
          readonlyInput: 'This is a readonly value',
        };*/
    
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
  
  }

const main = new Main(new FormHandler('mainForm'));