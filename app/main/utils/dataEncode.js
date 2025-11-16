// dataEncode.js

/**
 * @fileoverview
 * Lightweight, streaming-friendly **obfuscation envelope** for already-encrypted
 * data. This module wraps arbitrary bytes with a two-layer XOR scheme plus a
 * small JSON metadata header, and provides symmetric encode/decode helpers that
 * serialize/deserialize JSON objects to/from obfuscated ArrayBuffers.
 *
 * **Security note**
 * - The transformation here is **obfuscation**, not cryptographic protection.
 * - It relies on XOR with keys derived from SHA-512 of static constants + salts.
 * - It is intended to *hide structure* and add plausible metadata around
 *   ciphertext that is **already securely encrypted** elsewhere (e.g., AES-GCM).
 *
 * Exported high-level helpers:
 * - {@link returnEncoded} — JSON.stringify → UTF-8 → obfuscate → ArrayBuffer
 * - {@link returnDecoded} — ArrayBuffer → deobfuscate → UTF-8 → JSON.parse
 */

import { EncodeConstants } from '../constants/constants.js';
import { base64ToUint8Array, arrayBufferToBase64 } from './base64.js';

/**
 * Compute SHA-512 digest using the Web Crypto API.
 *
 * @param {Uint8Array} data - Bytes to hash (BufferSource-compatible).
 * @returns {Promise<Uint8Array>} 64-byte digest.
 */
async function sha512(data) {
  const digest = await crypto.subtle.digest('SHA-512', data);
  return new Uint8Array(digest);
}

/**
 * XOR-encrypt/decrypt a Uint8Array using a repeating key.
 *
 * The operation is symmetric: applying the same key twice restores the input.
 *
 * @param {Uint8Array} data - Data to transform.
 * @param {Uint8Array} key  - Key to XOR with (repeats as needed).
 * @returns {Uint8Array} Transformed output (same length as `data`).
 * @throws {TypeError} If inputs are not Uint8Array.
 * @throws {Error} If `key.length === 0`.
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

/**
 * Derive a key by hashing `base || salt` with SHA-512.
 *
 * @param {Uint8Array} base - Static/base value (from {@link EncodeConstants}).
 * @param {Uint8Array} salt - Per-message random salt.
 * @returns {Promise<Uint8Array>} 64-byte derived key.
 */
async function getKey(base, salt) {
  return await sha512(concatUint8Arrays(base, salt));
}

/**
 * Envelope metadata structure that is serialized as JSON and placed after a
 * `"::"` marker inside the obfuscation payload.
 *
 * @typedef {Object} ObfuscationMeta
 * @property {string} sig - 8 random bytes as lowercase hex (16 chars).
 * @property {string} ver - Random semantic-like version string `x.y.z`.
 * @property {number} ts - Random timestamp (ms since epoch, within ~15 years).
 * @property {string} vf - Base64 of inner salt (16 bytes).
 * @property {string} pl - Base64 of inner XOR'd payload (ciphertext).
 */

/**
 * Obfuscate binary data with a two-layer XOR envelope and fake metadata.
 *
 * Process:
 * 1. **Inner layer**
 *    - Generate `saltInner` (16B), derive `keyInner = H(OBFUSCATION_VALUE || saltInner)`.
 *    - `obfuscatedInner = XOR(data, keyInner)`.
 *    - Build metadata: `{ sig, ver, ts, vf=base64(saltInner), pl=base64(obfuscatedInner) }`.
 *    - Serialize as UTF-8: `"::" + JSON.stringify(meta)`.
 * 2. **Pre-padding**
 *    - Generate 8–1031 bytes of random pre-padding; prepend before the meta.
 * 3. **Outer layer**
 *    - Generate `saltOuter` (16B), derive `keyOuter = H(OBFUSCATION_VALUE_OUTER || saltOuter)`.
 *    - XOR the concatenation `(prePad || metaBytes)` with `keyOuter`.
 * 4. **Output**
 *    - Return `saltOuter || obfuscatedOuter` as a single `Uint8Array`.
 *
 * @param {Uint8Array} data - Bytes to obfuscate (typically **already encrypted**).
 * @returns {Promise<Uint8Array>} Obfuscated result.
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

/**
 * Generate a random timestamp up to ~15 years in the past.
 * @returns {number} Milliseconds since Unix epoch.
 */
function getRandomTimestamp() {
  const now = Date.now();
  const fifteenYearsMs = 15 * 365.25 * 24 * 60 * 60 * 1000;
  const randomOffset = Math.floor(Math.random() * fifteenYearsMs);
  return new Date(now - randomOffset).getTime();
}

/**
 * Generate a randomized semantic-like version string.
 * @returns {string} Version string formatted as `major.minor.patch`.
 */
function getRandomVersion() {
  const major = Math.floor(Math.random() * 9) + 1; // 1–9
  const minor = Math.floor(Math.random() * 10); // 0–9
  const patch = Math.floor(Math.random() * 10); // 0–9
  return `${major}.${minor}.${patch}`;
}

/**
 * Deobfuscate a payload produced by {@link obfuscate}.
 *
 * Process (reverse of obfuscate):
 * 1. Split the first 16 bytes as `saltOuter`, derive `keyOuter` and XOR the rest.
 * 2. Scan for `"::"` marker; parse the following JSON into {@link ObfuscationMeta}.
 * 3. Base64-decode `vf` (inner salt) and `pl` (inner payload).
 * 4. Derive `keyInner` and XOR `pl` to recover the original bytes.
 *
 * @param {Uint8Array} input - Obfuscated payload (`saltOuter || outerXor`).
 * @returns {Promise<Uint8Array>} Original bytes.
 * @throws {Error} If the metadata marker is not found or JSON parsing fails.
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
  /** @type {ObfuscationMeta} */
  const meta = JSON.parse(new TextDecoder().decode(metaBytes));
  const saltInner = base64ToUint8Array(meta.vf);
  const cipherInner = base64ToUint8Array(meta.pl);

  // --- inner layer ---------------------------------------------------------
  const keyInner = await getKey(EncodeConstants.OBFUSCATION_VALUE, saltInner);
  return xorBinary(cipherInner, keyInner);
}

/**
 * Concatenate multiple {@link Uint8Array} instances into one.
 *
 * @param {...Uint8Array} arrays - Arrays to concatenate in order.
 * @returns {Uint8Array} New array containing all inputs.
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
 * Serialize an object, UTF-8 encode, obfuscate, and return an ArrayBuffer.
 *
 * **Intended use:** non-sensitive configuration or metadata that you prefer not
 * to store as plain text. Do **not** use this as a substitute for encryption.
 *
 * @param {any} object - Any JSON-serializable value.
 * @returns {Promise<ArrayBuffer>} Obfuscated buffer suitable for storage.
 *
 * @example
 * const buf = await returnEncoded({ user: 'alice', flags: [1,2,3] });
 * // Persist `buf` to IndexedDB / localStorage (base64) / etc.
 */
export async function returnEncoded(object) {
  const encoder = new TextEncoder();
  const plain = encoder.encode(JSON.stringify(object));
  const obfuscated = await obfuscate(plain);
  return obfuscated.buffer;
}

/**
 * Deobfuscate a buffer produced by {@link returnEncoded}, decode UTF-8, and
 * parse JSON back to the original value.
 *
 * @param {ArrayBuffer} buffer - Buffer returned by {@link returnEncoded}.
 * @returns {Promise<any>} Decoded object.
 *
 * @example
 * const obj = await returnDecoded(buf); // → original object
 */
export async function returnDecoded(buffer) {
  const saltedCipher = new Uint8Array(buffer);
  const plain = await deobfuscate(saltedCipher);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plain));
}