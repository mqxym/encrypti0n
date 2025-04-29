import appState from '../state/AppState.js';
import { ElementHandler } from '../helpers/ElementHandler.js';
import { delay } from './misc.js';
import { UIConstants } from '../constants/constants.js';

export async function wrapAction(actionFn) {
  if (appState.state.actionInProgress) return;
  appState.setState({ actionInProgress: true });
  try {
    await actionFn();
  } finally {
    appState.setState({ actionInProgress: false });
  }
}

export async function handleActionError(buttonId) {
  ElementHandler.buttonRemoveTextAddFail(buttonId);
  await delay(UIConstants.ACTION_DELAY);
  ElementHandler.buttonRemoveStatusAddText(buttonId);
}

export async function handleActionSuccess(buttonId) {
  ElementHandler.buttonRemoveTextAddSuccess(buttonId);
  await delay(UIConstants.ACTION_DELAY);
  ElementHandler.buttonRemoveStatusAddText(buttonId);
}
