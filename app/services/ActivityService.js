export class ActivityService {
    /**
     * Creates an instance of ActivityService.
     * @param {number} timeoutInSeconds - Inactivity timeout (in seconds).
     * @param {function} inactivityCallback - The callback function to execute after inactivity.
     */
    constructor(timeoutInSeconds, inactivityCallback) {
      if (typeof timeoutInSeconds !== 'number' || typeof inactivityCallback !== 'function') {
        throw new Error('Expected a number for timeout and a function for the callback.');
      }
      this.timeoutInSeconds = timeoutInSeconds;
      this.inactivityCallback = inactivityCallback;
      this.timerId = null;
      this.expiryTime = 0;
  
      // Interval id for updating the DOM countdown.
      this.countdownIntervalId = null;
      this.countdownElement = null;
  
      // Bind the event handler to the current instance.
      this.handleButtonClick = this.handleButtonClick.bind(this);
    }
  
    /**
     * Starts the service by attaching button event listeners, starting the inactivity timer,
     * and initiating the countdown update (if a countdown element is defined).
     */
    start() {
      // Attach delegated event listener for button clicks.
      $(document).on('click input', 'button, a, input[type="text"]', this.handleButtonClick);
      this.resetTimer();
  
      // If a countdown element is registered, start the countdown update.
      if (this.countdownElement) {
        this.startCountdownUpdate();
      }
    }
  
    /**
     * Stops the service by removing event listeners, clearing the inactivity timer,
     * and stopping the DOM countdown update.
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
     * Event handler for button clicks.
     * Resets the inactivity timer.
     */
    handleButtonClick() {
      this.resetTimer();
    }
  
    /**
     * Resets the inactivity timer and updates the expiration time.
     */
    resetTimer() {
      if (this.timerId) {
        clearTimeout(this.timerId);
      }
      // Set the new expiry time (in milliseconds)
      this.expiryTime = Date.now() + this.timeoutInSeconds * 1000;
      this.timerId = setTimeout(() => {
        this.inactivityCallback();
        // Stop the countdown update once the inactivity callback has been fired.
        this.stopCountdownUpdate();
      }, this.timeoutInSeconds * 1000);
    }
  
    /**
     * Registers a DOM element (via a jQuery selector) to be updated every 10 seconds
     * with the time left before the inactivity callback triggers.
     * @param {string} selector - A jQuery selector to identify the DOM element.
     */
    startCountdown(selector) {
      this.countdownElement = $(selector);
      if (this.countdownElement.length === 0) {
        return;
      }
      // Start the interval to update the element every 10 seconds.
      this.startCountdownUpdate();
    }
  
    /**
     * Starts the countdown update interval.
     */
    startCountdownUpdate() {
      // Clear any existing interval first.
      if (this.countdownIntervalId) {
        clearInterval(this.countdownIntervalId);
      }
      // Immediately update the element.
      this.updateCountdownDisplay();
  
      // Then set an interval to update every 10 seconds.
      this.countdownIntervalId = setInterval(() => {
        this.updateCountdownDisplay();
      }, 5 * 1000);
    }
  
    /**
     * Stops the countdown update interval.
     */
    stopCountdownUpdate() {
      if (this.countdownIntervalId) {
        clearInterval(this.countdownIntervalId);
        this.countdownIntervalId = null;
      }
      this.countdownElement.text('');
    }
  
    /**
     * Updates the registered DOM element with the remaining time (in seconds)
     * until the inactivity lock is triggered.
     */
    updateCountdownDisplay() {
      if (!this.countdownElement) return;
      // Calculate the remaining time in seconds.
      const remainingMs = this.expiryTime - Date.now();
      const remainingSec = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
      this.countdownElement.text(`Time left before application is locked: ${remainingSec} second(s)`);
    }
  }