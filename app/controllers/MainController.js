import { TextEncryptionController } from './TextEncryptionController.js';
import { FileEncryptionController } from './FileEncryptionController.js';
import { KeyManagementController } from './KeyManagementController.js';
import { AppDataController } from './AppDataController.js';
import { FormHandler } from '../helpers/FormHandler.js';
import { StorageService } from '../services/StorageService.js';
import { EncryptionService } from '../services/EncryptionService.js';
import { argon2Service } from '../ui/services/argon2Service.js';
import { SlotUiService } from '../ui/services/SlotUiService.js';
import { ConfigManager } from '../services/configManagement/ConfigManager.js';
import { UIManager } from '../ui/UIManager.js';
import { wrapAction } from '../utils/controller.js';
import appState from '../state/AppState.js';

/**
 * @class MainController
 * @classdesc
 * Main application controller that initializes services, sets up sub-controllers,
 * binds UI events, and delegates encryption/decryption actions based on the current view.
 */
export class MainController {
  /**
   * Creates a new MainController instance.
   *
   * @param {string} formId - The ID of the main form to handle.
   */
  constructor(formId) {
    this.formId = formId;
    this.services = {};
  }

  /**
   * Initializes application services, controllers, and UI.
   *
   * @async
   * @returns {Promise<void>}
   */
  async init() {
    await this.initializeServices();
    this.initializeControllers();
    this.bindEvents();
    this.UIManager = new UIManager(this.services, this.keyManagementController);
    await this.UIManager.initUI();
    this.appDataController.setUIManager(this.UIManager);
  }

  /**
   * Initializes core services: configuration, storage, encryption, Argon2, and form handling.
   *
   * @async
   * @private
   * @returns {Promise<void>}
   */
  async initializeServices() {
    const confManager = await ConfigManager.create();
    this.services = {
      config: confManager,
      storage: new StorageService(),
      encryption: new EncryptionService(),
      argon2: new argon2Service('argon2-modal', confManager),
      slots: new SlotUiService({ modalSelector: '#editSlotsModal' }, confManager),
      form: new FormHandler(this.formId),
    };

    this.services.form.preventSubmitAction();
  }

  /**
   * Instantiates feature controllers: text, file, key management, and app data.
   *
   * @private
   * @returns {void}
   */
  initializeControllers() {
    this.textEncryptionController = new TextEncryptionController(this.services);
    this.fileEncryptionController = new FileEncryptionController(this.services);
    this.keyManagementController = new KeyManagementController(this.services);
    this.appDataController = new AppDataController(this.services);
  }

  /**
   * Binds click events on action buttons to the central handleAction method.
   *
   * @returns {void}
   */
  bindEvents() {
    $('.action-button').on('click', () => this.handleAction());
  }

  // ––––––– Action Orchestration –––––––

  /**
   * Delegates encryption or decryption actions based on the current view state.
   *
   * @async
   * @returns {Promise<void>}
   */
  async handleAction() {
    const { currentView } = appState.state;
    await wrapAction('isEncryting', async () => {
      if (currentView === 'text') {
        await this.textEncryptionController.handleAction();
      }

      if (currentView === 'files') {
        await this.fileEncryptionController.handleAction();
      }
    });
  }
}
