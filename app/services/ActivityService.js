/**
 * @class ActivityService
 * @classdesc
 * Tracks user activity and triggers a callback after a specified period of inactivity.
 * Also optionally displays a countdown in the DOM for time remaining until lock.
 */
export class ActivityService {
  /**
   * Creates an ActivityService.
   *
   * @param {number} timeoutInSeconds - Number of seconds of inactivity before callback.
   * @param {function(): void} inactivityCallback - Function to call upon timeout.
   * @throws {Error} If parameters are of incorrect types.
   */
  constructor(timeoutInSeconds, inactivityCallback) {
    if (typeof timeoutInSeconds !== 'number' || typeof inactivityCallback !== 'function') {
      throw new Error('Expected a number for timeout and a function for the callback.');
    }
    /** @private @type {number} */
    this.timeoutInSeconds = timeoutInSeconds;
    /** @private @type {function(): void} */
    this.inactivityCallback = inactivityCallback;
    /** @private @type {number|null} */
    this.timerId = null;
    /** @private @type {number} */
    this.expiryTime = 0;

    /** @private @type {number|null} Interval ID for countdown updates */
    this.countdownIntervalId = null;
    /** @private @type {jQuery<HTMLElement>|null} Element displaying countdown */
    this.countdownElement = null;

    // Bind the click/input handler to this instance
    this.handleButtonClick = this.handleButtonClick.bind(this);
  }

  /**
   * Starts monitoring activity:
   * - Attaches event listeners to reset on user interaction.
   * - Begins the inactivity timeout.
   * - If a countdown element is set, updates it periodically.
   *
   * @returns {void}
   */
  start() {
    // Listen for user interactions on buttons, links, and text inputs
    $(document).on('click input', 'button, a, input[type="text"]', this.handleButtonClick);
    this.resetTimer();

    if (this.countdownElement) {
      this.startCountdownUpdate();
    }
  }

  /**
   * Stops monitoring activity:
   * - Removes event listeners.
   * - Clears the inactivity timeout.
   * - Stops countdown updates.
   *
   * @returns {void}
   */
  stop() {
    $(document).off('click input', 'button, a, input[type="text"]', this.handleButtonClick);
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.stopCountdownUpdate();
  }

  /**
   * Event handler invoked on each user interaction.
   * Resets the inactivity timer.
   *
   * @private
   * @returns {void}
   */
  handleButtonClick() {
    this.resetTimer();
  }

  /**
   * Resets the inactivity timer, recalculates expiry time,
   * and schedules the inactivity callback.
   *
   * @private
   * @returns {void}
   */
  resetTimer() {
    if (this.timerId) {
      clearTimeout(this.timerId);
    }
    this.expiryTime = Date.now() + this.timeoutInSeconds * 1000;
    this.timerId = setTimeout(() => {
      this.inactivityCallback();
      this.stopCountdownUpdate();
    }, this.timeoutInSeconds * 1000);
  }

  /**
   * Registers a DOM element (by selector) to display the countdown.
   *
   * @param {string} selector - jQuery selector for the countdown element.
   * @returns {void}
   */
  startCountdown(selector) {
    this.countdownElement = $(selector);
    if (this.countdownElement.length === 0) {
      return;
    }
    this.startCountdownUpdate();
  }

  /**
   * Begins periodic updates of the countdown display every 5 seconds.
   *
   * @private
   * @returns {void}
   */
  startCountdownUpdate() {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
    }
    this.updateCountdownDisplay();
    this.countdownIntervalId = setInterval(() => {
      this.updateCountdownDisplay();
    }, 5 * 1000);
  }

  /**
   * Stops the countdown update interval and clears the display text.
   *
   * @private
   * @returns {void}
   */
  stopCountdownUpdate() {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    if (this.countdownElement) {
      this.countdownElement.text('');
    }
  }

  /**
   * Updates the registered countdown element with the seconds remaining
   * until the inactivity callback triggers.
   *
   * @private
   * @returns {void}
   */
  updateCountdownDisplay() {
    if (!this.countdownElement) return;
    const remainingMs = this.expiryTime - Date.now();
    const remainingSec = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
    this.countdownElement.text(
      `Time left before application is locked: ${remainingSec} second(s)`
    );
  }
}