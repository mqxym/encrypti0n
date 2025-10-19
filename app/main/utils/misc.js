/**
 * Returns a promise that resolves after a specified delay.
 *
 * @param {number} ms - The number of milliseconds to wait before resolving.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function middleString(str) {
  if (str.length > 25) {
    return str.substring(0, 15) + '…' + str.substring(str.length-10, str.length);
  }
  return str;
}