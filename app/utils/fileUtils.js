/**
 * Converts a number of bytes into a human-readable string using SI units.
 *
 * @param {number} bytes - The number of bytes.
 * @param {number} [decimals=2] - Number of decimal places to include in the result.
 * @returns {string} The formatted string, e.g. "1.23 MB".
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}