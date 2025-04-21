import { formatBytes } from '../utils/fileUtils.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import appState from '../state/AppState.js';
import { handleActionSuccess, handleActionError, wrapAction } from '../utils/controller.js';

export class UIManager {
  constructor(services, keyManagementController) {
    this.formHandler = services.form;
    this.configManager = services.config;
    this.argon2Service = services.argon2;
    this.storageService = services.storage;
    this.encryptionService = services.encryption;
    this.keyManagementController = keyManagementController;
    this.bindEvents();
  }

  bindEvents() {
    $('#showTextEncryption').on('click', () => this.showTextInput());
    $('#showFilesEncryption').on('click', () => this.showFileInput());
    $('#inputFiles').on('change', () => this.updateFileList());
    $('#hideInformation').on('click', () => this.setInformationTab());
    $('#inputText').on('input', (event) => this.handleDataChange(event));
    $('#copyOutput').on('click', () => this.copyOutput());
    $('#clearInput').on('click', () => this.clearInput());
    $('.Argon2-Options').on('click', () => $('#argon2-modal').modal('show'));
    $('#renameSlots').on('click', () => $('#renameSlotsModal').modal('show'));
  }

  async initUI() {
    this.resetUIState();
    if (this.configManager.isUsingMasterPassword()) {
      this.handleMasterPasswordCase();
      return;
    }

    await this.initializeApplication();
  }

  handleMasterPasswordCase() {
    ElementHandler.disable('encryptApplicationModal');
    $(document).off('click', '#encryptApplicationModal');
    $('#do-application-decryption').modal('show');
  }

  async initializeApplication() {
    const initializationFailed = await this.loadApplicationData();
    
    if (initializationFailed) {
      await this.showInitializationError();
      return;
    }

    this.initializeKeyManagement();
  }

  async loadApplicationData() {
    try {
      const slotNames = await this.configManager.readSlotNames();
      ElementHandler.populateSelectWithSlotNames(slotNames, 'keySlot');
      await this.argon2Service.loadOptions();
      return false;
    } catch (err) {
      return true;
    }
  }

  async showInitializationError() {
    await Swal.fire({
      icon: 'error',
      title: 'Failed to decrypt local data!',
      text: 'The data could be corrupted. Please try clearing all data.',
      showCancelButton: false,
      confirmButtonText: 'Ok',
    });
  }

  initializeKeyManagement() {
    this.keyManagementController.keyGenerate();
    this.keyManagementController.toggleKey();
  }

  resetUIState() {
    this.setInformationTab(false);
    this.formHandler.setFormValue('outputText', '');
    this.formHandler.setFormValue('inputText', '');
    this.clearFiles();
  }

  async handleDataChange(event) {
    const inputText = event.target.value;
    const isEncrypted = await this.encryptionService.isEncrypted(inputText.trim());

    this.updateEncryptionState(isEncrypted);
  }

  updateEncryptionState(isEncrypted) {
    if (isEncrypted) {
      ElementHandler.blueToPinkBorder('inputText');
      ElementHandler.pinkToBlueBorder('outputText');
      ElementHandler.emptyPillBlue('notEncryptedPill');
      ElementHandler.emptyPillBlue('notEncryptedFilesPill');
      ElementHandler.fillPillPink('encryptedPill');
      ElementHandler.fillPillPink('encryptedFilesPill');
      ElementHandler.buttonClassPinkToBlue('action-button');
      $('#outputText').attr('placeholder', 'The decryption result appears here');
      $('.action-explanation').text('decryption');
      $('.action-button').attr('data-bs-original-title', 'Decrypt with AES-GCM-256');
      $('#outputFooter').text('Decrypted output is UTF-8 formatted.');
    } else {
      ElementHandler.pinkToBlueBorder('inputText');
      ElementHandler.blueToPinkBorder('outputText');
      ElementHandler.fillPillBlue('notEncryptedPill');
      ElementHandler.fillPillBlue('notEncryptedFilesPill');
      ElementHandler.emptyPillPink('encryptedPill');
      ElementHandler.emptyPillPink('encryptedFilesPill');
      ElementHandler.buttonClassBlueToPink('action-button');
      $('#outputText').attr('placeholder', 'The encryption result appears here');
      $('.action-explanation').text('encryption');
      $('.action-button').attr('data-bs-original-title', 'Encrypt with AES-GCM-256');
      $('#outputFooter').text('Encrypted output is base64 formatted.');
    }
  }

  setInformationTab(toggle = true) {
    const isCurrentlyHidden = this.storageService.getItem('encInfoHidden') === 'true';

    if (toggle) {
      const newHiddenState = !isCurrentlyHidden;
      this.storageService.setItem('encInfoHidden', newHiddenState.toString());

      if (newHiddenState) {
        $('.informationRow').hide();
        $('#appRow').removeClass('mb-5');
      } else {
        $('.informationRow').show();
        $('#appRow').addClass('mb-5');
      }
    } else {
      if (isCurrentlyHidden) {
        $('.informationRow').hide();
        $('#appRow').removeClass('mb-5');
      } else {
        $('.informationRow').show();
        $('#appRow').addClass('mb-5');
      }
    }
  }

  async updateFileList() {
    const fileListElem = $('#fileList');
    const inputFilesElem = $('#inputFiles')[0];
    if (!inputFilesElem.files.length) {
      fileListElem.text('No files selected.');
      return;
    }
    fileListElem.empty();
    const files = Array.from(inputFilesElem.files);
    const encryptionChecks = files.map(async (file) => {
      const isEncrypted = await this.encryptionService.isEncryptedFile(file);
      const li = isEncrypted
        ? $('<span class="badge bg-pink rounded-pill me-1">').text(`${file.name} | ${formatBytes(file.size)}`)
        : $('<span class="badge bg-blue rounded-pill me-1">').text(`${file.name} | ${formatBytes(file.size)}`);
      fileListElem.append(li);
      return isEncrypted;
    });

    const results = await Promise.all(encryptionChecks);
    if (results.every((isEncrypted) => isEncrypted)) {
      this.updateEncryptionState(true);
    }
  }

  showFileInput() {
    ElementHandler.fillButtonGray('showFilesEncryption');
    ElementHandler.emptyButtonGray('showTextEncryption');
    ElementHandler.show('fileEncryptionInput');
    ElementHandler.hide('textEncryptionInput');
    ElementHandler.show('fileEncryptionOutput');
    ElementHandler.hide('textEncryptionOutput');
    this.updateFileList();
    appState.setState({ currentView: 'files' });
  }

  showTextInput() {
    ElementHandler.emptyButtonGray('showFilesEncryption');
    ElementHandler.fillButtonGray('showTextEncryption');
    ElementHandler.hide('fileEncryptionInput');
    ElementHandler.show('textEncryptionInput');
    ElementHandler.show('textEncryptionOutput');
    ElementHandler.hide('fileEncryptionOutput');
    appState.setState({ currentView: 'text' });
  }

  clearInput() {
    this.formHandler.setFormValue('inputText', '');
    this.handleDataChange({ target: { value: '' } });
  }

  clearPassword() {
    this.formHandler.setFormValue('keyBlank', '');
    this.formHandler.setFormValue('keyPassword', '');
  }

  clearFiles() {
    this.formHandler.setFormValue('inputFiles', '');
    $('#fileList').html('');
    $('#outputFiles').html('The encrypted files appears here');
  }

  clearSlotNames() {
    const obj = {
      1: 'Slot 1',
      2: 'Slot 2',
      3: 'Slot 3',
      4: 'Slot 4',
      5: 'Slot 5',
      6: 'Slot 6',
      7: 'Slot 7',
      8: 'Slot 8',
      9: 'Slot 9',
      10: 'Slot 10',
    };
    ElementHandler.populateSelectWithSlotNames(obj, 'keySlot');
  }

  clearUI() {
    this.clearFiles();
    this.clearInput();
    this.clearPassword();
    this.clearSlotNames();
  }

  async copyOutput() {
    await wrapAction(async () => {
      const { outputText } = this.formHandler.formValues;
      try {
        this.validateOutput(outputText);
        await navigator.clipboard.writeText(outputText);
        await handleActionSuccess('copyOutput');
      } catch (err) {
        await handleActionError('copyOutput');
      }
    });
  }

  validateOutput(output) {
    if (!output) {
      throw new Error('Output cannot be empty');
    }
    if (typeof output !== 'string') {
      throw new Error('Output must be a string');
    }
  }
}
