import { TextEncryptionController } from './TextEncryptionController.js';
import { FileEncryptionController } from './FileEncryptionController.js';
import { KeyManagementController } from './KeyManagementController.js';
import { AppDataController } from './AppDataController.js';
import { FormHandler } from '../helpers/FormHandler.js';
import { StorageService } from '../services/StorageService.js';
import { EncryptionService } from '../services/EncryptionService.js';
import { argon2Service } from '../services/argon2Service.js';
import { ConfigManager } from '../services/configManagement/ConfigManager.js';
import { UIManager } from '../ui/UIManager.js';
import appState from '../state/AppState.js';

export class MainController {
  /**
   * @param {string} formId - The id of the main form.
   */
  constructor(formId) {
    this.formId = formId;
    this.services = {};
  }

  /**
   * Initialize the controller
   */
  async init() {
    await this.initializeServices();
    this.initializeControllers();
    this.bindEvents();
    this.UIManager = new UIManager(this.services, this.keyManagementController);
    await this.UIManager.initUI();
    this.appDataController.setUIManager(this.UIManager);
  }

  async initializeServices() {
    const confManager = await ConfigManager.create();
    this.services = {
      config: confManager,
      storage: new StorageService(),
      encryption: new EncryptionService(),
      argon2: new argon2Service('argon2-modal', confManager),
      form: new FormHandler(this.formId),
    };

    this.services.form.preventSubmitAction();
  }

  initializeControllers() {
    this.textEncryptionController = new TextEncryptionController(this.services);
    this.fileEncryptionController = new FileEncryptionController(this.services);
    this.keyManagementController = new KeyManagementController(this.services);
    this.appDataController = new AppDataController(this.services);
  }

  /**
   * Bind Maincontroller events
   */
  bindEvents() {
    $('.action-button').on('click', () => this.handleAction());
  }

  // ––––––– Action Orchestration –––––––

  async handleAction() {
    const { currentView, isEncrypting } = appState.state;
    if (isEncrypting) return;
    appState.setState({ isEncrypting: true });

    if (currentView === 'text') {
      await this.textEncryptionController.handleAction();
    }

    if (currentView === 'files') {
      await this.fileEncryptionController.handleAction();
    }
  }
}
