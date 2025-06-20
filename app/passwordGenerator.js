import { ElementHandler } from './helpers/ElementHandler.js';
import { delay } from './utils/misc.js';
import { passwordEntropy } from '../assets/libs/fast-password-entropy/index.js';

/**
 * Wrapper function for password generation.
 *
 * @function pwGenWrapper
 * @param {number} length - Desired length of the generated password.
 * @param {string} [allowed_characters=''] - Additional characters to include in the character set.
 * @returns {string} Generated password string.
 */
export function pwGenWrapper(length, allowed_characters = '') {
  const pwGenerator = new PasswordGenerator();
  return pwGenerator.generate(length, allowed_characters);
}

/**
 * @class PasswordGenerator
 * @classdesc
 * Generates cryptographically secure random passwords, with optional custom special characters.
 */
export class PasswordGenerator {
  /**
   * @param {string} [defaultAllowed] - Default allowed character set;  
   *   if omitted, letters and digits are used.
   */
  constructor(defaultAllowed) {
    /** @private @type {string} */
    this.defaultAllowed =
      defaultAllowed ||
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  }

  /**
   * Generates a secure random string of specified length from the allowed characters,
   * preventing modulo bias.
   *
   * @private
   * @param {number} length - Number of characters to generate.
   * @param {string} [allowed=this.defaultAllowed] - Character set to choose from.
   * @returns {string} Randomly generated string.
   */
  generateSecureRandomString(length, allowed = this.defaultAllowed) {
    const allowedLength = allowed.length;
    const result = [];
    const cryptoObj = window.crypto || window.msCrypto;
    // Prevent modulo bias by discarding out-of-range values.
    const maxMultiple =
      Math.floor(256 / allowedLength) * allowedLength;

    while (result.length < length) {
      const randomBytes = new Uint8Array(length - result.length);
      cryptoObj.getRandomValues(randomBytes);
      for (
        let i = 0;
        i < randomBytes.length && result.length < length;
        i++
      ) {
        if (randomBytes[i] < maxMultiple) {
          result.push(
            allowed[randomBytes[i] % allowedLength]
          );
        }
      }
    }
    return result.join('');
  }

  /**
   * Generates a password of the given length, optionally including custom special characters.
   *
   * @param {number} [length=16] - Desired password length.
   * @param {string} [customSpecialChars=''] - Additional special characters to include.
   * @returns {string} Generated password.
   */
  generate(length = 16, customSpecialChars = '') {
    let allowed = this.defaultAllowed;

    if (customSpecialChars) {
      // Determine how many times to repeat special chars to balance frequency.
      let specialCharsFactor = Math.floor(
        (allowed.length * 2) /
          (customSpecialChars.length * 3)
      );
      specialCharsFactor = Math.min(specialCharsFactor, 12);
      specialCharsFactor = Math.max(specialCharsFactor, 1);
      // Remove duplicates and repeat
      customSpecialChars = Array.from(
        new Set(customSpecialChars)
      ).join('');
      const multipliedSpecials = customSpecialChars.repeat(
        specialCharsFactor
      );
      allowed += multipliedSpecials;
    }

    return this.generateSecureRandomString(
      length,
      allowed
    );
  }
}

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
      $("#lengthSlider").ionRangeSlider({
        min: 12,
        max: 64,
        from: 24,
        grid: true,
        extra_classes: "irs-primary",
      });
      $('#lengthSlider').on('input', () => {
        $('#sliderValue').text($('#lengthSlider').val());
        this.handleGenerate();
      });

      $('#generateButton').on('click', () => {
        this.handleGenerate();
      });

      $('#keyCopy').on('click', () => this.keyCopy());

      // Initial generation and slider display
      this.handleGenerate();
      $('#sliderValue').text($('#lengthSlider').val());
    });
  }

  /**
   * Generates a new password based on current slider and special chars input,
   * and updates the output field.
   *
   * @returns {void}
   */
  handleGenerate() {
    const length = parseInt($('#lengthSlider').val(), 10);
    const specialChars = $('#specialChars').val();
    const password = this.generator.generate(
      length,
      specialChars
    );
    $('#passwordOutput').val(password);
    this.showEntropy(password);
  }

  /**
   * Displays the passwords entropy in bits
   *
   * @returns {void}
   */

  showEntropy (password) {
    $('#pw-entropy').text(passwordEntropy(password));
  }

  /**
   * Copies the displayed password to the clipboard, showing success or failure feedback.
   *
   * @async
   * @returns {Promise<void>}
   */
  async keyCopy() {
    const keyToCopy = $('#passwordOutput').val();
    try {
      await navigator.clipboard.writeText(keyToCopy);
      ElementHandler.buttonRemoveTextAddSuccess('keyCopy');
    } catch (err) {
      ElementHandler.buttonRemoveTextAddFail('keyCopy');
    } finally {
      await delay(1000);
      ElementHandler.buttonRemoveStatusAddText('keyCopy');
    }
  }
}