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
 * Wraps an async action to prevent concurrent runs and track its progress in the global app state.
 *
 * @param {string} actionName - A unique key identifying the action (e.g. "isEncrypting").
 * @param {() => Promise<any>} actionFn - The asynchronous function to execute.
 * @returns {Promise<void>} Resolves when the action completes (or immediately if already in progress).
 */
export async function wrapAction(actionName, actionFn) {
  if (appState.state.actionInProgress[actionName]) return;

  appState.setState({
    actionInProgress: {
      ...appState.state.actionInProgress,
      [actionName]: true,
    },
  });

  try {
    await actionFn();
  } finally {
    appState.setState({
      actionInProgress: {
        ...appState.state.actionInProgress,
        [actionName]: false,
      },
    });
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
