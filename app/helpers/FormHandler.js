/**
 * Manages reading/writing to a given HTML form
 */
export class FormHandler {
    constructor(formId) {
      this.formId = formId;
      this.$form = document.getElementById(formId);
      this.formValues = this.getFormValues();
  
      // bind changes
      this.$form.addEventListener('change', () => {
        this.formValues = this.getFormValues();
      });
    }
  
    getFormValues() {
      const values = {};
      const inputs = this.$form.querySelectorAll('input, select, textarea');
      inputs.forEach(inp => {
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
  
    setFormValue(key, value) {
      const inp = this.$form.querySelector(`[name="${key}"]`);
      if (!inp) return;
      if (inp.type === 'checkbox') {
        inp.checked = !!value;
      } else if (inp.type === 'radio') {
        const radios = this.$form.querySelectorAll(`[name="${key}"]`);
        radios.forEach(r => {
          r.checked = (r.value === value);
        });
      } else {
        inp.value = value;
      }
      this.formValues = this.getFormValues();
    }
  
    setFormValues(obj) {
      for (const k in obj) {
        this.setFormValue(k, obj[k]);
      }
    }
  }