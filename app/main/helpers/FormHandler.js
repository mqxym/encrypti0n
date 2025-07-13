/**
 * @class FormHandler
 * @classdesc
 * Provides utilities to read from and write to HTML forms, keeping an up-to-date
 * snapshot of form field values and preventing default form submission behavior.
 */
export class FormHandler {
  /**
   * Creates a FormHandler for the specified form element.
   *
   * @param {string} formId - The id attribute of the target HTML form.
   */
  constructor(formId) {
    /** @private @type {string} */
    this.formId = formId;
    /** @private @type {HTMLFormElement} */
    this.$form = document.getElementById(formId);
    /** @type {Object.<string, any>} Current values of all form fields */
    this.formValues = this.getFormValues();

    // Update formValues whenever any field changes
    this.$form.addEventListener('change', () => {
      this.formValues = this.getFormValues();
    });
  }

  /**
   * Reads all input, select, and textarea fields in the form and returns
   * an object mapping field names to their current values or checked state.
   *
   * @returns {Object.<string, string|boolean>}  
   *   A map of field names to values:
   *   - For checkboxes: boolean (checked state)
   *   - For radio groups: the value of the selected radio
   *   - Otherwise: the string value of the field
   */
  getFormValues() {
    const values = {};
    const inputs = this.$form.querySelectorAll('input, select, textarea');
    inputs.forEach((inp) => {
      const { name, type } = inp;
      if (!name) return;
      if (type === 'checkbox') {
        values[name] = inp.checked;
      } else if (type === 'radio') {
        if (inp.checked) {
          values[name] = inp.value;
        }
      } else {
        values[name] = inp.value;
      }
    });
    return values;
  }

  /**
   * Updates the form field with the given name to the specified value,
   * then refreshes the stored formValues.
   *
   * @param {string} key - The name attribute of the target field.
   * @param {string|boolean} value - The new value or checked state.
   * @returns {void}
   */
  setFormValue(key, value) {
    const inp = this.$form.querySelector(`[name="${key}"]`);
    if (!inp) return;
    if (inp.type === 'checkbox') {
      inp.checked = !!value;
    } else if (inp.type === 'radio') {
      const radios = this.$form.querySelectorAll(`[name="${key}"]`);
      radios.forEach((r) => {
        r.checked = r.value === value;
      });
    } else {
      inp.value = value;
    }
    this.formValues = this.getFormValues();
  }

  /**
   * Sets multiple form fields at once based on an object map.
   *
   * @param {Object.<string, any>} obj - Map of field names to their new values.
   * @returns {void}
   */
  setFormValues(obj) {
    for (const k in obj) {
      this.setFormValue(k, obj[k]);
    }
  }

  /**
   * Prevents the form's default submit behavior by calling preventDefault()
   * on the submit event, and returns this for chaining.
   *
   * @returns {FormHandler} The current instance (for method chaining).
   */
  preventSubmitAction() {
    this.$form.addEventListener('submit', function (e) {
      e.preventDefault();
    });
    return this;
  }
}