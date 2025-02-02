/**
 * Handles localStorage-based operations
 */
export class StorageService {
    getItem(key) {
      const value = localStorage.getItem(key);
      return value !== null ? value : null;
    }
  
    setItem(key, value) {
      localStorage.setItem(key, value);
    }

    getConf() {
      return JSON.parse(this.getItem('encMainConf'));
    }

    setConf(value) {
      localStorage.setItem('encMainConf', JSON.stringify(value));
    }

    deleteAllData() {
      localStorage.removeItem('encMainConf');
    }
  }