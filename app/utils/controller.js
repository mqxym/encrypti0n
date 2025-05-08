/**
 * @module utils/controller
 * @description
 * Provides utility functions to wrap asynchronous actions with global state management
 * and standardized UI feedback for success or failure of button-triggered operations.
 */

import appState from '../state/AppState.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { delay } from './misc.js';
import { UIConstants } from '../constants/constants.js';

/**
 * Ensures that only one action runs at a time by checking and setting `actionInProgress` in global state.
 * Wraps the provided async function, automatically toggling the state flag before and after execution.
 *
 * @async
 * @param {function(): Promise<void>} actionFn - The async function representing the action to perform.
 * @returns {Promise<void>}
 */
export async function wrapAction(actionFn) {
  if (appState.state.actionInProgress) return;
  appState.setState({ actionInProgress: true });
  try {
    await actionFn();
  } finally {
    appState.setState({ actionInProgress: false });
  }
}

/**
 * Applies a "failure" visual state to the button identified by `buttonId`,
 * waits for a configured delay, then restores the original button text/status.
 *
 * @async
 * @param {string} buttonId - The DOM element ID of the button (without '#').
 * @returns {Promise<void>}
 */
export async function handleActionError(buttonId) {
  ElementHandler.buttonRemoveTextAddFail(buttonId);
  await delay(UIConstants.ACTION_DELAY);
  ElementHandler.buttonRemoveStatusAddText(buttonId);
}

/**
 * Applies a "success" visual state to the button identified by `buttonId`,
 * waits for a configured delay, then restores the original button text/status.
 *
 * @async
 * @param {string} buttonId - The DOM element ID of the button (without '#').
 * @returns {Promise<void>}
 */
export async function handleActionSuccess(buttonId) {
  ElementHandler.buttonRemoveTextAddSuccess(buttonId);
  await delay(UIConstants.ACTION_DELAY);
  ElementHandler.buttonRemoveStatusAddText(buttonId);
}