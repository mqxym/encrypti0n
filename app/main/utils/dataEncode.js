import { EncodeConstants } from '../constants/constants.js';
import { base64ToUint8Array, arrayBufferToBase64 } from './base64.js';

/**
 * Compute SHA‑512 digest using the Web Crypto API.
 *
 * @param {Uint8Array} data - Bytes to hash.
 * @returns {Promise<Uint8Array>} 64‑byte digest.
 */
async function sha512(data) {
  const digest = await crypto.subtle.digest('SHA-512', data);
  return new Uint8Array(digest);
}

/**
 * XOR‑encrypt/decrypt a Uint8Array using a repeating key.
 *
 * @param {Uint8Array} data - Data to transform.
 * @param {Uint8Array} key  - Key to XOR with (repeats as needed).
 * @returns {Uint8Array}     Transformed output.
 */
function xorBinary(data, key) {
  if (!(data instanceof Uint8Array) || !(key instanceof Uint8Array)) {
    throw new TypeError('Both data and key must be Uint8Array');
  }
  if (key.length === 0) {
    throw new Error('Key must not be empty');
  }

  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ key[i % key.length];
  }
  return out;
}

async function getKey(base, salt) {
  return await sha512(concatUint8Arrays(base, salt));
}

/**
 * Obfuscate binary data with:
 * - Envelope XOR obfuscation using a SHA-512 key with json payload and fake random meta data
 * - Up to 1024-Bytes of random pre-padding
 *
 * @param {Uint8Array} data - AES-encrypted data to obfuscate
 * @returns {Promise<Uint8Array>} - Obfuscated result
 */
async function obfuscate(data) {
  const saltInner = crypto.getRandomValues(new Uint8Array(16));
  const keyInner = await getKey(EncodeConstants.OBFUSCATION_VALUE, saltInner);
  const obfuscatedInner = xorBinary(data, keyInner).buffer;

  // Fake metadata
  const metaAndData = {
    sig: Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    ver: getRandomVersion(),
    ts: getRandomTimestamp(),
    vf: arrayBufferToBase64(saltInner.buffer),
    pl: arrayBufferToBase64(obfuscatedInner),
  };
  const metaBytes = new TextEncoder().encode('::' + JSON.stringify(metaAndData));

  // Pre-padding
  const prePad = crypto.getRandomValues(new Uint8Array(Math.floor(Math.random() * 1024) + 8));

  const payload = concatUint8Arrays(prePad, metaBytes);

  const saltOuter = crypto.getRandomValues(new Uint8Array(16));
  const keyOuter = await getKey(EncodeConstants.OBFUSCATION_VALUE_OUTER, saltOuter);

  const obfuscated = xorBinary(payload, keyOuter);

  return concatUint8Arrays(saltOuter, obfuscated);
}

function getRandomTimestamp() {
  const now = Date.now();
  const fifteenYearsMs = 15 * 365.25 * 24 * 60 * 60 * 1000;
  const randomOffset = Math.floor(Math.random() * fifteenYearsMs);
  return new Date(now - randomOffset).getTime();
}
function getRandomVersion() {
  const major = Math.floor(Math.random() * 9) + 1; // 1–9
  const minor = Math.floor(Math.random() * 10); // 0–9
  const patch = Math.floor(Math.random() * 10); // 0–9
  return `${major}.${minor}.${patch}`;
}

/**
 * Deobfuscate payload:
 * - Same process as obfuscate but in reverse
 *
 * @param {Uint8Array} input - Obfuscated payload
 * @returns {Promise<Uint8Array>} - Original encrypted binary data
 */
async function deobfuscate(input) {
  // --- outer layer ---------------------------------------------------------
  const saltOuter = input.slice(0, 16);
  const cipherOuter = input.slice(16);
  const keyOuter = await getKey(EncodeConstants.OBFUSCATION_VALUE_OUTER, saltOuter);
  const payload = xorBinary(cipherOuter, keyOuter);
  // --- locate metadata -----------------------------------------------------
  const marker = new TextEncoder().encode('::');
  let markerPos = -1;
  for (let i = 0; i < payload.length - 1; i++) {
    if (payload[i] === marker[0] && payload[i + 1] === marker[1]) {
      markerPos = i;
      break;
    }
  }
  if (markerPos === -1) throw new Error('Metadata marker not found');

  // --- parse metadata ------------------------------------------------------
  const metaBytes = payload.slice(markerPos + 2); // skip "::"
  const meta = JSON.parse(new TextDecoder().decode(metaBytes));
  const saltInner = base64ToUint8Array(meta.vf);
  const cipherInner = base64ToUint8Array(meta.pl);

  // --- inner layer ---------------------------------------------------------
  const keyInner = await getKey(EncodeConstants.OBFUSCATION_VALUE, saltInner);
  return xorBinary(cipherInner, keyInner);
}

/**
 * Helper: Concatenate multiple Uint8Arrays
 */
function concatUint8Arrays(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

/**
 * Serialize an object, UTF‑8 encode, obfuscate, and return an ArrayBuffer.
 *
 * @param {any} object - Any JSON‑serializable value.
 * @returns {Promise<ArrayBuffer>} Obfuscated buffer.
 */
export async function returnEncoded(object) {
  const encoder = new TextEncoder();
  const plain = encoder.encode(JSON.stringify(object));
  const obfuscated = await obfuscate(plain);
  return obfuscated.buffer;
}

/**
 * Deobfuscate a buffer, decode UTF‑8, and parse JSON back to the original
 * value.
 *
 * @param {ArrayBuffer} buffer
 * @returns {Promise<any>} Decoded object.
 */
export async function returnDecoded(buffer) {
  const saltedCipher = new Uint8Array(buffer);
  const plain = await deobfuscate(saltedCipher);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plain));
}
