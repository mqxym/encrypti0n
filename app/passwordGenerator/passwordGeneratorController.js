import { handleActionError, handleActionSuccess } from '../main/utils/controller.js';
import { passwordEntropy } from '../../assets/libs/fast-password-entropy/index.js';

/**
 * @class PasswordGeneratorController
 * @classdesc
 * Binds UI controls for password generation: slider, custom chars input, generate and copy buttons.
 */
export class PasswordGeneratorController {
  /**
   * @param {PasswordGenerator} generator - Instance of PasswordGenerator to use for generation.
   */
  constructor(generator) {
    /** @private */ this.generator = generator;
    this.bindUI();
  }

  /**
   * Attaches event listeners for slider input, generate button, and copy button.
   *
   * @private
   * @returns {void}
   */
  bindUI() {
    $(document).ready(() => {
      $('#lengthSlider').ionRangeSlider({
        min: 12,
        max: 64,
        from: 24,
        grid: true,
        extra_classes: 'irs-primary',
      });

      $('#lengthSlider').on('input', () => {
        $('#sliderValue').text($('#lengthSlider').val());
        this.handleGenerate();
      });

      // Generate button
      const generateButton = document.getElementById('generateButton');
      generateButton.addEventListener('click', () => {
        this.handleGenerate();
      });

      // Copy button
      const keyCopyBtn = document.getElementById('keyCopy');
      keyCopyBtn.addEventListener('click', () => this.keyCopy());

      // Initial generation
      this.handleGenerate();
    });
  }

  /**
   * Generates a new password based on current slider and special chars input,
   * and updates the output field.
   *
   * @returns {void}
   */
  handleGenerate() {
    const length = parseInt(document.getElementById('lengthSlider').value, 10);
    const specialChars = document.getElementById('specialChars').value;
    const password = this.generator.generate(length, specialChars);
    document.getElementById('passwordOutput').value = password;
    this.showEntropy(password);
  }

  /**
   * Displays the passwords entropy in bits
   *
   * @returns {void}
   */
  showEntropy(password) {
    document.getElementById('pw-entropy').textContent = passwordEntropy(password);
  }

  /**
   * Copies the displayed password to the clipboard, showing success or failure feedback.
   *
   * @async
   * @returns {Promise<void>}
   */
  async keyCopy() {
    const keyToCopy = document.getElementById('passwordOutput').value;
    try {
      await navigator.clipboard.writeText(keyToCopy);
      await handleActionSuccess('keyCopy');
    } catch (err) {
      await handleActionError('keyCopy');
    }
  }
}
