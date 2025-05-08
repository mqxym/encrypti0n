import { ElementHandler } from '../helpers/ElementHandler.js';
import { handleActionError, handleActionSuccess } from '../utils/controller.js';

/**
 * @class argon2Service
 * @classdesc
 * Manages Argon2 difficulty settings UI within a modal dialog, including
 * loading, displaying, updating, and saving round and salt difficulty options.
 */
export class argon2Service {
  /**
   * @param {string} modalId - The DOM id of the modal element (without '#').
   * @param {ConfigManager} configManager - Instance managing persistent storage of options.
   */
  constructor(modalId, configManager) {
    /** @private @type {JQuery<HTMLElement>} */
    this.$modal = $('#' + modalId);
    /** @private @type {ConfigManager} */
    this.configManager = configManager;

    /**
     * @private
     * @type {{ roundDifficulty: 'low'|'middle'|'high', saltDifficulty: 'low'|'high' }}
     */
    this.options = {
      roundDifficulty: 'middle',
      saltDifficulty: 'high',
    };

    /** @private @type {Object<string, JQuery<HTMLElement>>} */
    this.$roundButtons = {
      low: this.$modal.find('#round-low'),
      middle: this.$modal.find('#round-middle'),
      high: this.$modal.find('#round-high'),
    };

    /** @private @type {Object<string, JQuery<HTMLElement>>} */
    this.$saltButtons = {
      low: this.$modal.find('#salt-low'),
      high: this.$modal.find('#salt-high'),
    };

    /** @private @type {JQuery<HTMLElement>} */
    this.$saveButton = this.$modal.find('#argon2-save');

    // Bind UI event handlers and load saved settings.
    this.bindEvents();
  }

  /**
   * Attaches click handlers to round, salt, and save buttons to update internal state.
   *
   * @private
   * @returns {void}
   */
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

  /**
   * Loads saved Argon2 options from storage and updates the UI to reflect them.
   *
   * @async
   * @returns {Promise<void>}
   */
  async loadOptions() {
    const savedOptions = await this.configManager.readOptions();
    if (savedOptions) {
      this.options = savedOptions;
    }
    this.updateUI();
  }

  /**
   * Updates both round and salt selection buttons in the UI.
   *
   * @private
   * @returns {void}
   */
  updateUI() {
    this.updateRoundButtons();
    this.updateSaltButtons();
  }

  /**
   * Highlights the button corresponding to the current roundDifficulty setting.
   *
   * @private
   * @returns {void}
   */
  updateRoundButtons() {
    $.each(this.$roundButtons, (level, $btn) => {
      if (level === this.options.roundDifficulty) {
        ElementHandler.fillButtonGray($btn.attr('id'));
      } else {
        ElementHandler.emptyButtonGray($btn.attr('id'));
      }
    });
  }

  /**
   * Highlights the button corresponding to the current saltDifficulty setting.
   *
   * @private
   * @returns {void}
   */
  updateSaltButtons() {
    $.each(this.$saltButtons, (level, $btn) => {
      if (level === this.options.saltDifficulty) {
        ElementHandler.fillButtonGray($btn.attr('id'));
      } else {
        ElementHandler.emptyButtonGray($btn.attr('id'));
      }
    });
  }

  /**
   * Persists the current options via configManager and provides visual feedback.
   *
   * @async
   * @returns {Promise<void>}
   */
  async saveOptions() {
    try {
      await this.configManager.setOptions(this.options);
      handleActionSuccess('saveOptions');
    } catch (error) {
      handleActionError('saveOptions');
    }
  }

  /**
   * Retrieves the currently saved Argon2 options from the given ConfigManager.
   *
   * @static
   * @async
   * @param {ConfigManager} configManager - Manager to read options from.
   * @returns {Promise<{ roundDifficulty: string, saltDifficulty: string }>}
   */
  static async getCurrentOptions(configManager) {
    try {
      return await configManager.readOptions();
    } catch (error) {
      throw error;
    }
  }
}