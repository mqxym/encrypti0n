// misc.js

/**
 * @fileoverview
 * Small utility helpers used across the UI layer.
 * - {@link delay}: resolve a promise after a given number of milliseconds.
 * - {@link middleString}: compact long strings by keeping the start and end
 *   with a single Unicode ellipsis between them.
 */

/**
 * Returns a promise that resolves after a specified delay.
 *
 * Useful for debouncing UI updates, creating small pauses between sequential
 * tasks, or yielding to the event loop in long-running flows.
 *
 * @param {number} ms - Milliseconds to wait before resolving. Must be >= 0.
 * @returns {Promise<void>} A promise that resolves after the delay.
 *
 * @example
 * await delay(150); // pause ~150ms
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Condenses long strings by preserving the beginning and the end while inserting
 * a single Unicode ellipsis (`…`) between them.
 *
 * If the provided string's length is **greater than 25 characters**, the result
 * contains:
 * - the first **15** characters,
 * - a single ellipsis (`…`),
 * - the last **10** characters.
 *
 * Otherwise, the original string is returned unchanged.
 *
 * This is useful for displaying long filenames, IDs, or hashes in constrained
 * UI elements while still keeping both ends recognizable.
 *
 * @param {string} str - The input string to compact.
 * @returns {string} The compacted string when `str.length > 25`, otherwise `str`.
 *
 * @example
 * middleString('averylongfilenameexample.bin');
 * // → 'averylongfilena…ample.bin'
 *
 * @example
 * middleString('short.txt');
 * // → 'short.txt' (unchanged)
 */
export function middleString(str) {
  if (str.length > 25) {
    return str.substring(0, 15) + '…' + str.substring(str.length - 10, str.length);
  }
  return str;
}