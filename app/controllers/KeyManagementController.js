import { ElementHandler } from '../helpers/ElementHandler.js';
import { FormHandler } from '../helpers/FormHandler.js';
import { delay } from '../utils/misc.js';
import appState from '../state/AppState.js';
import { PasswordGenerator } from '../passwordGenerator.js';

export class KeyManagementController {
    constructor(services) {
      this.configManager = services.config;
      this.formHandler = services.form;
      this.bindKeyManagementEvents();
    }

      /**
     * Bind key management related events.
     * Includes key generation, storage, and manipulation.
     */
    bindKeyManagementEvents() {
        $('#renameSlotAction').on('click', () => this.changeSlotName());
        $('#keyGenerate').on('click', () => this.keyGenerate());
        $('#clearPassword').on('click', () => this.clearPassword());
        $('#keyCopy').on('click', () => this.keyCopy());
        $('#hideKey').on('change', () => this.toggleKey());
        $('#loadKey').on('click', () => this.loadKey());
        $('#saveKey').on('click', () => this.saveKey());
    }

      // ––––––– Key Management Methods –––––––
    
      async keyGenerate() {
        if (appState.state.actionInProgress) return;
        appState.setState({actionInProgress : true});;
        const pwGenerator = new PasswordGenerator();
        const randomKey = pwGenerator.generate(24, "-_+.,()[]*#?=&%$§€@!%^{}|;':/<>?");
        this.formHandler.setFormValue('keyBlank', randomKey);
        this.formHandler.setFormValue('keyPassword', randomKey);
        ElementHandler.buttonRemoveTextAddSuccess('keyGenerate');
        await delay(1000);
        ElementHandler.buttonRemoveStatusAddText('keyGenerate');
        appState.setState({actionInProgress : false});
      }
    
      async keyCopy() {
        if (appState.state.actionInProgress) return;
        appState.setState({actionInProgress : true});;
        const { keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
        const keyToCopy = hideKey ? keyPassword : keyBlank;
        if (!keyToCopy) {
          ElementHandler.buttonRemoveTextAddFail('keyCopy');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('keyCopy');
          appState.setState({actionInProgress : false});
          return;
        }
        try {
          await navigator.clipboard.writeText(keyToCopy);
          ElementHandler.buttonRemoveTextAddSuccess('keyCopy');
        } catch (err) {
          ElementHandler.buttonRemoveTextAddFail('keyCopy');
        } finally {
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('keyCopy');
          appState.setState({actionInProgress : false});
        }
      }
    
      toggleKey() {
        if ($('#hideKey').is(':checked')) {
          ElementHandler.hide('keyBlank');
          ElementHandler.show('keyPassword');
          this.formHandler.setFormValue('keyPassword', this.formHandler.formValues.keyBlank);
        } else {
          ElementHandler.hide('keyPassword');
          ElementHandler.show('keyBlank');
          this.formHandler.setFormValue('keyBlank', this.formHandler.formValues.keyPassword);
        }
      }
    
      async loadKey() {
        if (appState.state.actionInProgress) return;
        appState.setState({actionInProgress : true});;
        const { keySlot } = this.formHandler.formValues;
        if (!keySlot) {
          ElementHandler.buttonRemoveTextAddFail('loadKey');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('loadKey');
          appState.setState({actionInProgress : false});
          return;
        }
        try {
          const storedKey = await this.configManager.readSlotValue(keySlot);
          if (!storedKey) {
            ElementHandler.buttonRemoveTextAddFail('loadKey');
            await delay(1000);
            ElementHandler.buttonRemoveStatusAddText('loadKey');
            appState.setState({actionInProgress : false});
            return;
          }
          this.formHandler.setFormValue('keyBlank', storedKey);
          this.formHandler.setFormValue('keyPassword', storedKey);
          ElementHandler.buttonRemoveTextAddSuccess('loadKey');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('loadKey');
        } catch (error) {
          ElementHandler.buttonRemoveTextAddFail('loadKey');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('loadKey');
        }
        appState.setState({actionInProgress : false});
      }
    
      async saveKey() {
        if (appState.state.actionInProgress) return;
        appState.setState({actionInProgress : true});;
        const { keySlot, keyBlank, keyPassword, hideKey } = this.formHandler.formValues;
        if (!keySlot) {
          ElementHandler.buttonRemoveTextAddFail('saveKey');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('saveKey');
          appState.setState({actionInProgress : false});
          return;
        }
        const keyToSave = hideKey ? keyPassword : keyBlank;
        if (!keyToSave) {
          ElementHandler.buttonRemoveTextAddFail('saveKey');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('saveKey');
          appState.setState({actionInProgress : false});
          return;
        }
        try {
          await this.configManager.setSlotValue(keySlot, keyToSave);
          ElementHandler.buttonRemoveTextAddSuccess('saveKey');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('saveKey');
        } catch (err) {
          ElementHandler.buttonRemoveTextAddFail('saveKey');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('saveKey');
        }
        appState.setState({actionInProgress : false});
      }
    
      async changeSlotName() {
        if (appState.state.actionInProgress) return;
        appState.setState({actionInProgress : true});;
        const formHandlerLocal = new FormHandler('newSlotForm');
        formHandlerLocal.preventSubmitAction();
        const { keySlotChange, slotName } = formHandlerLocal.getFormValues();
        if (!keySlotChange || !slotName) {
          ElementHandler.buttonRemoveTextAddFail('renameSlotAction');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('renameSlotAction');
          appState.setState({actionInProgress : false});
          return;
        }
        try {
          await this.configManager.setSlotName(keySlotChange, slotName);
          const slotNames = await this.configManager.readSlotNames();
          ElementHandler.populateSelectWithSlotNames(slotNames, 'keySlot');
          ElementHandler.buttonRemoveTextAddSuccess('renameSlotAction');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('renameSlotAction');
          $('#slotName').val('');
        } catch (error) {
          ElementHandler.buttonRemoveTextAddFail('renameSlotAction');
          await delay(1000);
          ElementHandler.buttonRemoveStatusAddText('renameSlotAction');
        }
        appState.setState({actionInProgress : false});
      }

      clearPassword() {
        this.formHandler.setFormValue('keyBlank', '');
        this.formHandler.setFormValue('keyPassword', '');
      }
}