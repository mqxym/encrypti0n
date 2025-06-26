/**
 * @file SlotUiService.js
 * @author mqxym & o3
 * @description UI service that renders and manages editable password-slot rows inside a Bootstrap 5 modal.
 *
 * Key features
 * -------------
 * * **Table rendering**: Shows a # / Name / Delete-icon table injected into the modal body.
 * * **Local staging**: Keeps an in-memory copy of slot data so the user can make several changes
 *   and persist them all at once with the **Save** button (`#slotAction`).
 * * **CRUD**: Uses the provided `ConfigManager` instance only when Save is pressed.
 * * **SweetAlert2** for confirmations/notifications (no browser alerts).
 * * **jQuery** for DOM/event work; no other runtime deps except SweetAlert & Bootstrap.
 *
 */

/* global $, Swal, bootstrap */

import { ElementHandler } from '../../helpers/ElementHandler.js';
import { handleActionError, handleActionSuccess } from '../../utils/controller.js';
import { KeyManagementConstants } from '../../constants/constants.js';

/**
 * @typedef {import('./ConfigManager.js').default} ConfigManager
 */

/**
 * UI service that renders and manages password slots in a Bootstrap modal.
 */
export class SlotUiService {
  /**
   * @param {object}  options                           - Configuration options.
   * @param {string}  options.modalSelector             - Selector for the target modal.
   * @param {string} [options.tableContainerSelector]   - Selector (relative to modal) into which the table is injected (defaults to `.modal-body`).
   * @param {ConfigManager} configManager               - ConfigManager instance.
   */
  constructor(options, configManager) {
    if (!configManager) throw new Error('configManager instance is required');

    /** @private */ this.configManager = configManager;
    /** @private */ this.modalSelector = options.modalSelector || '#editSlotsModal';
    /** @private */ this.tableContainerSelector = options.tableContainerSelector || '.modal-body';
    /** @private */ this.$modal = $(this.modalSelector);

    /**
     * Local copy of slots currently displayed - keys are numeric IDs or negative
     * placeholders for unsaved rows, values are names.
     * @type {Record<string|number,string>}
     * @private
     */
    this.slots = {};

    /**
     * Snapshot of slots as originally loaded from ConfigManager, used for diffing
     * on Save.
     * @type {Record<string|number,string>}
     * @private
     */
    this.originalSlots = {};

    /** @private */ this._tmpId = -1; // decreasing negative numbers for new rows.

    this._bindStaticEvents();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Reloads slot data (unless already staged) and draws the table.
   * Called automatically whenever the modal is shown.
   *
   * @async
   * @public
   * @returns {Promise<void>}
   */
  async render() {
    // If we already have a staged copy (user is editing) we re-render from it;
    // otherwise load fresh data.
    if (Object.keys(this.slots).length === 0) {
      await this._loadSlotsFromConfig();
    }

    const $container = this.$modal.find(this.tableContainerSelector);
    $container.empty();

    const $table = $('<table id="slotTable" class="table align-middle mb-0"></table>');
    $table.append(`
      <thead>
        <tr>
          <th style="width:15%">#</th>
          <th>Name</th>
          <th style="width:10%"></th>
        </tr>
      </thead>`);

    const $information = $('<p class="mt-2">The first available ID is selected when a new slot is added.</p>');

    const $tbody = $('<tbody>');
    Object.keys(this.slots)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((id) => $tbody.append(this._buildRow(id, this.slots[id])));

    $table.append($tbody);
    $container.append($table, this._buildAddButton(), $information);

    this._bindDynamicEvents();
  }

  /**
   * Resets the modal state: clears staged data, empties the table container,
   * and resets the temporary ID counter.
   *
   * @public
   */
  resetModal() {
    this.slots = {};
    this.originalSlots = {};
    this._tmpId = -1;
    const $container = this.$modal.find(this.tableContainerSelector);
    $container.empty();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Event binding helpers
  // ────────────────────────────────────────────────────────────────────────────

  /** @private */
  _bindStaticEvents() {
    // Refresh table whenever modal is shown (and reset staged data).
    this.$modal.on('shown.bs.modal', () => {
      this.slots = {}; // reset staging so we fetch fresh.
      this.originalSlots = {};
      this.render().catch(console.error);
    });

    // Save button (already present in original markup)
    this.$modal.find('#slotAction').on('click', (e) => {
      e.preventDefault();
      this._saveChanges();
    });
  }

  /** @private */
  _bindDynamicEvents() {
    const $container = this.$modal.find(this.tableContainerSelector);

    // Inline-name editing updates the staged data only.
    $container
      .find('.slot-name-input')
      .off('input')
      .on('input', (e) => {
        const $input = $(e.currentTarget);
        const id = $input.data('id');
        const name = $input.val().toString().trim().slice(0, 15);
        this.slots[id] = name;
      });

    // Delete row (staged deletion)
    $container
      .find('.delete-slot-btn')
      .off('click')
      .on('click', (e) => {
        const id = $(e.currentTarget).data('id');
        Swal.fire({
          title: `Delete slot ${id}?`,
          text: 'This change will be applied after you press Save.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, delete it!',
        }).then(({ isConfirmed }) => {
          if (!isConfirmed) return;
          delete this.slots[id];
          this.render();
        });
      });

    // Add new row (staged)
    $container
      .find('#addSlotBtn')
      .off('click')
      .on('click', () => {
        const newId = this._tmpId--; // negative unique ID
        this.slots[newId] = `Slot ${Math.abs(newId)}`;
        this.render();
      });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DOM builders
  // ────────────────────────────────────────────────────────────────────────────

  /** @private */
  _buildRow(id, name) {
    const $tr = $('<tr>').attr('data-id', id);
    const $idCell = $('<td>').text(id > 0 ? id : '—');
    const $nameCell = $('<td>').append(
      $('<input>', {
        type: 'text',
        class: 'form-control form-control-sm slot-name-input',
        maxlength: KeyManagementConstants.MAX_SLOT_NAME_LENGTH,
        value: name,
        'data-id': id,
        'aria-label': `Slot ${id} name`,
      })
    );
    const $deleteCell = $('<td>').append(
      $('<button>', {
        type: 'button',
        class: 'btn btn-sm btn-outline-danger delete-slot-btn',
        'data-id': id,
        html: '<i class="mdi mdi-trash-can-outline"></i>',
        title: 'Delete slot',
      })
    );

    return $tr.append($idCell, $nameCell, $deleteCell);
  }

  /** @private */
  _buildAddButton() {
    return $('<div>', { class: 'd-flex justify-content-end mt-3' }).append(
      $('<button>', {
        type: 'button',
        id: 'addSlotBtn',
        class: 'btn btn-outline-primary btn-sm',
        html: '<i class="mdi mdi-plus-circle-outline me-1"></i>Add Slot',
      })
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Loads slots from ConfigManager into both `originalSlots` and `slots`.
   * @private
   */
  async _loadSlotsFromConfig() {
    try {
      this.originalSlots = await this.configManager.readSlotNames();
      // Deep clone to avoid shared refs.
      this.slots = JSON.parse(JSON.stringify(this.originalSlots));
    } catch (err) {
      this.originalSlots = {};
      this.slots = {};
    }
  }

  /**
   * Validates a slot and its new name against length constraints.
   *
   * @private
   * @param {*} slot - The slot identifier to validate.
   * @param {*} name - The new slot name to validate.
   * @throws {Error} If the name is invalid or too long, or the slot is invalid.
   */
  _validateSlotName(slot, name) {
    if (!name) {
      throw new Error('Slot name cannot be empty');
    }
    if (typeof name !== 'string') {
      throw new Error('Slot name must be a string');
    }
    if (name.length > KeyManagementConstants.MAX_SLOT_NAME_LENGTH) {
      throw new Error(`Slot name cannot exceed ${KeyManagementConstants.MAX_SLOT_NAME_LENGTH} characters`);
    }
    this._validateSlot(slot);
  }

  /**
   * Ensures the provided slot identifier is a non-empty string.
   *
   * @private
   * @param {*} slot - The slot value to validate.
   * @throws {Error} If the slot is empty or not a string.
   */
  _validateSlot(slot) {
    if (!slot) {
      throw new Error('Slot cannot be empty');
    }
    if (typeof slot !== 'string' && typeof slot !== 'number') {
      throw new Error('Slot must be a string');
    }
  }

  /**
   * Calculates diff between staged `slots` and `originalSlots` and persists
   * changes through ConfigManager.
   *
   * @private
   * @returns {Promise<void>}
   */
  async _saveChanges() {
    const $btn = this.$modal.find('#slotAction');
    $btn.prop('disabled', true);
    try {
      if (Object.keys(this.slots).length === 0) {
        throw new Error('There must be at least one slot.');
      }

      // ─── Determine changes ───────────────────────────────────────────────
      /** @type {Array<string|number>} */ const deletions = [];
      /** @type {Array<{id:number|string,name:string}>} */ const updates = [];
      /** @type {Array<{tmpId:number,name:string}>} */ const additions = [];

      // Deletions & updates
      for (const id in this.originalSlots) {
        if (!Object.prototype.hasOwnProperty.call(this.slots, id)) {
          deletions.push(id);
        } else if (this.originalSlots[id] !== this.slots[id]) {
          updates.push({ id, name: this.slots[id] });
        }
      }

      // Additions
      for (const id in this.slots) {
        if (!Object.prototype.hasOwnProperty.call(this.originalSlots, id)) {
          additions.push({ tmpId: id, name: this.slots[id] });
        }
      }

      // ─── Persist via ConfigManager ───────────────────────────────────────
      for (const id of deletions) {
        this._validateSlot(id);
        await this.configManager.deleteSlot(id);
      }

      // For additions we need to obtain real IDs first
      const tmpIdToRealId = new Map();
      for (const { tmpId, name } of additions) {
        const realId = await this.configManager.addSlot();
        tmpIdToRealId.set(tmpId, realId);
        this._validateSlotName(realId, name);
        await this.configManager.setSlotName(realId, name);
      }

      // Updates (for both existing and just-added rows)
      for (const { id, name } of updates) {
        this._validateSlotName(id, name);
        await this.configManager.setSlotName(id, name);
      }

      // Also update names for the new slots in case default name differs
      for (const { tmpId, name } of additions) {
        const realId = tmpIdToRealId.get(tmpId);
        // The previous setSlotName already did it, but safer to ensure.
        this._validateSlotName(realId, name);
        await this.configManager.setSlotName(realId, name);
      }

      await this._loadSlotsFromConfig(); // refresh originals
      await this.render();
      ElementHandler.populateSelectWithSlotNames(this.originalSlots, 'keySlot');
      await handleActionSuccess('slotAction');
    } catch (err) {
      await handleActionError('slotAction');
    } finally {
      $btn.prop('disabled', false);
    }
  }
}
