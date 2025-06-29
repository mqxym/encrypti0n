/**
 * @fileoverview Controller for decoding Base64 or UTF-8 input, extracting encryption metadata,
 * and updating the UI with header, salt, IV, and payload details in real time.
 * Utilizes shared Base64 utilities and an EncryptionService for header parsing.
 */

import { EncryptionService } from "../main/services/EncryptionService.js";
import {
  arrayBufferToBase64,
  base64ToUint8Array,
} from "../main/utils/base64.js";

/**
 * Class responsible for handling user input decoding, metadata extraction,
 * and live UI updates for each keystroke.
 */
class DecodeController {
  /**
   * Creates an instance of DecodeController.
   * @constructs DecodeController
   */
  constructor() {
    /**
     * Service for decoding encryption headers.
     * @type {EncryptionService}
     * @private
     */
    this.service = new EncryptionService();

    // ---- Cache DOM ------------------------------------------------
    const $ = (id) => document.getElementById(id);

    /** @type {HTMLInputElement} Element for raw data input. */
    this.$input          = $("dataInput");
    /** @type {HTMLElement} Badge element displaying status. */
    this.$status         = $("statusBadge");
    /** @type {HTMLElement} Element showing salt length. */
    this.$saltLength     = $("saltLength");
    /** @type {HTMLElement} Element showing salt value. */
    this.$saltValue      = $("saltValue");
    /** @type {HTMLElement} Element showing Argon2 round count. */
    this.$roundCount     = $("roundCount");
    /** @type {HTMLElement} Element showing header version. */
    this.$version        = $("version");
    /** @type {HTMLElement} Element showing IV length. */
    this.$ivLength       = $("ivLength");
    /** @type {HTMLElement} Element showing IV value. */
    this.$ivValue        = $("ivValue");
    /** @type {HTMLElement} Element showing payload length. */
    this.$payloadLength  = $("payloadLength");

    // Bind event listeners and process initial input.
    this.bindEvents();
    this.handleInput();
  }

  /**
   * Attaches input event listener to the data input field.
   * @private
   */
  bindEvents() {
    this.$input.addEventListener("input", () => this.handleInput());
  }

  /**
   * Handles changes in the input field by parsing, decoding, and updating the UI.
   * Resets the view if input is empty or parsing/decoding fails.
   * @private
   */
  handleInput() {
    const raw = this.$input.value;
    if (!raw.trim()) {
      this.resetView();
      return;
    }

    let bytes;
    try {
      bytes = this.parseToUint8Array(raw);
    } catch (e) {
      this.resetView();
      return;
    }

    try {
      const { algorithmName, header, saltBytes, headerLength } =
        this.service.decodeHeader(bytes);

      // Update status badge based on detected algorithm.
      this.setStatus(
        algorithmName === "aesgcm" ? "encrypted" : "unknown",
        algorithmName === "aesgcm" ? "bg-pink" : "bg-secondary",
        algorithmName === "aesgcm" ? "border-pink" : "border-secondary"
      );

      // Display salt metadata.
      this.$saltLength.textContent = `${saltBytes.length}-byte`;
      this.$saltValue.textContent = arrayBufferToBase64(saltBytes);

      // Display Argon2 iteration count description.
      this.$roundCount.textContent = this.describeRounds(
        header.argon2Iterations
      );

      // Display header version (incremented by 1 for UI clarity).
      this.$version.textContent = header.version + 1;

      // Extract and display IV and payload lengths and values.
      const IV_BYTES = 12;
      const ivBytes = bytes.slice(headerLength, headerLength + IV_BYTES);
      this.$ivLength.textContent = `${IV_BYTES}-byte`;
      this.$ivValue.textContent = arrayBufferToBase64(ivBytes);

      const payloadLen = bytes.length - headerLength - IV_BYTES;
      this.$payloadLength.textContent = `${payloadLen}-byte`;
    } catch (err) {
      this.resetView();
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * Converts arbitrary user input into a Uint8Array.
   * If the input looks like Base64, decodes using shared utility;
   * otherwise, encodes as UTF-8 bytes.
   * @param {string} str - Input string to parse.
   * @returns {Uint8Array} Parsed byte array.
   * @throws {Error} Throws if Base64 decoding fails.
   * @private
   */
  parseToUint8Array(str) {
    const cleaned = str.trim();
    const base64Regex = /^[A-Za-z0-9+/\s]*={0,2}$/;

    // Detect Base64 by length multiple of 4 and regex match.
    if (cleaned.length % 4 === 0 && base64Regex.test(cleaned)) {
      return base64ToUint8Array(cleaned.replace(/\s+/g, ""));
    }

    // Fallback to UTF-8 encoding.
    return new TextEncoder().encode(cleaned);
  }

  /**
   * Returns a human-readable description of Argon2 iteration count.
   * @param {number} iters - Number of Argon2 iterations.
   * @returns {string} Description label with iteration count.
   * @private
   */
  describeRounds(iters) {
    if (iters <= 5)  return `low (${iters})`;
    if (iters <= 20) return `middle (${iters})`;
    return `high (${iters})`;
  }

  /**
   * Updates the status badge label and style.
   * @param {string} label - Text label for the status.
   * @param {string} badgeClass - CSS class for badge styling.
   * @param {string} borderClass - CSS class for input border styling.
   * @private
   */
  setStatus(label, badgeClass, borderClass) {
    this.$status.textContent = label;
    this.$status.className = `badge rounded-pill ${badgeClass}`;
    this.$input.className = `form-control mb-1 border ${borderClass}`;
  }

  /**
   * Clears all metadata fields in the UI to placeholder.
   * @private
   */
  clearFields() {
    [
      this.$saltLength,
      this.$saltValue,
      this.$roundCount,
      this.$version,
      this.$ivLength,
      this.$ivValue,
      this.$payloadLength,
    ].forEach((el) => (el.textContent = "—"));
  }

  /**
   * Resets status badge and clears metadata fields.
   * @private
   */
  resetView() {
    this.setStatus("unknown", "bg-secondary", "border-secondary");
    this.clearFields();
  }
}

export default DecodeController;

// Auto-instantiate when DOM is ready
window.addEventListener("DOMContentLoaded", () => new DecodeController());
