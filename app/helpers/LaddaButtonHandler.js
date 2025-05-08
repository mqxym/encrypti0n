/**
 * @class LaddaButtonManager
 * @classdesc
 * Manages a group of Ladda buttons for showing loading indicators and progress.
 */
export class LaddaButtonManager {
  /**
   * Creates a new manager for the given button selector.
   *
   * @param {string} selector - CSS selector to identify target buttons.
   */
  constructor(selector) {
    /** @private @type {Array<Ladda>} */
    this.buttons = Array.from(document.querySelectorAll(selector))
      .map((btn) => Ladda.create(btn));
  }

  /**
   * Starts the loading animation on all managed buttons.
   *
   * @returns {void}
   */
  startAll() {
    this.buttons.forEach((btn) => btn.start());
  }

  /**
   * Stops the loading animation on all managed buttons.
   *
   * @returns {void}
   */
  stopAll() {
    this.buttons.forEach((btn) => btn.stop());
  }

  /**
   * Sets the progress value (0 to 1) on all managed buttons.
   *
   * @param {number} progress - A value between 0 and 1 indicating load progress.
   * @returns {void}
   */
  setProgressAll(progress) {
    this.buttons.forEach((btn) => btn.setProgress(progress));
  }
}