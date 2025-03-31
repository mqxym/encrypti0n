import { ElementHandler } from '../helpers/ElementHandler.js';

export class pbkdf2Service {
  constructor(modalId, configManager) {
    // Store the jQuery-wrapped modal element.
    this.$modal = $('#' + modalId);
    // Save the passed-in, stateful configManager instance.
    this.configManager = configManager;

    // Default options (will be overwritten if saved options are loaded).
    this.options = {
      roundDifficulty: 'middle', // possible values: 'low', 'middle', 'high'
      saltDifficulty: 'high'     // possible values: 'low', 'high'
    };

    // Cache references to the interactive buttons.
    this.$roundButtons = {
      low: this.$modal.find('#round-low'),
      middle: this.$modal.find('#round-middle'),
      high: this.$modal.find('#round-high')
    };

    this.$saltButtons = {
      low: this.$modal.find('#salt-low'),
      high: this.$modal.find('#salt-high')
    };

    this.$saveButton = this.$modal.find('#pbkdf2-save');

    // Bind events and load any saved options.
    this.bindEvents();
  }

  bindEvents() {
    this.$roundButtons.low.on('click', () => {
      this.options.roundDifficulty = 'low';
      this.updateRoundButtons();
    });
  
    this.$roundButtons.middle.on('click', () => {
      this.options.roundDifficulty = 'middle';
      this.updateRoundButtons();
    });
  
    this.$roundButtons.high.on('click', () => {
      this.options.roundDifficulty = 'high';
      this.updateRoundButtons();
    });
  
    this.$saltButtons.low.on('click', () => {
      this.options.saltDifficulty = 'low';
      this.updateSaltButtons();
    });
  
    this.$saltButtons.high.on('click', () => {
      this.options.saltDifficulty = 'high';
      this.updateSaltButtons();
    });
  
    this.$saveButton.on('click', () => {
      this.saveOptions();
    });
  }

  async loadOptions() {
    try {
      const savedOptions = await this.configManager.readOptions();
      if (savedOptions) {
        this.options = savedOptions;
      }
    } catch (error) {
      console.error('Error reading options:', error);
    }
    this.updateUI();
  }

  updateUI() {
    this.updateRoundButtons();
    this.updateSaltButtons();
  }

  updateRoundButtons() {
    $.each(this.$roundButtons, (level, $btn) => {
      if (level === this.options.roundDifficulty) {
        ElementHandler.fillButtonGray($btn.attr('id'));
      } else {
        ElementHandler.emptyButtonGray($btn.attr('id'));
      }
    });
  }
  
  updateSaltButtons() {
    $.each(this.$saltButtons, (level, $btn) => {
      if (level === this.options.saltDifficulty) {
        ElementHandler.fillButtonGray($btn.attr('id'));
      } else {
        ElementHandler.emptyButtonGray($btn.attr('id'));
      }
    });
  }

  async saveOptions() {
    try {
      // Save the current options using the configManager instance.
      await this.configManager.setOptions(this.options);
      ElementHandler.buttonRemoveTextAddSuccess('saveOptions');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('saveOptions');
    } catch (error) {
      ElementHandler.buttonRemoveTextAddFail('saveOptions');
      await this.delay(1000);
      ElementHandler.buttonRemoveStatusAddText('saveOptions');
    }
  }

  // Retrieve the current saved options using a given configManager.
  static async getCurrentOptions(configManager) {
    try {
      return await configManager.readOptions();
    } catch (error) {
      throw error;
    }
  }
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
