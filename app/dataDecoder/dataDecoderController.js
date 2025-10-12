/**
 * @fileoverview Controller for decoding Base64 or UTF-8 input, extracting encryption metadata,
 * and updating the UI with header, salt, IV, and payload details in real time.
 * Utilizes shared Base64 utilities and an EncryptionService for header parsing.
 */

import { Cryptit } from "../../assets/libs/cryptit/cryptit.browser.min.js";
import { arrayBufferToBase64 } from "../main/utils/base64.js";

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
    this.cryptit = Cryptit;

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
    /** @type {HTMLElement} Element showing payload length. */
    this.$authLength  = $("authLength");
    /** @type {HTMLElement} Element showing payload length. */
    this.$authVal  = $("authVal");

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
  async handleInput() {
    const raw = this.$input.value;
    if (!raw.trim()) {
      this.resetView();
      return;
    }

    try {
      const decodedHeader = await this.cryptit.decodeHeader(raw);
      const decodedData = await this.cryptit.decodeData(raw);

      // Update status badge based on detected algorithm.
      this.setStatus(
        decodedHeader.scheme === 0 ? "encrypted" : "unknown",
        decodedHeader.scheme === 0 ? "bg-pink" : "bg-secondary",
        decodedHeader.scheme === 0 ? "border-pink" : "border-secondary"
      );

      // Display salt metadata.
      this.$saltLength.textContent = `${decodedHeader.saltLength}-byte`;
      this.$saltValue.textContent = decodedHeader.salt;

      // Display Argon2 iteration count description.
      this.$roundCount.textContent = decodedHeader.difficulty;

      // Display header version (incremented by 1 for UI clarity).
      this.$version.textContent = decodedHeader.scheme + 1;

      this.$ivLength.textContent = `${decodedData.params.ivLength}-byte`;
      this.$ivValue.textContent = arrayBufferToBase64(decodedData.params.iv);


      this.$authLength.textContent = `${decodedData.params.tagLength}-byte`;
      this.$authVal.textContent = arrayBufferToBase64(decodedData.params.tag);

      const payloadLen = decodedData.payloadLength;

      if (payloadLen <= 0) {
        throw Error("Payload can't be smaller than 0");
      }

      this.$payloadLength.textContent = `${payloadLen}-byte`;
    } catch (err) {
      this.resetView();
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

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
    this.$input.className = `cust-responsive-textarea form-control mb-1 cust-resize-none border ${borderClass}`;
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
      this.$authLength,
      this.$authVal,
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
