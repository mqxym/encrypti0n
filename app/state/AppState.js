/**
 * @class AppState
 * @classdesc
 * Manages global application state and notifies subscribers on state changes.
 * Used to coordinate UI updates and action statuses across controllers.
 */
class AppState {
  /**
   * Initializes the state object and subscriber list.
   */
  constructor() {
    /**
     * @type {{ isEncrypting: boolean, currentView: string, isLocked: boolean, actionInProgress: boolean }}
     */
    this.state = {
      isEncrypting: false,
      currentView: 'text',
      isLocked: false,
      actionInProgress: false,
    };
    /** @private @type {Array<function(Object)>} */
    this.listeners = [];
  }

  /**
   * Subscribes a listener function to state updates.
   *
   * @param {function(Object)} listener - Function called with the new state on each change.
   */
  subscribe(listener) {
    this.listeners.push(listener);
  }

  /**
   * Unsubscribes a previously registered listener.
   *
   * @param {function(Object)} listener - The listener to remove.
   */
  unsubscribe(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Updates the internal state with provided values and notifies all subscribers.
   *
   * @param {Partial<{ isEncrypting: boolean, currentView: string, isLocked: boolean, actionInProgress: boolean }>} newState
   *   An object containing one or more state properties to update.
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  /**
   * Invokes all registered listeners with the current state.
   *
   * @private
   */
  notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

const appState = new AppState();

export default appState;