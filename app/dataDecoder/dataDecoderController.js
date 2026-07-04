/**
 * @fileoverview Controller for decoding Base64 text or binary File/Blob input,
 * extracting encryption metadata, and updating the UI in real time.
 * Supports both paste-text and drag-and-drop / browse file upload modes.
 * Handles both single-block (non-chunked) and streaming (chunked) payloads.
 */

import { Cryptit } from "../../assets/libs/cryptit/cryptit.browser.min.js";
import { arrayBufferToBase64 } from "../main/utils/base64.js";

class DecodeController {
  constructor() {
    this.cryptit = Cryptit;

    const $ = (id) => document.getElementById(id);

    // Input elements
    this.$input              = $("dataInput");
    this.$fileInput          = $("fileInput");
    this.$fileNameDisplay    = $("fileNameDisplay");
    this.$dropZone           = $("dropZone");

    // Result elements — header (always shown)
    this.$status             = $("statusBadge");
    this.$version            = $("version");
    this.$saltLength         = $("saltLength");
    this.$saltValue          = $("saltValue");
    this.$roundCount         = $("roundCount");

    // Result elements — non-chunked section
    this.$nonChunkedSection  = $("nonChunkedSection");
    this.$ivLength           = $("ivLength");
    this.$ivValue            = $("ivValue");
    this.$authLength         = $("authLength");
    this.$authVal            = $("authVal");
    this.$payloadLength      = $("payloadLength");

    // Result elements — chunked section
    this.$chunkedSection     = $("chunkedSection");
    this.$chunkSize          = $("chunkSize");
    this.$chunkCount         = $("chunkCount");
    this.$totalPayload       = $("totalPayload");

    // Loading indicator (shown for files > 200 MiB)
    this.$loadingIndicator   = $("fileLoadingIndicator");

    this.bindEvents();
    this.handleTextInput();
  }

  bindEvents() {
    // Text tab
    this.$input.addEventListener("input", () => this.handleTextInput());

    // File tab — browse
    this.$fileInput.addEventListener("change", () => this.handleFileChange());

    // File tab — click anywhere on the drop zone to open the file picker
    this.$dropZone.addEventListener("click", (e) => {
      if (!e.target.closest("label") && e.target !== this.$fileInput) {
        this.$fileInput.click();
      }
    });

    // File tab — drag and drop
    this.$dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.$dropZone.classList.remove("border-secondary", "border-pink");
      this.$dropZone.classList.add("border-primary");
    });
    this.$dropZone.addEventListener("dragleave", () => {
      this.$dropZone.classList.remove("border-primary", "border-pink");
      this.$dropZone.classList.add("border-secondary");
    });
    this.$dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.$dropZone.classList.remove("border-primary");
      const file = e.dataTransfer?.files?.[0];
      if (file) this.processFile(file);
    });

    // Tab switches — re-evaluate active input when switching
    document.getElementById("tab-text-btn")?.addEventListener("shown.bs.tab", () => this.handleTextInput());
    document.getElementById("tab-file-btn")?.addEventListener("shown.bs.tab", () => {
      if (!this.$fileInput.files?.length) this.resetView();
    });
  }

  // ------------------------------------------------------------------
  // Input handlers
  // ------------------------------------------------------------------

  async handleTextInput() {
    const raw = this.$input.value.trim();
    if (!raw) { this.resetView(); return; }
    await this.decode(raw);
  }

  async handleFileChange() {
    const file = this.$fileInput.files?.[0];
    if (!file) { this.$fileNameDisplay.textContent = ""; this.resetView(); return; }
    await this.processFile(file);
  }

  async processFile(file) {
    this.$fileNameDisplay.textContent = file.name;
    const isLarge = file.size > 200 * 1024 * 1024;
    if (isLarge) this.$loadingIndicator.classList.remove("d-none");
    try {
      await this.decode(file); // File extends Blob — accepted directly by Cryptit
    } finally {
      this.$loadingIndicator.classList.add("d-none");
    }
  }

  // ------------------------------------------------------------------
  // Core decode — accepts a Base64 string or a Blob/File
  // ------------------------------------------------------------------

  async decode(input) {
    try {
      const decodedHeader = await this.cryptit.decodeHeader(input);
      const decodedData   = await this.cryptit.decodeData(input);

      const isValid = decodedHeader.scheme === 0 || decodedHeader.scheme === 1;
      this.setStatus(
        isValid ? "encrypted" : "unknown",
        isValid ? "bg-pink"   : "bg-secondary",
        isValid ? "border-pink" : "border-secondary",
      );

      // Header fields — always present
      this.$version.textContent    = decodedHeader.scheme;
      this.$saltLength.textContent = `${decodedHeader.saltLength}-byte`;
      this.$saltValue.textContent  = decodedHeader.salt;
      this.$roundCount.textContent = decodedHeader.difficulty;

      if (decodedData.isChunked) {
        // Streaming / chunked file payload
        this.$nonChunkedSection.classList.add("d-none");
        this.$chunkedSection.classList.remove("d-none");

        const { chunkSize, count, totalPayload } = decodedData.chunks;
        this.$chunkSize.textContent    = this.formatBytes(chunkSize);
        this.$chunkCount.textContent   = count;
        this.$totalPayload.textContent = this.formatBytes(totalPayload);
      } else {
        // Single-block payload
        this.$chunkedSection.classList.add("d-none");
        this.$nonChunkedSection.classList.remove("d-none");

        const payloadLen = decodedData.payloadLength;
        if (payloadLen <= 0) throw new Error("Payload length must be positive");

        this.$ivLength.textContent      = `${decodedData.params.ivLength}-byte`;
        this.$ivValue.textContent       = arrayBufferToBase64(decodedData.params.iv);
        this.$authLength.textContent    = `${decodedData.params.tagLength}-byte`;
        this.$authVal.textContent       = arrayBufferToBase64(decodedData.params.tag);
        this.$payloadLength.textContent = this.formatBytes(payloadLen);
      }
    } catch {
      this.resetView();
    }
  }

  // ------------------------------------------------------------------
  // UI helpers
  // ------------------------------------------------------------------

  setStatus(label, badgeClass, borderClass) {
    this.$status.textContent = label;
    this.$status.className   = `badge rounded-pill ${badgeClass} px-3 py-2`;
    // Textarea border (text tab)
    this.$input.className    = `form-control cust-resize-none border ${borderClass}`;
    // Drop zone border (file tab)
    this.$dropZone.classList.remove("border-secondary", "border-primary", "border-pink");
    this.$dropZone.classList.add(borderClass);
  }

  clearFields() {
    [
      this.$version,      this.$saltLength,  this.$saltValue,  this.$roundCount,
      this.$ivLength,     this.$ivValue,     this.$authLength, this.$authVal,
      this.$payloadLength,
      this.$chunkSize,    this.$chunkCount,  this.$totalPayload,
    ].forEach((el) => (el.textContent = "—"));
  }

  resetView() {
    this.setStatus("unknown", "bg-secondary", "border-secondary");
    this.$nonChunkedSection.classList.remove("d-none");
    this.$chunkedSection.classList.add("d-none");
    this.clearFields();
  }

  /**
   * Format a byte count into a human-readable string, e.g. "512 KiB".
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 byte";
    const units = ["byte", "KiB", "MiB", "GiB"];
    const i = Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1);
    const value = i === 0 ? bytes : (bytes / Math.pow(1024, i)).toFixed(2);
    return `${value} ${units[i]}`;
  }
}

export default DecodeController;
