// AppState.js

/**
 * @fileoverview
 * Lightweight, framework-agnostic global state container with a publish/subscribe
 * mechanism. Controllers and UI managers can read from {@link appState.state},
 * update it via {@link AppState#setState}, and react to changes by
 * {@link AppState#subscribe subscribing} listeners.
 *
 * ### Design goals
 * - Minimal API: `subscribe`, `unsubscribe`, `setState`, read-only `state`
 * - Shallow merges for updates (like React's `setState` in class components)
 * - No external dependencies
 *
 * ### State keys
 * - `currentView`: `'text' | 'files'` — which UI panel is shown.
 * - `isLocked`: `boolean` — whether the application data is protected by a master password.
 * - `actionInProgress`: `Record<string, any>` — place to stash per-action flags.
 * - `memoryBudget`: `number` (bytes) — device-aware in-memory budget for file ops.
 * - `isEncrypting` (optional): `boolean` — reserved flag for long-running ops.
 *
 * @example
 * // Subscribe to state changes
 * const onState = (s) => console.log('state changed:', s);
 * appState.subscribe(onState);
 *
 * // Update a few fields (shallow merge)
 * appState.setState({ currentView: 'files', actionInProgress: { encrypt: true } });
 *
 * // Later, if you no longer need updates:
 * appState.unsubscribe(onState);
 */

/**
 * Shape of the global state snapshot.
 * @typedef {Object} AppStateSnapshot
 * @property {'text'|'files'} currentView - Currently active UI view.
 * @property {boolean} isLocked - Whether local app data is encrypted/locked.
 * @property {Record<string, any>} actionInProgress - Bag for ongoing action flags/info.
 * @property {number} memoryBudget - Safe in-memory processing budget, in bytes.
 * @property {boolean} [isEncrypting] - Optional flag indicating active encryption/decryption.
 */

/**
 * Listener signature for state updates.
 * @callback AppStateListener
 * @param {AppStateSnapshot} state - The latest state after an update.
 * @returns {void}
 */

/**
 * @class AppState
 * @classdesc
 * Manages global application state and notifies subscribers on state changes.
 * Used to coordinate UI updates and action statuses across controllers.
 */
class AppState {
  /**
   * Initialize the state object and subscriber list with sensible defaults.
   */
  constructor() {
    /**
     * Current, immutable state snapshot. Do not mutate directly; always use {@link setState}.
     * @type {AppStateSnapshot}
     */
    this.state = {
      currentView: 'text',
      isLocked: false,
      actionInProgress: {},
      // Default device budget (bytes). UI may override at startup based on heuristics.
      memoryBudget: 50 * 1024 * 1024,
    };

    /**
     * Registered listeners to be invoked on each state change.
     * @private
     * @type {AppStateListener[]}
     */
    this.listeners = [];
  }

  /**
   * Subscribe a listener function that is called on every state update.
   *
   * Listeners are invoked synchronously in registration order.
   *
   * @param {AppStateListener} listener - Function called with the new state on each change.
   * @returns {void}
   *
   * @example
   * const unsubscribe = () => appState.unsubscribe(listener);
   * const listener = (s) => console.log(s.currentView);
   * appState.subscribe(listener);
   */
  subscribe(listener) {
    this.listeners.push(listener);
  }

  /**
   * Unsubscribe a previously registered listener.
   *
   * If the listener was added multiple times, only the first occurrence is removed.
   *
   * @param {AppStateListener} listener - The listener to remove.
   * @returns {void}
   */
  unsubscribe(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Shallow-merge the provided values into the current state and notify listeners.
   *
   * Only the top-level keys provided in `newState` are updated. Nested objects
   * are not deeply merged.
   *
   * @param {Partial<AppStateSnapshot>} newState
   *   One or more state properties to update.
   * @returns {void}
   *
   * @example
   * // Switch to file view and update a flag
   * appState.setState({ currentView: 'files', actionInProgress: { encrypt: true } });
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  /**
   * Invoke all registered listeners with the latest state snapshot.
   *
   * @private
   * @returns {void}
   */
  notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

const appState = new AppState();

export default appState;