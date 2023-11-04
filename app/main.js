class Main {

    constructor (formHandler) {
        this.formHandler = formHandler;

        if (!this.getFormValue("hideKey")) {
          ElementAction.show("keyBlank");
          ElementAction.hide("keyPassword"); 
        }

        if (this.readCryptoSettings()) {
          if (this.readGeneralSettings()) {
            this.setSettings(this.readCryptoSettings(), this.readGeneralSettings());
          } else {
            this.setSettings(this.readCryptoSettings());
          }
        }

        this.changeType();
        this.switchSettings();
        this.toggleHashing();
        this.toggleKey();
        this.updateFileList();


        $('input[type=radio][name=type]').on('change', this.changeType.bind(this));
        $('input[type=radio][name=setting]').on('change', this.switchSettings.bind(this));
        $('#inputFiles').on('change', this.updateFileList.bind(this));

        $('#action').on('click', this.action.bind(this));
        $('#clearInput').on('click', this.clearInput.bind(this));
        $('#copyOutput').on('click', this.copyOutput.bind(this));

        $('#keyGenerate').on('click', this.keyGenerate.bind(this));
        $('#keyCopy').on('click', this.keyCopy.bind(this));
        $('#hideKey').on('change', this.toggleKey.bind(this));
        $('#loadKey').on('click', this.loadKey.bind(this));
        $('#saveKey').on('click', this.saveKey.bind(this));

        $('#removeSavedHashes').on('click', this.removeSavedHashes.bind(this));
        $('#removeSavedKeys').on('click', this.removeSavedKeys.bind(this));
        $('#removeConfig').on('click', this.removeConfig.bind(this));
        $('#removeAllData').on('click', this.removeAllData.bind(this));

        $('#saveSettings').on('click', this.saveSettings.bind(this));
        $('#doHashing').on('change', this.toggleHashing.bind(this));

        this.laddaButton = Ladda.create(document.getElementById('action'));

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
        hideKey: this.getFormValue("hideKey"), 
      }
    }

    setSettings (cryptoHeader, generalSettingsHeader = false) {
      const cHeader = parseInt(cryptoHeader);

      if (cHeader > 255) {
        ShowNotification.error("Error", "Could not load settings. Invalid data.");
        return false;
      }

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
        if (gsHeader > 15) {
          ShowNotification.error("Error", "Could not load settings. Invalid data.");
          return false;
        }

        if (isBitSet(gsHeader, 0)) {
          settings["type"] = "doText";
        } else if (isBitSet(gsHeader, 1)) {
          settings["type"] = "doFiles";
        }
        settings["saveHashes"] = isBitSet(gsHeader, 2);
        settings["hideKey"] = isBitSet(gsHeader, 3);
      }

      console.log("Crypto settings id " + this.readCryptoSettings() + " are loaded.");
      console.log("General settings id " + this.readGeneralSettings() + " are loaded.");
      this.setFormValues(settings);
      return true;
    }

    changeType () {
      const selectedRadioValue = $('input[type=radio][name=type]:checked').val();

      if (selectedRadioValue === "doText") {
        ElementAction.show("inputText");
        ElementAction.show("outputText");
        ElementAction.show("divClearInput");
        ElementAction.show("divCopyOutput");

        ElementAction.hide("inputFilesDiv");
        ElementAction.hide("fileList");
        ElementAction.hide("outputFiles");

        ElementAction.enable("doXOR");

        $("#helpActionButton").text("To decrypt the programm checks for a valid config header (n=)");
        $("#helpOutput").text("Encrypted output is base64 formatted and uses a config header");
        console.log("Use text encryption.");
      } else {
        ElementAction.hide("inputText");
        ElementAction.hide("outputText");
        ElementAction.hide("divClearInput");
        ElementAction.hide("divCopyOutput");

        ElementAction.show("inputFilesDiv");
        ElementAction.show("fileList");
        ElementAction.show("outputFiles");

        ElementAction.disable("doXOR");
        ElementAction.uncheck("doXOR");

        $("#helpActionButton").text("To decrypt the programm checks for a valid file ending (n.dat)");
        $("#helpOutput").text("Encrypted output is base64 formatted and uses a config-id.dat ending");
        console.log("Use file encryption.");
      }
    }

    switchSettings () {
      const selectedRadioValue = $('input[type=radio][name=setting]:checked').val();

      if (selectedRadioValue === "settingsMain") {
        ElementAction.show("divMainSettings");
        ElementAction.hide("divAdvancedSettings");
      } else {
        ElementAction.hide("divMainSettings");
        ElementAction.show("divAdvancedSettings");
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
      ElementAction.copyText("outputText");
      ShowNotification.success("Success", "Your output was copied.");
    }

    async action () {
      let settings = this.getSettings();
      const type = settings.type;

      let key = "";
      if (this.getFormValue("hideKey")) {
        key = this.getFormValue("keyPassword");
      } else {
        key = this.getFormValue("keyBlank");
      }
      const text = this.getFormValue("inputText"); 
      const fileList = $('#inputFiles')[0].files;

      if(!key) {
        console.log("No key set.");
        ShowNotification.error("No key", "Your key is empty.");
        return;
      }

      if(!text && type === "doText") {
        console.log("Input is empty.");
        ShowNotification.error("No input", "Your text input is empty.");
        return;
      }
      
      if(fileList.length === 0 && type === "doFiles") {
        console.log("File input is empty.");
        ShowNotification.error("No files", "You did not select any files.");
        return;
      }

      let cryptoHeader = false;

      if(type === "doText") {
        cryptoHeader = this.checkForHeader(text);
      }

      if (type === "doFiles") {
        let files = fileList;
        const outputDiv = $("#outputFiles");

        outputDiv.empty();
        //Check the files for a valid ending
        if (files.length === 1) {
          cryptoHeader = this.checkForFileEnding(files[0].name);
        } else {
          //Check all the files for the same ending
          for (let i = 1; i < files.length; i++) {
            if (this.checkForFileEnding(files[i].name) !== this.checkForFileEnding(files[i - 1].name)) {
              if (!this.checkForFileEnding(files[i].name) || !this.checkForFileEnding(files[i - 1].name) ) {
                ShowNotification.error("File error", "You can't encrypt files twice.");
                console.log("Encrypted files with unencrypted files detected. Aborting.");
                return;
              }
              ShowNotification.error("File error", "All files must have the same ending / encryption settings.");
              console.log("Detected different encryption settings. Can not decrypt.");
              return;
            }
          }

          cryptoHeader = this.checkForFileEnding(files[0].name);
        }

        if (cryptoHeader) {
          outputDiv.append("<p>Download decrypted files here </p>");
        } else {
          outputDiv.append("<p>Download encrypted files here </p>");
        }
      }

      let totalSize = 0;

      if (type === "doFiles") {
        let files = fileList;

        for (let i = 0; i < files.length; i++) {
          totalSize += files[i].size;
        }

        console.log("Working with a total filesize of " + formatBytes(totalSize));
      }
      

      if (cryptoHeader) {
        const settingsCheck = this.setSettings(cryptoHeader);
        if (!settingsCheck) {
          ShowNotification.error("Error","Can't decrypt. Invalid header.");
          return;
        }
        this.toggleHashing(); //When needed activate the hashing checkboxes
        settings = this.getSettings(); //Update settings
      }

      const methods = settings.methods;

      if (!methods.doAES && !methods.doBF && !methods.doXOR) {
        console.log("No encryption method set.");
        ShowNotification.error("No method", "No encryption method is set.");
        return;
      }

      //Hashes the password
      if(settings.doHashing) {
        //Check if key is in saved hash database

        const original_key = key;
        const hashHeader = this.generateHashHeader();
        let savedHash = "";
        let hashFound = false;

        if (settings.saveHashes) {
          savedHash = this.getSavedHash(original_key, hashHeader);
          if (savedHash) {
            key = savedHash;
            hashFound = true;
          }
        }

        if (!settings.saveHashes || !hashFound) {

          ElementAction.disable("action");

          if (settings.hashDifficulty == "medium" || settings.hashDifficulty == "high") {
            this.actionLaddaStart();
            ShowNotification.warning("Key hashing started", "Please wait while the hash process is running.");
            await new Promise(r => setTimeout(r, 350));
          }
          
          
          key = hashPassword(key, 
            settings.hashDifficulty, 
            settings.doRoundOffset, 
            settings.doHashSalting);
          
          ElementAction.enable("action");
        }

        if(settings.saveHashes && !hashFound) {
          this.setHash(original_key, key, hashHeader);
        }


        //Set key to saved hash database
      }

      //Text Encryption / Decryption
      if (type === "doText") {
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
        this.actionLaddaStop();
      }
      

      //File Encryption / Decryption
      if (type === "doFiles") {
        let files = fileList;
        this.totalFileCount = files.length;
        this.processedFiles = 0;

        this.actionLaddaStart();
        await new Promise(r => setTimeout(r, 150));

        if (totalSize > 30*1024*1024) {
          ShowNotification.warning("Total size",  "Working with a total of " + formatBytes(totalSize) + " processing might take a while." );
          await new Promise(r => setTimeout(r, 350));
        }
        if (cryptoHeader) {
          //decrypt
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.decryptAndSaveFile(key, file, methods);
          }
        } else {
          //encrypt
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.encryptAndSaveFile(key, file, methods);
          }
        }
      }
    }

    encryptAndSaveFile (key, file, methods) {
      const reader = new FileReader();

      const outputDiv = $("#outputFiles");

      reader.onload = (e) => {
        const data = e.target.result.split(',')[1];
        let encryptedData = data;

        const fileName = file.name + "."+ this.generateCryptoHeader() +".dat";

        if(methods.doXOR) {
          ShowNotification.error("Error encrypting", "XOR not supported for files.");
          return;
          //console.log("Start XOR Encryption for file: " + file.name);
          //encryptedData = CryptoWrapper.encryptXOR(encryptedData, key);
        }
        
        if (methods.doBF) {
          console.log("Start Blowfish Encryption for file: " + file.name);
          encryptedData = CryptoWrapper.encryptBF(encryptedData, key);
        }

        if (methods.doAES) {
          console.log("Start AES Encryption for file: " + file.name);
          encryptedData = CryptoWrapper.encryptAES(encryptedData, key);
        }

        const blob = new Blob([encryptedData], { type: "application/octet-stream" });
        const blobUrl = URL.createObjectURL(blob);

        // Create a download link for the base64 data
        let downloadLink = $("<a>").attr({
            href: blobUrl,
            download: fileName
        }).text(`${fileName} (${formatBytes(blob.size)})`);

        outputDiv.append(downloadLink);
        outputDiv.append("<br>");
       
        this.processedFiles++;
        if (this.processedFiles == this.totalFileCount) {
          this.actionLaddaStop();
        }
      };
      reader.readAsDataURL(file);
    }

    decryptAndSaveFile (key, file, methods) {
      const reader = new FileReader();

      const outputDiv = $("#outputFiles");

      reader.onload = (e) => {
        const data = e.target.result;
        let decryptedData = data;

        const fileName = getFirstPartAfterDots(file.name);

        try {
          if (methods.doAES) {
            decryptedData = CryptoWrapper.decryptAES(decryptedData, key);
          }

          if(methods.doBF) {
            decryptedData = CryptoWrapper.decryptBF(decryptedData, key);
          }

          this.processedFiles++;

          if(methods.doXOR) {
            ShowNotification.error("Error decrypting", "XOR not supported for files.");
            return;
            //decryptedData = CryptoWrapper.decryptXOR(decryptedData, key);
          }
          
        } catch (error) {
          this.processedFiles++;
          ShowNotification.error("Error decrypting", "File " + fileName + " could not be decrypted. Check file or key. ");
          console.log(error);
          if (this.processedFiles == this.totalFileCount) {
            this.actionLaddaStop();
          }
          return;
        }

        const uint8Array = Uint8Array.from(atob(decryptedData), c => c.charCodeAt(0));

        const blob = new Blob([uint8Array], { type: "application/octet-stream" });
        const blobUrl = URL.createObjectURL(blob);

        
        if (this.processedFiles == this.totalFileCount) {
          this.actionLaddaStop();
        }

        if (blob.size === 0) {
          ShowNotification.error("Error decrypting", "File " + fileName + " could not be decrypted. Check file or key. ");
          return;
        }

        // Create a download link for the base64 data
        let downloadLink = $("<a>").attr({
            href: blobUrl,
            download: fileName
        }).text(`${fileName} (${formatBytes(blob.size)})`);
        

        outputDiv.append(downloadLink);
        outputDiv.append("<br>");
      };
      reader.readAsText(file);
    }

    actionLaddaStart() {
      $("#action").removeClass("btn-outline-blue");
      $("#action").addClass("btn-blue");
      this.laddaButton.start();
    }

    actionLaddaStop() {
      $("#action").removeClass("btn-blue");
      $("#action").addClass("btn-outline-blue");
      this.laddaButton.stop();
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
      console.log(this.getFormValue("hideKey"));
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
          ElementAction.uncheck("hideKey");
          this.toggleKey();
        }
        $('#keyBlank').prop('readonly', true);
        ElementAction.copyText("keyBlank");
        $('#keyBlank').prop('readonly', false);
        ShowNotification.success("Success", "Your key was copied.");
      } else {
        if ($("#hideKey").is(":checked")) {
          //Sweet alert
          Swal.fire({
            icon: 'warning',
            title: 'Reveal key?',
            text: 'When you copy a key it will be shown.',
            showCancelButton: true,
            confirmButtonText: "Copy, don't show again",
            cancelButtonText: 'Cancel'
          }).then((result) => {
              if (result.isConfirmed) {
                Main.keyCopyAfterAlert();
                localStorage.setItem("copyAlert", "true");
              } 
          });
        } else {
          $('#keyBlank').prop('readonly', true);
          ElementAction.copyText("keyBlank");
          $('#keyBlank').prop('readonly', false);
          ShowNotification.success("Success", "Your key was copied.");
        }
      }
    }

    static keyCopyAfterAlert () {
      if ($("#hideKey").is(":checked")) {
        ElementAction.uncheck("hideKey");
        //ToggleKey
        ElementAction.show("keyBlank");
        ElementAction.hide("keyPassword");
        $("#keyBlank").val($("#keyPassword").val());
        console.log("Show password");

      }
      $('#keyBlank').prop('readonly', true);
      ElementAction.copyText("keyBlank");
      $('#keyBlank').prop('readonly', false);   
      ShowNotification.success("Success", "Your key was copied."); 
    }

    toggleKey () {
      if ($("#hideKey").is(":checked")) {
        ElementAction.hide("keyBlank");
        ElementAction.show("keyPassword");
        this.setFormValue("keyPassword", this.getFormValue("keyBlank"));
        console.log("Hide password");
      } else {
        ElementAction.hide("keyPassword");
        ElementAction.show("keyBlank");
        this.setFormValue("keyBlank", this.getFormValue("keyPassword"));
        console.log("Show password");
      }
    }

    toggleHashing () {
      if ($("#doHashing").is(":checked")) {
        ElementAction.enable("doRoundOffset");
        ElementAction.enable("doHashSalting");
        ElementAction.enable("hashDifficulty");
      } else {
        ElementAction.disable("doRoundOffset");
        ElementAction.disable("doHashSalting");
        ElementAction.disable("hashDifficulty");
      }
    }

    checkForFileEnding (fileName) {
      const parts = fileName.split('.');

      if (parts.length >= 3 && parts[parts.length - 1] === "dat") {
        const number = parseInt(parts[parts.length - 2]);
        if (!isNaN(number)) {
          if (number < 1000) {
            return number;
          }
        }
      }
      return false;
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

      if (settings.type === "doText") headerCode +=1;
      if (settings.type === "doFiles") headerCode +=2;
      if (settings.saveHashes) headerCode += 4;
      if (settings.hideKey) headerCode += 8;
      
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

    generateHashHeader () {
      let headerCode = 0;
      const settings = this.getSettings();

      if(settings.doHashSalting) headerCode +=1;
      if(settings.doRoundOffset) headerCode +=2;
      if(settings.hashDifficulty === "low") headerCode +=4;
      if(settings.hashDifficulty === "high") headerCode += 8;

      return headerCode;
    }

    readCryptoSettings () {
      return localStorage.getItem("cryptoConfig");
    }

    readGeneralSettings () {
      return localStorage.getItem("generalConfig");
    }

    getSavedHash(key, hashHeader) {
      const md5_key = CryptoJS.MD5(key).toString();

      let savedHashes = this.readSavedHashes();

      if(savedHashes) {
        if(savedHashes.hasOwnProperty(md5_key)) {
          if (savedHashes[md5_key].hasOwnProperty(hashHeader)) {
            if(savedHashes[md5_key][hashHeader].hasOwnProperty('k')) {
              console.log("Saved hash found. Start process.")
              return savedHashes[md5_key][hashHeader].k;
            }
          }
        }
      }

      return false;

    }

    setHash(key, hash, hashHeader) {
      let hashObject = {};
      const md5_key = CryptoJS.MD5(key).toString();
      const current_date = getDate();

      hashObject.k = hash;
      hashObject.lu = current_date;

      let savedHashes = this.readSavedHashes();

      if (savedHashes) {
        if(savedHashes.hasOwnProperty(md5_key)) {
          if (savedHashes[md5_key].hasOwnProperty(hashHeader)) {
            return;
          } else {
            savedHashes[md5_key][hashHeader] = hashObject;
          }
        } else {
          savedHashes[md5_key] = {};
          savedHashes[md5_key][hashHeader] = hashObject;
        }
      } else {
        savedHashes = {};
        savedHashes[md5_key] = {};
        savedHashes[md5_key][hashHeader] = hashObject;
      }

      this.saveSavedHashes(savedHashes);

      console.log(savedHashes);
    }

    readSavedHashes () {
      if(localStorage.getItem("savedHashes")) {
        const savedHashesEncrypted = localStorage.getItem("savedHashes");
        try {
          const savedHashes = CryptoWrapper.decryptAES(savedHashesEncrypted, "If you have a better way securing this, message me.");
          if (!savedHashes) {
            return false;
          }
          const savedHashesObject = JSON.parse(savedHashes);
          return savedHashesObject;
        } catch (error) {
          ShowNotification.error("Error", "Loading saved hashes failed.");
          return false;
        }
      }
      return false;
    }

    saveSavedHashes (savedHashesObject) {
      const savedHashes = JSON.stringify(savedHashesObject);
      const savedHashesEncrypted = CryptoWrapper.encryptAES(savedHashes, "If you have a better way securing this, message me.");
      if(savedHashesEncrypted.length > 3 * 1024 * 1024) {
        ShowNotification.warning("Storage limit", "Try resetting the saved hashes in the advanced settings.");
      }
      localStorage.setItem("savedHashes", savedHashesEncrypted);
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

    removeSavedHashes () {
      Swal.fire({
        icon: 'error',
        title: 'Clear saved hashes?',
        text: "This action can't be undone",
        showCancelButton: true,
        confirmButtonText: "Clear",
        cancelButtonText: 'Cancel'
      }).then((result) => {
          if (result.isConfirmed) {
            StorageHandler.deleteStoredHashes();
            ShowNotification.success("Success", "Saved hashes cleared.");
          } 
      });
    }

    removeSavedKeys () {
      Swal.fire({
        icon: 'error',
        title: 'Clear saved keys?',
        text: "This action can't be undone",
        showCancelButton: true,
        confirmButtonText: "Clear",
        cancelButtonText: 'Cancel'
      }).then((result) => {
          if (result.isConfirmed) {
            StorageHandler.deleteStoredKeys();
            ShowNotification.success("Success", "Saved keys cleared.");
          } 
      });
    }

    removeConfig () {
      Swal.fire({
        icon: 'error',
        title: 'Clear config?',
        text: "This action can't be undone",
        showCancelButton: true,
        confirmButtonText: "Clear",
        cancelButtonText: 'Cancel'
      }).then((result) => {
          if (result.isConfirmed) {
            StorageHandler.deleteConfigs();
            ShowNotification.success("Success", "Config cleared.");
          } 
      });
    }

    removeAllData() {
      Swal.fire({
        icon: 'error',
        title: 'Clear all data?',
        text: "This action can't be undone",
        showCancelButton: true,
        confirmButtonText: "Clear",
        cancelButtonText: 'Cancel'
      }).then((result) => {
          if (result.isConfirmed) {
            StorageHandler.deleteAll();
            ShowNotification.success("Success", "All data cleared.");
          } 
      });
    }
}

class ElementAction {
  static hide (element) {
    $("#"+element).addClass("d-none");
  } 
  static show (element) {
    $("#"+element).removeClass("d-none");
  } 
  static disable (element) {
    $("#"+element).prop('disabled', true);
  } 
  static enable (element) {
    $("#"+element).prop('disabled', false);
  } 
  static check (element) {
    $("#"+element).prop('checked', true);
  } 
  static uncheck (element) {
    $("#"+element).prop('checked', false);
  }
  static copyText (element) {
    var input = $("#"+element)[0];
    input.select();
      
    // Copy the text inside the text field
	  document.execCommand("copy");
      
    // Deselect the text field
    input.setSelectionRange(0, 0);
  }
}

class ShowNotification {
  static success (title, content) {
    $.toast({
      text: content,
      heading: title,
      showHideTransition: 'fade',
      icon: "success",
      loaderBg: "#3b98b5",
      position: 'top-right',
    });
  }
  static warning (title, content) {
    $.toast({
      text: content,
      heading: title,
      showHideTransition: 'fade',
      icon: "warning", 
      loaderBg: "#3b98b5",
      position: 'top-right',
    });
  }
  static error (title, content) {
    $.toast({
      text: content,
      heading: title,
      showHideTransition: 'fade',
      icon: "error", 
      loaderBg: "#3b98b5",
      position: 'top-right',
    });
  }
}

class CryptoWrapper {
  static encryptAES (text, key) {
    return CryptoJS.AES.encrypt(text, key).toString().substr(10);
    //return CryptoJS.AES.encrypt(text, key)
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

  static encryptDataAES (data, key) {
    return CryptoJS.AES.encrypt(data, key);
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
            if ($field.is(':checkbox')) {
              $field.prop('checked', valuesToSet[fieldName]);
            } else if ($field.is(':radio')) {
              $field.filter(`[value="${valuesToSet[fieldName]}"]`).prop('checked', true);
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

class StorageHandler {

  static deleteStoredKeys () {
    for (let i = 1; i <= 10; i++) {
      let key = "key" + i;
      if(localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    }
  }

  static deleteStoredHashes () {
    if(localStorage.getItem("savedHashes")) {
      localStorage.removeItem("savedHashes");
    }
  }

  static deleteConfigs () {
    if(localStorage.getItem("cryptoConfig")) {
      localStorage.removeItem("cryptoConfig");
    }
    if(localStorage.getItem("generalConfig")) {
      localStorage.removeItem("generalConfig");
    }
  }

  static deleteAll() {
    StorageHandler.deleteStoredKeys();
    StorageHandler.deleteStoredHashes();
    StorageHandler.deleteConfigs();

    if(localStorage.getItem("copyAlert")) {
      localStorage.removeItem("copyAlert");
    }
  }
}



$(document).ready(function () {
  const main = new Main(new FormHandler('mainForm'));
});
