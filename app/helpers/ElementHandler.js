export class EventBinder {
  /**
   * Binds an event to a selector.
   * @param {string} selector - CSS selector (id or class).
   * @param {string} event - Event type (e.g., 'click', 'input').
   * @param {Function} handler - Event handler function.
   */
  static on(selector, event, handler) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.addEventListener(event, handler));
  }


  /**
   * Shows a Bootstrap 5 modal by selector (with animation and backdrop).
   * @param {string} selector - CSS selector for the modal (e.g. '#myModal').
   */
  static showModal(selector) {
    const modalElem = document.querySelector(selector);
    if (!modalElem) return;
    // Bootstrap 5 Modal API
    let modal = bootstrap.Modal.getInstance(modalElem);
    if (!modal) {
      modal = new bootstrap.Modal(modalElem, {
        backdrop: true,
        keyboard: true,
        focus: true
      });
    }
    modal.show();
  }
}

/**
 * Manages Element Handling
 */
export class ElementHandler {
  static hide(element) {
    const el = document.getElementById(element);
    if (el) el.classList.add('d-none');
  }

  static show(element) {
    const el = document.getElementById(element);
    if (el) el.classList.remove('d-none');
  }

  static showModal(modalId) {
    const modalElem = document.getElementById(modalId);
    if (!modalElem) return;
    let modal = bootstrap.Modal.getInstance(modalElem);
    if (!modal) {
      modal = new bootstrap.Modal(modalElem, {
        backdrop: true,
        keyboard: true,
        focus: true
      });
    }
    modal.show();
  }

  static hideModal(modalId) {
    const modalElem = document.getElementById(modalId);
    if (!modalElem) return;
    let modal = bootstrap.Modal.getInstance(modalElem);
    if (!modal) {
      modal = new bootstrap.Modal(modalElem, {
        backdrop: true,
        keyboard: true,
        focus: true
      });
    }
    modal.hide();
  }

  static removeHandler(element) {
    const oldElem = document.getElementById(element);
    if (oldElem) {
      const newElem = oldElem.cloneNode(true);
      oldElem.parentNode.replaceChild(newElem, oldElem);
    }
  }

  static blueToPinkBorder(element) {
    const el = document.getElementById(element);
    if (el) {
      el.classList.remove('border-blue');
      el.classList.add('border-pink');
    }
  }

  static pinkToBlueBorder(element) {
    const el = document.getElementById(element);
    if (el) {
      el.classList.remove('border-pink');
      el.classList.add('border-blue');
    }
  }

  static fillPillBlue(element) {
    const el = document.getElementById(element);
    if (el) {
      el.classList.remove('badge-outline-blue');
      el.classList.add('bg-blue');
    }
  }

  static emptyPillBlue(element) {
    const el = document.getElementById(element);
    if (el) {
      el.classList.remove('bg-blue');
      el.classList.add('badge-outline-blue');
    }
  }

  static fillPillPink(element) {
    const el = document.getElementById(element);
    if (el) {
      el.classList.remove('badge-outline-pink');
      el.classList.add('bg-pink');
    }
  }

  static emptyPillPink(element) {
    const el = document.getElementById(element);
    if (el) {
      el.classList.remove('bg-pink');
      el.classList.add('badge-outline-pink');
    }
  }

  static buttonClassBlueToPinkOutline(inputClass) {
    document.querySelectorAll('.' + inputClass).forEach(el => {
      el.classList.remove('btn-outline-blue');
      el.classList.add('btn-outline-pink');
    });
  }

  static buttonClassPinkToBlueOutline(inputClass) {
    document.querySelectorAll('.' + inputClass).forEach(el => {
      el.classList.remove('btn-outline-pink');
      el.classList.add('btn-outline-blue');
    });
  }

  static buttonClassBlueToPink(inputClass) {
    document.querySelectorAll('.' + inputClass).forEach(el => {
      el.classList.remove('btn-blue');
      el.classList.add('btn-pink');
    });
  }

  static buttonClassPinkToBlue(inputClass) {
    document.querySelectorAll('.' + inputClass).forEach(el => {
      el.classList.remove('btn-pink');
      el.classList.add('btn-blue');
    });
  }

  static fillButtonClassBlue(inputClass) {
    document.querySelectorAll('.' + inputClass).forEach(el => {
      el.classList.remove('btn-outline-blue');
      el.classList.add('btn-blue');
    });
  }

  static fillButtonClassPink(inputClass) {
    document.querySelectorAll('.' + inputClass).forEach(el => {
      el.classList.remove('btn-outline-pink');
      el.classList.add('btn-pink');
    });
  }

  static emptyButtonClassBlue(inputClass) {
    document.querySelectorAll('.' + inputClass).forEach(el => {
      el.classList.add('btn-outline-blue');
      el.classList.remove('btn-blue');
    });
  }

  static emptyButtonClassPink(inputClass) {
    document.querySelectorAll('.' + inputClass).forEach(el => {
      el.classList.add('btn-outline-pink');
      el.classList.remove('btn-pink');
    });
  }

  static arrowsToCheck() {
    document.querySelectorAll('.mdi-arrow-right-thick').forEach(el => {
      el.classList.remove('mdi-arrow-right-thick');
      el.classList.add('removed-right', 'mdi-check-all');
    });
    document.querySelectorAll('.mdi-arrow-down-bold').forEach(el => {
      el.classList.remove('mdi-arrow-down-bold');
      el.classList.add('removed-down', 'mdi-check-all');
    });
  }

  static checkToArrows() {
    document.querySelectorAll('.removed-right').forEach(el => {
      el.classList.remove('removed-right', 'mdi-check-all');
      el.classList.add('mdi-arrow-right-thick');
    });
    document.querySelectorAll('.removed-down').forEach(el => {
      el.classList.remove('removed-down', 'mdi-check-all');
      el.classList.add('mdi-arrow-down-bold');
    });
  }

  static arrowsToCross() {
    document.querySelectorAll('.mdi-arrow-right-thick').forEach(el => {
      el.classList.remove('mdi-arrow-right-thick');
      el.classList.add('removed-right', 'mdi-close-circle-multiple');
    });
    document.querySelectorAll('.mdi-arrow-down-bold').forEach(el => {
      el.classList.remove('mdi-arrow-down-bold');
      el.classList.add('removed-down', 'mdi-close-circle-multiple');
    });
  }

  static crossToArrows() {
    document.querySelectorAll('.removed-right').forEach(el => {
      el.classList.remove('removed-right', 'mdi-close-circle-multiple');
      el.classList.add('mdi-arrow-right-thick');
    });
    document.querySelectorAll('.removed-down').forEach(el => {
      el.classList.remove('removed-down', 'mdi-close-circle-multiple');
      el.classList.add('mdi-arrow-down-bold');
    });
  }

  static buttonRemoveTextAddSuccess(preId) {
    const text = document.getElementById(`${preId}Text`);
    const success = document.getElementById(`${preId}Success`);
    if (text) text.classList.add('d-none');
    if (success) success.classList.remove('d-none');
  }

  static buttonRemoveTextAddFail(preId) {
    const text = document.getElementById(`${preId}Text`);
    const fail = document.getElementById(`${preId}Fail`);
    if (text) text.classList.add('d-none');
    if (fail) fail.classList.remove('d-none');
  }

  static buttonRemoveStatusAddText(preId) {
    const success = document.getElementById(`${preId}Success`);
    const fail = document.getElementById(`${preId}Fail`);
    const text = document.getElementById(`${preId}Text`);
    if (success) success.classList.add('d-none');
    if (fail) fail.classList.add('d-none');
    if (text) text.classList.remove('d-none');
  }

  static fillButtonGray(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('btn-secondary');
      el.classList.remove('btn-outline-secondary');
    }
  }

  static emptyButtonGray(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('btn-outline-secondary');
      el.classList.remove('btn-secondary');
    }
  }

  static populateSelectWithSlotNames(slotNames, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    for (const key in slotNames) {
      if (Object.prototype.hasOwnProperty.call(slotNames, key)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = slotNames[key];
        select.appendChild(option);
      }
    }
  }

  static disable(element) {
    const el = document.getElementById(element);
    if (el) el.disabled = true;
  }

  static enable(element) {
    const el = document.getElementById(element);
    if (el) el.disabled = false;
  }

  static setPlaceholderById(id, placeholderText) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('placeholder', placeholderText);
  }

  static check(element) {
    const el = document.getElementById(element);
    if (el) el.checked = true;
  }

  static uncheck(element) {
    const el = document.getElementById(element);
    if (el) el.checked = false;
  }
}