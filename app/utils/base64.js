/**
 * Converts an ArrayBuffer or TypedArray to a Base64-encoded string.
 *
 * @param {ArrayBuffer|Uint8Array} buffer - The buffer to encode.
 * @returns {string} Base64-encoded representation of the input buffer.
 */
export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64-encoded string into a Uint8Array of raw bytes.
 *
 * @param {string} base64 - The Base64 string to decode.
 * @returns {Uint8Array} A byte array representing the decoded data.
 * @throws {DOMException} If the input is not valid Base64.
 */
export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}