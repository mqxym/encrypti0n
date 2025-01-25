/**
 * Manages master password encryption of the *application's local data*.
 * (Encrypting your localStorage data with a master password, if desired.)
 *
 * For example, toggling "encrypt all saved data" => re-encrypts or decrypts
 * the stored items in localStorage. 
 */
import { StorageService } from './StorageService.js';
import { EncryptionService } from './EncryptionService.js';

export class ApplicationEncryptionManager {
  constructor() {
    this.GKEY = "dcZ5TT74oLyZun0yywszpdD8rNzIyjYPZIVBGmGrobMuGj4rULoNVahjMFyE7A5NTROIZmNsmLi4UATSoQaD2nJE7LTOB";
    this.COOLKEY = "Don't decrypt this, please.";
    this.NICEKEY = "If you have a better way securing this, message me.";

    this.isEncrypted = false;
    this.masterPasswordEncryptedKey = null; // e.g. stores hashed master password

    this.storageService = new StorageService();
    this.encryptionService = new EncryptionService();
  }

  checkIfEncrypted() {
    this.isEncrypted = !!this.storageService.getItem("isEncrypted");
    return this.isEncrypted;
  }

  /**
   * Example: sets up the master password -> encrypt local storage
   */
  async encryptApplication(newMasterPassword, oldMasterPassword) {
    // Implementation to re-encrypt all local data from old -> new.
    // (This is a large conceptual example; in practice you’d re-derive keys, etc.)
    const checkSum = await this.hashPassword(newMasterPassword, "low"); 
    this.storageService.setItem("pwCheck", checkSum);
    this.isEncrypted = true;
    this.storageService.setItem("isEncrypted", "true");
    // store hashed master password in memory (not recommended for real production)
    this.masterPasswordEncryptedKey = btoa(newMasterPassword);

    // re-encrypt local data, e.g. saved keys, saved hashes, etc.
    this._decryptAndEncryptLocalData(newMasterPassword, oldMasterPassword);
  }

  async decryptApplication(masterPasswordCandidate) {
    // check if candidate is correct
    const storedCheckSum = this.storageService.getItem("pwCheck");
    const hashedCandidate = await this.hashPassword(masterPasswordCandidate, "low");
    if (storedCheckSum !== hashedCandidate) {
      throw new Error("Master password is invalid!");
    }
    // If valid, store in memory
    this.masterPasswordEncryptedKey = btoa(masterPasswordCandidate);
    return true;
  }

  removeApplicationEncryption(masterPassword) {
    // remove encryption from local data, revert to default
    this._decryptAndEncryptLocalData(false, masterPassword);
    this.storageService.removeItem("pwCheck");
    this.storageService.removeItem("isEncrypted");
    this.isEncrypted = false;
    this.masterPasswordEncryptedKey = null;
  }

  /**
   * In your original code, you had a big method: decryptAndEncryptLocalData(newPw, oldPw)
   * This is the conceptual placeholder for that. 
   */
  _decryptAndEncryptLocalData(newPw, oldPw) {
    // e.g. read each localStorage slot, decrypt it using oldPw, re-encrypt with newPw
    // The details are up to your logic. 
    // This is just a big placeholder.
    console.log("Re-encrypting local data from old => new master password, or toggling to default...");
  }

  /**
   * Example hashing (like hashPassword) for master password checks
   */
  async hashPassword(password, difficultyLevel) {
    // E.g. do a quick or slow PBKDF2 for the checksum
    const encoder = new TextEncoder();
    const salt = encoder.encode("someFixedSaltString");
    let iterations = 1000;
    if (difficultyLevel === "low") iterations = 1000;
    if (difficultyLevel === "medium") iterations = 10000;
    if (difficultyLevel === "high") iterations = 50000;

    const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']);
    const derivedBits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    }, baseKey, 256);

    // convert derivedBits to hex for a quick checksum
    const arr = new Uint8Array(derivedBits);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}