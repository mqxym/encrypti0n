class Main {

    constructor (formHandler, urlQueryStringHandler) {
        this.GKEY = "dcZ5TT74oLyZun0yywszpdD8rNzIyjYPZIVBGmGrobMuGj4rULoNVahjMFyE7A5NTROIZmNsmLi4UATSoQaD2nJE7LTOB"
        this.COOLKEY = "Don't decrypt this, please.";
        this.NICEKEY = "If you have a better way securing this, message me.";

        this.mPw = false;
        
        this.formHandler = formHandler;
        this.urlQueryStringHandler = urlQueryStringHandler;

        if (!this.getFormValue("hideKey")) {
          ElementAction.show("keyBlank");
          ElementAction.hide("keyPassword"); 
        }

        this.isEncrypted = Boolean(StorageHandler.getItem("isEncrypted"));

        console.log("Application is encrypted: " + this.isEncrypted);

        if (this.isEncrypted) {
          $('#do-application-decryption').modal('show');
        }

        this.readAndSetSettings();
        this.applySettingsToGui();

        this.switchSettings();
        this.updateFileList();
        this.setSlotNames();

        this.bindInputs();

        this.laddaButton = Ladda.create(document.getElementById('action'));

    }

    readAndSetSettings () {
      const cryptoSettings = this.readCryptoSettings();
      const generalSettings = this.readGeneralSettings();

      const cryptoUrlString = this.urlQueryStringHandler.getParam("cc");
      const overrideCryptoSettings = this.urlQueryStringHandler.getParam("overrideSettings");

      let result = false;

      if (cryptoSettings && !overrideCryptoSettings) {
        this.urlQueryStringHandler.setParam("cc", cryptoSettings);
        if (generalSettings) {
          this.setSettings(cryptoSettings, generalSettings);
        } else {
          this.setSettings(cryptoSettings);
        }
      } else if (cryptoUrlString) {
        if (generalSettings) {
          result = this.setSettings(cryptoUrlString, generalSettings);
        } else {
          result = this.setSettings(cryptoUrlString);
        }

        if (result) {
          ShowNotification.success("Settings loaded", "Crypto settings " + cryptoUrlString + " were loaded from URL.");
        }
      }
    }

    bindInputs() {
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

      $('#saveHashes').on('change', this.toggleSaveHashes.bind(this));

      $('#useMasterPW').on('change', this.toggleMasterPassword.bind(this));
      $('#downloadSavedKeys').on('click', this.downloadSavedKeys.bind(this));
      $('#keyUpload').on('change', this.keyUpload.bind(this));

      $('#encryptApplication').on('click', this.encryptApplication.bind(this));
      $('#decryptApplication').on('click', this.decryptApplication.bind(this));
      $('#removeApplicationEncryption').on('click', this.removeApplicationEncryption.bind(this));

      $('#setGc').on('click', this.setGc.bind(this));
      $('#setCc').on('click', this.setCc.bind(this));

      $('#removeSavedHashes').on('click', this.removeSavedHashes.bind(this));
      $('#removeSavedKeys').on('click', this.removeSavedKeys.bind(this));
      $('#removeSlotNames').on('click', this.removeSlotNames.bind(this));
      $('#removeConfig').on('click', this.removeConfig.bind(this));
      $('#removeAllData').on('click', this.removeAllData.bind(this));
      
      $('#changeSlotName').on('click', this.changeSlotName.bind(this));

      $('#saveSettings').on('click', this.saveSettings.bind(this));
      $('#doHashing').on('change', this.toggleHashing.bind(this));
    }

    async encryptApplication() {
      const eaFormHandler = new FormHandler("encryptApplicationForm");

      const mPw = eaFormHandler.formValues["encryptApplicationMPw"];
      const mPwConfirmation = eaFormHandler.formValues["encryptApplicationMPwConfirmation"];

      if (!mPw || !mPwConfirmation) {
        ShowNotification.error("Error", "Please fill in all fields.");
        return;
      }

      if (mPw !== mPwConfirmation) {
        ShowNotification.error("Error", "Master password and confirmation do not match.");
        return;
      }

      let oldMPw = false;
      if (this.isEncrypted )  {
        oldMPw = this.getMasterPassword();
        if (!oldMPw) return;
      }

      const encryptLadda = Ladda.create(document.getElementById('encryptApplication'));

      $("#encryptApplication").removeClass("btn-outline-success");
      $("#encryptApplication").addClass("btn-success");
      encryptLadda.start();

      await new Promise(r => setTimeout(r, 350));

      console.log("Generating master password checksum...");
      const checkSum = hashPassword(mPw, "low", false, false).substring(0, 30);
      StorageHandler.setItem("pwCheck", checkSum);

      const key = this.saveMasterPasswordinRAM(mPw);

      this.decryptAndEncryptLocalData(key, oldMPw);

      StorageHandler.setItem("isEncrypted", "true");
      this.isEncrypted = true;
      this.changeUIMasterPassword();

      encryptLadda.stop();
      $('#do-application-encryption').modal('hide');

      if (oldMPw) {
        ShowNotification.success("Success", "Your application was encrypted with the new password.");
      }  else {
        ShowNotification.success("Success", "Your application was encrypted.");
      }    
    }

    decryptAndEncryptLocalData(newPw = false, oldPw = false) {


      let newPwSavedKeys;
      let newPwSavedHashes;
      let oldPwSavedKeys;
      let oldPwSavedHashes;
      // When newPw is false the default key is used for encryption
      // When newPw is a string the newPw is used for encryption

      if (!newPw) {  //Decrypt to default
        newPwSavedKeys = this.COOLKEY;
        newPwSavedHashes = this.NICEKEY;
        oldPwSavedKeys = oldPwSavedHashes = oldPw;
      } else if (!oldPw) { //Encrypt with newPw
        oldPwSavedKeys = this.COOLKEY;
        oldPwSavedHashes = this.NICEKEY;
        newPwSavedKeys = newPwSavedHashes = newPw;
      } else { //Decrypt with oldPw and encrypt with newPw
        oldPwSavedKeys = oldPwSavedHashes = oldPw;
        newPwSavedKeys = newPwSavedHashes = newPw;
      }
      

      //Encrypt saved keys
      console.log("Decrypting and encrypting saved keys...");
      for (let i = 1; i <= 10; i++) {
        let key = "key" + i;
        let savedKey = StorageHandler.getItem(key);

        if (savedKey) {
          try {
            const decryptedKey = CryptoWrapper.decryptAES(savedKey, oldPwSavedKeys, true);
            const encryptedKey = CryptoWrapper.encryptAES(decryptedKey, newPwSavedKeys, true);
            StorageHandler.setItem(key, encryptedKey);
          } catch (error) {
            ShowNotification.error("Error", "Decryption or encryption of data failed.");
          }
        }
      }

      //Encrypt saved hashes
      console.log("Decrypting and encrypting saved hashes...");
      const savedHashesEncrypted = StorageHandler.getItem("savedHashes");
      if(savedHashesEncrypted) {
        try {
          const decryptedSavedHashes = CryptoWrapper.decryptAES(savedHashesEncrypted, oldPwSavedHashes, true );
          if (decryptedSavedHashes) {
            const encryptedHashes = CryptoWrapper.encryptAES(decryptedSavedHashes, newPwSavedHashes, true);
            StorageHandler.setItem("savedHashes", encryptedHashes);
          }
        } catch (error) {
          ShowNotification.error("Error", "Decryption or encryption of data failed.");
        }
      }
    }

    async decryptApplication() {
      const mPw = $('#decryptApplicationMPw').val();
      const decryptLadda = Ladda.create(document.getElementById('decryptApplication'));

      $("#decryptApplication").removeClass("btn-outline-success");
      $("#decryptApplication").addClass("btn-success");
      decryptLadda.start();
      await new Promise(r => setTimeout(r, 350));

      const isValidKey = this.checkMasterPassword(mPw);

      if (!isValidKey) {
        decryptLadda.stop();
        ShowNotification.error("Error", "Master password is not valid.");
        return false;
      }

      this.saveMasterPasswordinRAM(mPw);

      $('#do-application-decryption').modal('hide');
      decryptLadda.stop();
      ShowNotification.success("Success", "Your application was decrypted.");
    }

    checkMasterPassword(password) {
      const key = hashPassword(password, "low", false, false).substring(0, 30);
      const checkSum = StorageHandler.getItem("pwCheck");

      if (key === checkSum) {
        return true;
      }

      return false;
    }

    saveMasterPasswordinRAM(password) {
      console.log("Hashing master password...");
      const key = hashPassword(password, "medium", false, true);
      this.mPw = CryptoWrapper.encryptAES(key, this.GKEY, true);

      return key;
    }

    getMasterPassword() {
      if (!this.mPw) {  
        ShowNotification.error("Error", "Master password not found in running context. Please reload the page.");
        return false;
      }
      return CryptoWrapper.decryptAES(this.mPw, this.GKEY, true);
    }

    removeApplicationEncryption () {

      if (!this.isEncrypted) {
        ShowNotification.warning("Warning", "Can't remove encryption. Application is not encrypted.");
        return
      }

      const oldMPw = this.getMasterPassword();

      if (!oldMPw) {
        return;
      }
      Swal.fire({
        icon: 'warning',
        title: 'Remove App Encryption?',
        text: 'Defaults back to normal encryption. Your local data like saved keys could be at risk.',
        showCancelButton: true,
        confirmButtonText: "Remove",
        cancelButtonText: 'Cancel'
      }).then((result) => {
          if (result.isConfirmed) {
            this.decryptAndEncryptLocalData(false, oldMPw);
            StorageHandler.getAndRemove("isEncrypted");
            StorageHandler.getAndRemove("pwCheck");
            this.isEncrypted = false;
            this.mPw = false;
            ShowNotification.success("Success", "Your application encryption was removed.");
            this.changeUIMasterPassword();
            this.toggleMasterPassword();
          } 
      });
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
        useMasterPW: this.getFormValue("useMasterPW"), 
        includeConfig: this.getFormValue("includeConfig"), 
        includeSlotNames: this.getFormValue("includeSlotNames"), 
      }
    }

    setSettings (cryptoHeader, generalSettingsHeader = false) {
      const cHeader = parseInt(cryptoHeader);

      if (cHeader > 255 || cHeader < 1) {
        ShowNotification.error("Error", "Could not load settings. Invalid data.", false);
        return false;
      }

      let settings = {};

      settings["doAES"] = isBitSet(cHeader, 0);
      settings["doBF"] = isBitSet(cHeader, 1);
      settings["doXOR"] = isBitSet(cHeader, 2);

      const doHashing = isBitSet(cHeader, 3);
      settings["doHashing"] = doHashing

      if (doHashing) {
        settings["doHashSalting"] = isBitSet(cHeader, 4);
        settings["doRoundOffset"] = isBitSet(cHeader, 5);
      } else {
        settings["doHashSalting"] = false;
        settings["doRoundOffset"] = false;
      }
     

      if (isBitSet(cHeader, 6)) {
        settings["hashDifficulty"] = "low";
      } else if (isBitSet(cHeader, 7)) {
        settings["hashDifficulty"] = "high";
      } else {
        settings["hashDifficulty"] = "medium";
      }

      if(generalSettingsHeader) {
        const gsHeader = parseInt(generalSettingsHeader);
        if (gsHeader > 127 || gsHeader < 0 ) {
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
        settings["useMasterPW"] = isBitSet(gsHeader, 4);
        settings["includeConfig"] = isBitSet(gsHeader, 5);
        settings["includeSlotNames"] = isBitSet(gsHeader, 6);
        console.log("General settings id " + gsHeader + " are loaded.");
      }

      console.log("Crypto settings id " + cHeader + " are loaded.");

      this.urlQueryStringHandler.setParam("cc", cHeader);
      
      this.setFormValues(settings);
      return true;
    }

    applySettingsToGui () {
      this.changeType();
      this.toggleHashing();
      this.toggleKey();
      this.changeUIMasterPassword();
      this.toggleMasterPassword();
    }

    changeUIMasterPassword() {
      if (this.isEncrypted) {
        ElementAction.check("useMasterPW");
        ElementAction.disable("useMasterPW");
        ElementAction.hide("masterPassword");
      } else {
        ElementAction.enable("useMasterPW");
      }
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

        //ElementAction.enable("doXOR");

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

        //ElementAction.disable("doXOR");
        //ElementAction.uncheck("doXOR");

        $("#helpActionButton").text("To decrypt the programm checks for a valid file ending (n.dat)");
        $("#helpOutput").text("Encrypted output is binary encoded and uses a config-id.dat ending");
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

      let inputKey = "";
      if (this.getFormValue("hideKey")) {
        inputKey = this.getFormValue("keyPassword");
      } else {
        inputKey = this.getFormValue("keyBlank");
      }
      const text = this.getFormValue("inputText"); 
      const fileList = $('#inputFiles')[0].files;

      if(!inputKey) {
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
                ShowNotification.error("File error", "You can't encrypt files twice.", false);
                console.log("Encrypted files with unencrypted files detected. Aborting.");
                return;
              }
              ShowNotification.error("File error", "All files must have the same ending / encryption settings.", false);
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

      let keys = [];

      //Hashes the password
      if(settings.doHashing) {
        //Check if key is in saved hash database

        const originalKey = inputKey;
        const hashHeader = this.generateHashHeader();
        let savedHash = "";
        let hashFound = false;

        if (settings.saveHashes) {
          savedHash = this.getSavedHash(originalKey, hashHeader);
          if (savedHash) {
            keys[0] = savedHash;
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
          
          
          keys[0] = hashPassword(inputKey, 
            settings.hashDifficulty, 
            settings.doRoundOffset, 
            settings.doHashSalting);
          
          ElementAction.enable("action");
        }

        if(settings.saveHashes && !hashFound) {
          this.setHash(originalKey, keys[0], hashHeader);
        }

        // Calculate in between hashes
        if (methods.doBF) {
          keys[1] = hashBetween(keys[0]);

          if (methods.doXOR) {
            keys[2] = hashBetween(keys[1]);
          }
        } else if (methods.doXOR) {
          keys[2] = hashBetween(keys[0]);
        }
      } else {
        // no hashing
        keys[0] = inputKey;
        keys[1] = inputKey;
        keys[2] = inputKey;
      }

      //Text Encryption / Decryption
      if (type === "doText") {
        ElementAction.hide("progressBarDiv");
        if (cryptoHeader) {
          //If cryptoHeader: decrypt
          const cipher = removeBeforeFirstEqual(text);
          const decryptedText = this.decryptText(keys, cipher, methods)
          if (!decryptedText) {
            ShowNotification.error("Decryption error", "Check your key or your input.", false);
          }
          this.setFormValue("outputText", decryptedText);

        } else {
          //encrypt
          const encryptedText = this.encryptText(keys, text, methods);
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
        this.totalSize = totalSize;
        this.progressBarPercent = 0;

        this.actionLaddaStart();
        if (this.totalFileCount > 1) {
          ElementAction.show("progressBarDiv");
          setWidthPercentage("#progressBar", 0);
        } else {
          ElementAction.hide("progressBarDiv");
          setWidthPercentage("#progressBar", 0);
        }
        await new Promise(r => setTimeout(r, 150));

        if (totalSize > 30*1024*1024) {
          ShowNotification.warning("Total size",  "Working with a total of " + formatBytes(totalSize) + " processing might take a while or could fail." );
          await new Promise(r => setTimeout(r, 350));
        }
        if (cryptoHeader) {
          //decrypt
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.decryptAndSaveFile(keys, file, methods);
          }
        } else {
          //encrypt
          for (let i = 0; i < files.length; i++) {
            const file = files[i];            
            this.encryptAndSaveFile(keys, file, methods);
          }
        }
      }
    }

    encryptAndSaveFile (keys, file, methods) {
      const reader = new FileReader();

      const outputDiv = $("#outputFiles");

      reader.onload = (e) => {
        const data = e.target.result.split(',')[1];
        let encryptedData = data;

        const fileName = file.name + "."+ this.generateCryptoHeader() +".dat";

        if(methods.doXOR) {
          //ShowNotification.error("Error encrypting", "XOR not supported for files.");
          //return;
          console.log("Start XOR Encryption for file: " + file.name);
          encryptedData = CryptoWrapper.encryptXOR(encryptedData, keys[2]);
          if (methods.doAES || methods.doBF) {
            encryptedData = atob(encryptedData);
          }
        }
        
        if (methods.doBF) {
          console.log("Start Blowfish Encryption for file: " + file.name);
          encryptedData = CryptoWrapper.encryptBF(encryptedData, keys[1], false);
          if (methods.doAES ) {
            encryptedData = atob(encryptedData);
          }
          
        }

        if (methods.doAES) {
          console.log("Start AES Encryption for file: " + file.name);
          encryptedData = CryptoWrapper.encryptAES(encryptedData, keys[0], false);
        }

        encryptedData = Uint8Array.from(atob(encryptedData), char => char.charCodeAt(0));

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

        let widthPercent = file.size / this.totalSize * 100
        widthPercent = parseInt(widthPercent.toFixed(0));
        
        this.progressBarPercent += widthPercent;

        setWidthPercentage("#progressBar", this.progressBarPercent);

        if (this.processedFiles == this.totalFileCount) {
          this.actionLaddaStop();
          setWidthPercentage("#progressBar", 100);
        }
      };
      reader.readAsDataURL(file);
    }

    decryptAndSaveFile (keys, file, methods) {
      const reader = new FileReader();

      const outputDiv = $("#outputFiles");

      reader.onload = (e) => {
        const data = e.target.result.split(',')[1];
        let decryptedData = data;

        const fileName = getFirstPartAfterDots(file.name);

        try {
          if (methods.doAES) {
            console.log("Start AES Decryption for file: " + file.name);
            decryptedData = CryptoWrapper.decryptAES(decryptedData, keys[0], false);
            if (methods.doBF || methods.doXOR) {
              decryptedData = btoa(decryptedData);
            }
          }

          if(methods.doBF) {
            console.log("Start Blowfish Decryption for file: " + file.name);
            decryptedData = CryptoWrapper.decryptBF(decryptedData, keys[1], false);
            if (methods.doXOR) {
              decryptedData = btoa(decryptedData);
            }
          }

          if(methods.doXOR) {
            console.log("Start XOR Decryption for file: " + file.name);
            decryptedData = CryptoWrapper.decryptXOR(decryptedData, keys[2]);
          }

          this.processedFiles++;

          let widthPercent = file.size / this.totalSize * 100
          widthPercent = parseInt(widthPercent.toFixed(0));
          
          this.progressBarPercent += widthPercent;
  
          setWidthPercentage("#progressBar", this.progressBarPercent);
          
        } catch (error) {
          this.processedFiles++;
          ShowNotification.error("Error decrypting", "File " + fileName + " could not be decrypted. Check file or key. ");
          console.log(error);
          if (this.processedFiles == this.totalFileCount) {
            this.actionLaddaStop();
            setWidthPercentage("#progressBar", 100);
          }
          return;
        }

        const uint8Array = Uint8Array.from(atob(decryptedData), c => c.charCodeAt(0));
        const blob = new Blob([uint8Array], { type: "application/octet-stream" });
        const blobUrl = URL.createObjectURL(blob);

        
        if (this.processedFiles == this.totalFileCount) {
          this.actionLaddaStop();
          setWidthPercentage("#progressBar", 100);
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
      reader.readAsDataURL(file);
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
    encryptText (keys, text, methods) {
      let encryptedText = text;
      
      if (methods.doXOR) {
        console.log("Start XOR Encryption...");
	      encryptedText = CryptoWrapper.encryptXOR(encryptedText, keys[2]);
      }
      if (methods.doBF) {
        console.log("Start Blowfish Encryption...");
	      encryptedText = CryptoWrapper.encryptBF(encryptedText, keys[1]);
      }
      if (methods.doAES) {
        console.log("Start AES Encryption...");
	      encryptedText = CryptoWrapper.encryptAES(encryptedText, keys[0]);
      }
      return encryptedText;
    }

    //Decrypt text with the selected methods
    //Returns utf-8 encoded string
    decryptText (keys, cipher, methods) {
      try {

        let decrypted = cipher; 

        if (methods.doAES) {
          console.log("Start AES Decryption...");  
          decrypted = CryptoWrapper.decryptAES(decrypted, keys[0]);
        }

        if (methods.doBF) {
          console.log("Start Blowfish Decryption...");
          decrypted = CryptoWrapper.decryptBF(decrypted, keys[1]);
        }

        if (methods.doXOR) {
          console.log("Start XOR Decryption")
          decrypted = CryptoWrapper.decryptXOR(decrypted, keys[2]);
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
      

      if (StorageHandler.getItem("copyAlert")) {
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
                StorageHandler.setItem("copyAlert", "true");
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

    toggleSaveHashes() {
      if (this.getFormValue("saveHashes")) {
        Swal.fire({
          icon: 'warning',
          title: 'Delete all saved hashes?',
          text: 'This action can not be undone.',
          showCancelButton: true,
          confirmButtonText: "Yes, delete",
          cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
              StorageHandler.getAndRemove("savedHashes");
              ShowNotification.success("Success", "All saved hashes were deleted.");
            } 
        });
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
      if (settings.useMasterPW) headerCode += 16;
      if (settings.includeConfig) headerCode += 32;
      if (settings.includeSlotNames) headerCode += 64;
      
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
      return StorageHandler.getItem("cryptoConfig");
    }

    readGeneralSettings () {
      return StorageHandler.getItem("generalConfig");
    }

    readSlotNames(readAsJson = false) {
      const item = StorageHandler.getItem("slotNames");
      if (readAsJson) {
        return item;
      }
      if (item) {
        try {
          const slotNames = JSON.parse(item);
          return slotNames;
        } catch (error) {
          ShowNotification.error("Error", "Loading slot names failed.");
          return false;
        }
      } else {
        return false;
      }
    }

    saveSlotNames (object) {
      const string = JSON.stringify(object);
      StorageHandler.setItem("slotNames", string);
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
    }

    readSavedHashes () {
      const savedHashesEncrypted = StorageHandler.getItem("savedHashes");
      if(savedHashesEncrypted) {
        try {
          let decryptionKey = this.NICEKEY;
          if (this.isEncrypted) {
             decryptionKey = this.getMasterPassword();

            if (!decryptionKey) {
              return false;
            }
          }
          const savedHashes = CryptoWrapper.decryptAES(savedHashesEncrypted, decryptionKey );
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
      let encryptionKey = this.NICEKEY;
      if (this.isEncrypted) {
          encryptionKey = this.getMasterPassword();

        if (!encryptionKey) {
          return false;
        }
      }
      const savedHashesEncrypted = CryptoWrapper.encryptAES(savedHashes, encryptionKey);
      if(savedHashesEncrypted.length > 3 * 1024 * 1024) {
        ShowNotification.warning("Storage limit", "Try resetting the saved hashes in the advanced settings.");
      }
      StorageHandler.setItem("savedHashes", savedHashesEncrypted);
    }

    saveSettings () {
      const cryptoSettingsHeader = this.generateCryptoHeader();
      const generalSettingsHeader = this.generateGeneralSettingsHeader();
      StorageHandler.setItem("cryptoConfig", cryptoSettingsHeader);
      StorageHandler.setItem("generalConfig", generalSettingsHeader);

      console.log("Crypto settings id " + cryptoSettingsHeader + " and general config id "+ generalSettingsHeader +" are saved.");
      this.urlQueryStringHandler.setParam("cc", cryptoSettingsHeader);
      ShowNotification.success("Settings saved", "Your settings have been saved.");
    }

    loadKey () {
      const keySlot = this.getFormValue("keySlot");

      if ( !keySlot) {
        console.log("No slot selected");
        ShowNotification.error("No key", "No key selected.");
        return;
      }

      let key = StorageHandler.getItem("key" + keySlot);

      if (!key) {
        console.log("No key in this slot.");
        ShowNotification.error("No key", "No key in this slot.");
        return;
      }

      key = this.decryptKey(key);

      if (!key) {
        console.log("Error while decrypting saved key.");
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

      let encryptionKey = this.COOLKEY
      if (this.isEncrypted) {
         encryptionKey = this.getMasterPassword();

        if (!encryptionKey) {
          return false;
        }
      }

      if(key) {
        key = CryptoWrapper.encryptAES(key, encryptionKey);
        StorageHandler.setItem("key"+keySlot, key);
        console.log("Key #" + keySlot + " was saved.")
        ShowNotification.success("Key saved", "Key slot #" + keySlot + " was saved.");
      } else {
        console.log("No key found.");
        ShowNotification.error("No key", "Your key is empty.");
      }
    }

    decryptKey (keyEncrypted) {
      let key = "";

      let decryptionKey = this.COOLKEY;
      if (this.isEncrypted) {
         decryptionKey = this.getMasterPassword();

        if (!decryptionKey) {
          return false;
        }
      }

      try {
        key = CryptoWrapper.decryptAES(keyEncrypted, decryptionKey);
      } catch (error) {
        ShowNotification.error("Error", "Could not decrypt saved key.");
        return false
      }
     

      if (!key) {
        console.log("Error while decrypting saved key.");
        ShowNotification.error("Error", "Could not decrypt saved key.");
        return false;
      }

      return key;
    }

    setGc() {
      const gcValue = this.getFormValue("gcValue");
      const gcInt = convertToRoundInteger(gcValue);

      if (!gcInt) {
        console.log("Input is invalid.");
        ShowNotification.error("Invalid input.", "Enter only numbers.")
        return;
      }

      if (gcInt > 127 || gcInt < 0 ) {
        ShowNotification.error("General value", "Must be between 0 and 127");
        return false;
      }

      this.setFormValue("gcValue", "");

      this.setSettings(this.generateCryptoHeader(), gcInt);
      this.applySettingsToGui();
      this.saveSettings();


    }

    setCc() {
      const ccValue = this.getFormValue("ccValue");
      const ccInt = convertToRoundInteger(ccValue);

      if (!ccInt) {
        console.log("Input is invalid.");
        ShowNotification.error("Invalid input.", "Enter only numbers.")
        return;
      }

      if (ccInt > 255 || ccInt < 1) {
        ShowNotification.error("Crypto value", "Must be between 1 and 255");
        return false;
      }

      this.setFormValue("ccValue", "");

      this.setSettings(ccInt);
      this.applySettingsToGui();
      this.saveSettings();
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
    
    removeSlotNames () {
      Swal.fire({
        icon: 'error',
        title: 'Clear slot names?',
        text: "This action can't be undone",
        showCancelButton: true,
        confirmButtonText: "Clear",
        cancelButtonText: 'Cancel'
      }).then((result) => {
          if (result.isConfirmed) {
            StorageHandler.deleteSlotNames();
            ShowNotification.success("Success", "Slot names cleared.");
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

    toggleMasterPassword () {
      if (!this.isEncrypted) {
        if ($("#useMasterPW").is(":checked")) {
          ElementAction.show("masterPassword");
          //console.log("Use master password.");
        } else {
          ElementAction.hide("masterPassword");
          //console.log("Don't use master password.");
        }
      }
    }

    downloadSavedKeys () {
      let savedKeys = {};
      let keysFound = false;
      const useMasterPassword = this.getFormValue("useMasterPW");
      const masterPassword = this.getFormValue("masterPassword");
      const includeConfig = this.getFormValue("includeConfig");
      const includeSlotNames = this.getFormValue("includeSlotNames");

      // Check if master password is set and the application is not encrypted
      if (!this.isEncrypted && useMasterPassword && !masterPassword) {
        ShowNotification.error("Error", "No master password set.");
        return;
      }
      savedKeys.mPW = useMasterPassword;
      savedKeys.isEncrypted = this.isEncrypted;
      if (this.isEncrypted) {
        savedKeys.pwCheck = StorageHandler.getItem("pwCheck");
      }

      if (!this.getMasterPassword()) {
        return;
      }


      //Loop through saved keys and save them in the object
      for (let i = 1; i <= 10; i++) {
        let key = "key" + i;
        let item = StorageHandler.getItem(key);
        if(item) {
          keysFound = true;
          if (useMasterPassword && !this.isEncrypted) {
            item = CryptoWrapper.encryptAES(item, masterPassword);
          }
          savedKeys[key] = item;
        }
      }

      if (includeConfig || includeSlotNames) {
        if (includeConfig) {
          savedKeys.config = {};
          savedKeys.config.gC = this.readGeneralSettings();
          savedKeys.config.cC = this.readCryptoSettings();
        }
        if (includeSlotNames) {
          const slotNames = this.readSlotNames();
          if (slotNames) {
            if (useMasterPassword && !this.isEncrypted) {
              savedKeys.slotNames = CryptoWrapper.encryptAES(JSON.stringify(slotNames), masterPassword);
            } else if (this.isEncrypted) {
              savedKeys.slotNames = CryptoWrapper.encryptAES(JSON.stringify(slotNames), this.getMasterPassword());
            } else {
              savedKeys.slotNames = slotNames;
            }
          }
        }
      } else if (!keysFound) {
        ShowNotification.error("Error","No keys saved.");
        return;
      }

      const savedKeysString = JSON.stringify(savedKeys);

      if (savedKeysString) {
        const blob = new Blob([savedKeysString], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "keys.json";
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      } 
      ShowNotification.error("Error", "Download failed.");
    }

    keyUpload() {
      const file = $('#keyUpload')[0].files[0];

      if (file) {
          const reader = new FileReader();
  
          reader.onload = (e) => {
              let savedKeys = {};
              const jsonData = e.target.result;
              let keyFound = false;
              let decryptedWorked = true;

              try {
                savedKeys = JSON.parse(jsonData);
              } catch (error) {
                ShowNotification.error("Failed to load", "File format error.");
                return;
              }

              if (!savedKeys.hasOwnProperty("mPW") || !savedKeys.hasOwnProperty("mPW")) {
                ShowNotification.error("Missing information", "Could not load file.");
                return;
              }

              if (typeof savedKeys.mPW !== 'boolean' || typeof savedKeys.isEncrypted !== 'boolean') {
                ShowNotification.error("Format error", "Could not load file.");
                return;
              }

              let masterPW = "";

              if (savedKeys.mPW && !savedKeys.isEncrypted) {
                masterPW = this.getFormValue("masterPassword");
              } else if (savedKeys.isEncrypted) {
                // When the application of the download was encrypted with a master password
                masterPW = this.getMasterPassword();
                if (!savedKeys.hasOwnProperty("pwCheck") )  {
                  ShowNotification.error("Failed to load data", "Please use the same key as in the file.");
                  return
                }
                if (!masterPW) {
                  ShowNotification.error("Could not decrypt data", "Please encrypt the application with the same master password as in the file.", false);
                  return;
                }
                const pwCheckLocal = StorageHandler.getItem("pwCheck");
                if (pwCheckLocal !== savedKeys.pwCheck) {
                  ShowNotification.error("Failed to load data", "Please use the same master password as in the file.");
                  return
                }
              }

              //Load config
              if(savedKeys.hasOwnProperty('config')) {
                let cryptoConfig = "";
                let generalConfig = "";
                if(savedKeys.config.hasOwnProperty('cC') && savedKeys.config.hasOwnProperty('gC')) {
                  if (savedKeys.config.cC) {
                    cryptoConfig = savedKeys.config.cC;
                    StorageHandler.setItem("cryptoConfig", savedKeys.config.cC);
                  }
                  
                  if(savedKeys.config.gC) {
                    generalConfig = savedKeys.config.gC;
                    StorageHandler.setItem("generalConfig", savedKeys.config.gC);
                  }

                  if(savedKeys.config.gC && savedKeys.config.cC) {
                    this.setSettings(cryptoConfig, generalConfig);
                    ShowNotification.success("Config loaded", "Config saved and loaded.");
                  } else if (savedKeys.config.cC) {
                    this.setSettings(cryptoConfig);
                    ShowNotification.success("Config loaded", "Config saved and loaded.");
                  }
                  this.applySettingsToGui();
                  
                }
              }

              //Load SlotNames
              if(savedKeys.hasOwnProperty('slotNames')) {
                if (savedKeys.slotNames) {
                  let slotNames = "";
                  let slotDecryptionWorked = true;
                  if(masterPW) {
                    try {
                      slotNames = CryptoWrapper.decryptAES(savedKeys.slotNames, masterPW);
                      slotNames = JSON.parse(slotNames);
                      if (!slotNames) {
                        slotDecryptionWorked = false;
                      }
                    } catch (error) {
                      slotDecryptionWorked = false;
                    }
                    
                  } else {
                    slotNames = savedKeys.slotNames;
                  }
                  if(slotDecryptionWorked) {
                    this.saveSlotNames(slotNames);
                    this.setSlotNames();
                  } else {
                    ShowNotification.error("Failed to load slot names.", "Please check your master password.", false);
                  }
                }
              }

              //Load keys
              for (let i = 1; i <= 10; i++) {
                let key = "key" + i;
                
                if(savedKeys.hasOwnProperty(key)) {
                  keyFound = true;
                  //No master password
                  if(!savedKeys.mPW) {
                    StorageHandler.setItem(key, savedKeys[key]);
                    continue;
                  } 

                  if (savedKeys.isEncrypted) {
                    StorageHandler.setItem(key, savedKeys[key]);
                    continue;
                  }
                  
                  //Has master password && did not use app encryption
                  if(savedKeys.mPW && !savedKeys.isEncrypted) {
                    try {
                      let item = CryptoWrapper.decryptAES(savedKeys[key], masterPW);
                      if (!item) {
                        decryptedWorked = false;
                      } else {
                        StorageHandler.setItem(key, item);
                      }
                    } catch (error) {
                      decryptedWorked = false;
                    } 
                  }
                }
              }
              if(!decryptedWorked) {
                ShowNotification.error("Failed to load keys.", "Please check your master password.", false);
                return;
              }

              if (keyFound) {
                ShowNotification.success("Success", "All keys are loaded.");
              }
  
          };

          reader.readAsText(file);
      } else {
        ShowNotification.error("Failed to load", "No file selected.");
      }
    }

    setSlotNames() {
      const slotNames = this.readSlotNames();

      if(!slotNames) {
        return;
      }

      for (let i = 1; i <= 10; i++) {
        if (slotNames.hasOwnProperty(i)) {
          $(".form-select[name='keySlot'] option[value='" + i + "']").text(slotNames[i]);
        }
      }
    }

    changeSlotName() {
      const keySlot = this.getFormValue("keySlotChange");
      const newName = this.getFormValue("slotName");
      let slotNames = this.readSlotNames();

      if (!slotNames) {
        slotNames = {};
      }

      if ( !keySlot) {
        console.log("No slot selected");
        ShowNotification.error("No key", "No key selected.");
        return;
      }
      if ( !newName) {
        console.log("No name entered");
        ShowNotification.error("No name", "Please enter a name.");
        return;
      }

      slotNames[keySlot] = newName;

      $(".form-select[name='keySlot'] option[value='" + keySlot + "']").text(newName);

      this.saveSlotNames(slotNames);
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
  static error (title, content, hide = 6000) {
    $.toast({
      text: content,
      heading: title,
      showHideTransition: 'fade',
      icon: "error", 
      loaderBg: "#3b98b5",
      position: 'top-right',
      hideAfter: hide,
    });
  }
}

class CryptoWrapper {
  static encryptAES (text, key, toString = true) {
    if (toString) {
      return CryptoJS.AES.encrypt(text, key).toString().substr(10);
    }
    return CryptoJS.AES.encrypt(text, key);
  }

  static encryptBF (text, key, toString = true) {
    if (toString) {
      return CryptoJS.Blowfish.encrypt(text, key).toString().substr(10);
    }
    return CryptoJS.Blowfish.encrypt(text, key);
  }

  static encryptXOR (text, key) {
    const encryptedText = XORencrypt(key, text);
    return hexToBase64Large(encryptedText);
  }

  static decryptAES (b64Cipher, key, fromString = true) {
    if (fromString) {
      return CryptoJS.AES.decrypt("U2FsdGVkX1" + b64Cipher, key).toString(CryptoJS.enc.Utf8);
    }
    return CryptoJS.AES.decrypt(b64Cipher, key).toString(CryptoJS.enc.Utf8);
  }

  static decryptBF (b64Cipher, key, fromString = true) {
    if (fromString) {
      return CryptoJS.Blowfish.decrypt("U2FsdGVkX1" + b64Cipher, key).toString(CryptoJS.enc.Utf8);
    }
    return CryptoJS.Blowfish.decrypt(b64Cipher, key).toString(CryptoJS.enc.Utf8);
  }

  static decryptXOR (b64Cipher, key) {
    const hexCipher = base64ToHexLarge(b64Cipher);
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

  static getItem (key) {
    const item = localStorage.getItem(key);
    if (item) {
      return item;
    } else {
      return false;
    }
  }

  static setItem (key, value) {
    try {
      localStorage.setItem(key,value);
      return true;
    } catch (error) {
      ShowNotification.error("Saving error", "Failed to set data, please try clearing data", false);
      return false;
    }
  }

  static getAndRemove(key) {
    if(localStorage.getItem(key)) {
      localStorage.removeItem(key);
    }
  }

  static deleteStoredKeys () {
    for (let i = 1; i <= 10; i++) {
      let key = "key" + i;
      StorageHandler.getAndRemove(key);
    }
  }

  static deleteStoredHashes () {
    StorageHandler.getAndRemove("savedHashes");
  }
  
  static deleteSlotNames () {
    StorageHandler.getAndRemove("slotNames");
  }

  static deleteConfigs () {
    StorageHandler.getAndRemove("cryptoConfig");
    StorageHandler.getAndRemove("generalConfig");
  }

  static deleteAll() {
    StorageHandler.deleteStoredKeys();
    StorageHandler.deleteStoredHashes();
    StorageHandler.deleteSlotNames();
    StorageHandler.deleteConfigs();
    StorageHandler.getAndRemove("copyAlert");
    StorageHandler.getAndRemove("__ENC_UI_CONFIG__");
    StorageHandler.getAndRemove("isEncrypted");
    StorageHandler.getAndRemove("version");
    StorageHandler.getAndRemove("pwCheck");
  }
}

class VersionManager {
  constructor(currentVersion) {
    this.currentVersion = currentVersion;
    this.previousVersion = localStorage.getItem('version');

    // If no version is set in localStorage, set it to the current version and return
    if (!this.previousVersion) {
        localStorage.setItem('version', this.currentVersion);
        return;
    }

    this.versionActions = {
        '1.0.1': {
            changes: ["Improved security and updated hash function.", "Stored hashes must be deleted.", "Decryption of previously encrypted files will fail."],
            actions: ["clearStoredHashes"]
        },
        '1.1.0': {
            changes: ["Downloaded slot names are now encrypted.", "When using master password."],
            actions: []
        },
        '1.2.0': {
            changes: ["Improved security and updated hash function.", "Stored hashes must be deleted.", "Decryption of previously encrypted files will fail."],
            actions: ["clearStoredHashes"]
        },
        '1.4.0': {
            changes: ["Updated hash function and round offset.", "Stored hashes must be deleted.", "Decryption of previously encrypted files will fail."],
            actions: ["clearStoredHashes"]
        },
        '1.5.0': {
            changes: ["Updated hash function and file encryption.", "Stored hashes must be deleted.", "Decryption of previously encrypted files will fail."],
            actions: ["clearStoredHashes"]
        },
        '1.6.0': {
            changes: ["XOR encryption for files is now supported"],
            actions: []
        },
        '2.0.0': {
            changes: ["You can now encrypt the applications local data with a master password in the advanced tab"],
            actions: []
        },
        '2.1.1': {
            changes: ["<u><a href='https://github.com/mqxym/encrypti0n/releases/tag/2.1.1' target='_blank'>Changelog</a></u>","Updated encryption process.", "XOR or Blowfish decryption of old data will fail.", "Download version <a href='https://github.com/mqxym/encrypti0n/releases/tag/2.0.1' target='_blank'>2.0.1 from GitHub </a> to decrypt these objects."],
            actions: []
        },
        '3.0.0': {
            changes: ["<u><a href='https://github.com/mqxym/encrypti0n/releases/tag/3.0.0b1' target='_blank'>Changelog</a></u>","Complete App Rework in beta version released.", "<b>Use New App in the menu from now on and delete / migrate the old apps data.</b>","The deprecated app will be removed soon."],
            actions: []
        }

    };
  }
  updateVersion() {
      if (this.previousVersion !== this.currentVersion) {
          this.handleVersionUpdate();
      }
  }

  handleVersionUpdate() {
    const updateSequence = this.getUpdateSequence();

    updateSequence.reduce((promise, version) => {
        return promise.then(() => {
            const { changes, actions } = this.versionActions[version];
            const changeList = changes.join('<br>');
            return Swal.fire({
                title: `Update to ${version} Available!`,
                html: `${changeList}`,
                icon: "info",
            }).then(() => {
                actions.forEach(action => this[action]());
                localStorage.setItem('version', version);
            });
        });
    }, Promise.resolve());
  }

  getUpdateSequence() {
      const versions = Object.keys(this.versionActions);
      return versions.filter(version => this.isVersionBetween(version, this.previousVersion, this.currentVersion));
  }

  isVersionBetween(version, minVersion, maxVersion) {
    return this.compareVersions(version, minVersion) > 0 && this.compareVersions(version, maxVersion) <= 0;
  }

  compareVersions(versionA, versionB) {
      const splitA = versionA.split('.').map(Number);
      const splitB = versionB.split('.').map(Number);

      for (let i = 0; i < Math.max(splitA.length, splitB.length); i++) {
          const numA = splitA[i] || 0;
          const numB = splitB[i] || 0;

          if (numA > numB) return 1;
          if (numA < numB) return -1;
      }

      return 0;
  }

  clearStoredHashes() {
      StorageHandler.deleteStoredHashes();
      console.log("Data cleared for update.");
  }
}

class URLQueryStringHandler {
  constructor() {
      this.url = new URL(window.location.href);
      this.params = this.parseParams();
  }

  // Parse the URL parameters into an object
  parseParams() {
      const params = {};
      for (const [key, value] of this.url.searchParams) {
          params[key] = value;
      }
      return params;
  }

  // Set a single parameter
  setParam(key, value) {
      this.params[key] = value;
      this.updateQueryString();
  }

  // Set multiple parameters
  setParams(params) {
      for (const key in params) {
          this.params[key] = params[key];
      }
      this.updateQueryString();
  }

  // Get a parameter value by key
  getParam(key) {
      return this.params[key] || null;
  }

  // Update the URL query string with the current parameters
  updateQueryString() {
      const searchParams = new URLSearchParams();
      for (const key in this.params) {
          searchParams.set(key, this.params[key]);
      }
      this.url.search = searchParams.toString();
      window.history.replaceState({}, '', this.url);
  }

  // Get the current URL
  getURL() {
      return this.url.toString();
  }
}

$(document).ready(function () {
  const main = new Main(
    new FormHandler('mainForm'), 
    new URLQueryStringHandler()
  );

  const currentVersion = '3.0.0'
  
  const versionManager = new VersionManager(currentVersion);
  versionManager.updateVersion();
});
