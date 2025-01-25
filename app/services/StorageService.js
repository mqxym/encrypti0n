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
  
    removeItem(key) {
      localStorage.removeItem(key);
    }
  
    clearAll() {
      localStorage.clear();
    }
    deleteStoredKeys() {
      for (let i = 1; i <= 10; i++) {
        localStorage.removeItem('key' + i);
      }
    }
  
    deleteStoredHashes() {
      localStorage.removeItem('savedHashes');
    }
  
    deleteSlotNames() {
      localStorage.removeItem('slotNames');
    }
  
    deleteConfigs() {
      localStorage.removeItem('cryptoConfig');
      localStorage.removeItem('generalConfig');
    }
  
    deleteAllData() {
      this.deleteStoredKeys();
      this.deleteStoredHashes();
      this.deleteSlotNames();
      this.deleteConfigs();
      localStorage.removeItem('copyAlert');
      localStorage.removeItem('isEncrypted');
      localStorage.removeItem('pwCheck');
    }
  }