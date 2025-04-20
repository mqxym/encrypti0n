// passwordGenerator.js

import { ElementHandler } from './helpers/ElementHandler.js';
import { delay } from './utils/misc.js';

export class PasswordGenerator {
    constructor(defaultAllowed) {
      this.defaultAllowed =
        defaultAllowed ||
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    }
  
    // Core secure random string generator
    generateSecureRandomString(length, allowed = this.defaultAllowed) {
      const allowedLength = allowed.length;
      const result = [];
      const cryptoObj = window.crypto || window.msCrypto;
      const maxMultiple = Math.floor(256 / allowedLength) * allowedLength; // Prevent modulo bias
  
      while (result.length < length) {
        const randomBytes = new Uint8Array(length - result.length);
        cryptoObj.getRandomValues(randomBytes);
        for (let i = 0; i < randomBytes.length && result.length < length; i++) {
          if (randomBytes[i] < maxMultiple) {
            result.push(allowed[randomBytes[i] % allowedLength]);
          }
        }
      }
      return result.join("");
    }
  
    // Generate a password.
    // Allows a custom set of special characters to be added.
    generate(length = 16, customSpecialChars = "") {
      let allowed = this.defaultAllowed;
      
        // allowed length * 2/3 = customLenght * x
        // x = floor(allowed length * 2 / customlength * 3)

      if (customSpecialChars) {
        let specialCharsFactor = Math.floor((allowed.length * 2) / (customSpecialChars.length * 3));
        specialCharsFactor = Math.min(specialCharsFactor, 12)
        specialCharsFactor = Math.max(specialCharsFactor, 1)
        customSpecialChars = Array.from(new Set(customSpecialChars)).join(""); // Remove duplicates
        let multipliedSpecials = customSpecialChars.repeat(specialCharsFactor);
        allowed = allowed + multipliedSpecials;
      }
      return this.generateSecureRandomString(length, allowed);
    }
  }
  
  export class PasswordGeneratorController {
    constructor(generator) {
      this.generator = generator;
      this.bindUI();
    }
  
    bindUI() {
      // Ensure the DOM is ready before binding events
      $(document).ready(() => {
        // Optional: Update slider value display if an element with id 'sliderValue' exists.
        $('#lengthSlider').on('input', () => {
          $('#sliderValue').text($("#lengthSlider").val());
          this.handleGenerate();
        });
  
        // Bind click event to the generate button.
        $('#generateButton').on('click', () => {
          this.handleGenerate();
        });
        $('#keyCopy').on('click', () => this.keyCopy());

        this.handleGenerate();
        $('#sliderValue').text($("#lengthSlider").val());
      });
    }
  
    // Handler to generate and display the password.
    handleGenerate() {
      const length = parseInt($('#lengthSlider').val(), 10);
      const specialChars = $('#specialChars').val();
      const password = this.generator.generate(length, specialChars);
      $('#passwordOutput').val(password);
    }

    async keyCopy() {
        const keyToCopy = $("#passwordOutput").val();
        try {
            await navigator.clipboard.writeText(keyToCopy);
            ElementHandler.buttonRemoveTextAddSuccess("keyCopy");
        } catch (err) {
            ElementHandler.buttonRemoveTextAddFail("keyCopy");
        } finally {
            await delay(1000);
            ElementHandler.buttonRemoveStatusAddText("keyCopy");
        }
    }
  }