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
    this.defaultAllowed = defaultAllowed || 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
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
    const maxMultiple = Math.floor(256 / allowedLength) * allowedLength;

    while (result.length < length) {
      const randomBytes = new Uint8Array(length - result.length);
      cryptoObj.getRandomValues(randomBytes);
      for (let i = 0; i < randomBytes.length && result.length < length; i++) {
        if (randomBytes[i] < maxMultiple) {
          result.push(allowed[randomBytes[i] % allowedLength]);
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
      let specialCharsFactor = Math.floor((allowed.length * 2) / (customSpecialChars.length * 3));
      specialCharsFactor = Math.min(specialCharsFactor, 12);
      specialCharsFactor = Math.max(specialCharsFactor, 1);
      // Remove duplicates and repeat
      customSpecialChars = Array.from(new Set(customSpecialChars)).join('');
      const multipliedSpecials = customSpecialChars.repeat(specialCharsFactor);
      allowed += multipliedSpecials;
    }

    return this.generateSecureRandomString(length, allowed);
  }
}