/**
 * Manages Ladda Button Handling
 */
export class LaddaButtonManager {
  constructor(selector) {
    this.buttons = Array.from(document.querySelectorAll(selector)).map((btn) => Ladda.create(btn));
  }

  startAll() {
    this.buttons.forEach((btn) => btn.start());
  }

  stopAll() {
    this.buttons.forEach((btn) => btn.stop());
  }

  setProgressAll(progress) {
    this.buttons.forEach((btn) => btn.setProgress(progress));
  }
}
