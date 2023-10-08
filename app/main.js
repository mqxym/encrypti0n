class Main {

    constructor (formHandler) {
        this.formHandler = formHandler;
        $('#action').on('click', this.action.bind(this));
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

    action () {
      const key = this.getFormValue("keyPassword");
      const text = this.getFormValue("inputText");
      const methods = this.getMethods(); 
      console.log(methods);

      const encryptedText = this.encrypt(key, text, methods);
      this.setFormValue("output", encryptedText);
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

    decrypt (key, cipher) {

    }

    generateHeader (cipher) {

    }

    checkForHeader (input) {

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