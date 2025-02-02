/**
 * KeyDerivationManager
 *
 * Derives a non-extractable AES-GCM key via PBKDF2.
 */
export class KeyDerivationManager {
    /**
     * @param {string} password - The user-supplied or default password
     * @param {Uint8Array} saltBytes - Raw salt
     * @param {number} iterations - PBKDF2 iteration count
     * @returns {Promise<CryptoKey>} Non-extractable AES-GCM key
     */
    async deriveKey(password, saltBytes, iterations) {
      const encoder = new TextEncoder();
  
      // 1. Import the raw password
      const baseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
  
      // 2. Derive a 256-bit AES-GCM key (non-extractable)
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations,
          hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,            // non-extractable
        ['encrypt', 'decrypt']
      );
    }
  }