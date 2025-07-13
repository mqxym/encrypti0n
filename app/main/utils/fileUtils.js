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

/**
 * Reads the provided File object as an ArrayBuffer.
 * @private
 * @param {File} file - The file to read.
 * @param {number} timeout - Read timeout in milliseconds.
 * @returns {Promise<ArrayBuffer>} Resolves with the file's content as an ArrayBuffer.
 */
export function readFileAsBuffer(file, timeout) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let timeoutId;

    reader.onload = () => {
      clearTimeout(timeoutId);
      resolve(reader.result);
    };

    reader.onerror = () => {
      clearTimeout(timeoutId);
      reject(reader.error);
    };

    reader.readAsArrayBuffer(file);

    timeoutId = setTimeout(() => {
      reject(new Error('File reading timed out'));
    }, timeout);
  });
}

/**
 * Triggers download of data as a file.
 *
 * @param {string | ArrayBuffer} data - The data to download (e.g., a string or binary buffer).
 * @param {string} [filename="export"] - The base name of the file (without extension).
 * @param {string} [extension=".dat"] - Optional file extension.
 * @returns {void}
 */
export function creaeDownloadData(data, filename = "export", extension = ".dat") {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  const suffix = crypto
    .getRandomValues(new Uint8Array(6))
    .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
  
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}_${suffix}${extension}`;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}