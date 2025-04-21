import { Argon2Constants } from "../../constants/constants.js";

/**
 * Derives a non-extractable AES-GCM key via argon2.
 * @param {string} password - The user-supplied or default password
 * @param {Uint8Array} saltBytes - Raw salt
 * @param {number} iterations - argon2 iteration count
 * @returns {Promise<CryptoKey>} Non-extractable AES-GCM key
 */
export async function deriveKey(password, salt, iterations) {

  const timeCost = iterations; 

  // Derive the raw key using Argon2id
  const argon2Result = await new Promise((resolve, reject) => {
    setTimeout(
      async () => {
        try {
          const result = await argon2.hash({
            pass: password,
            salt: salt,
            time: timeCost,
            mem: Argon2Constants.MEMORY_COST,
            hashLen: Argon2Constants.HASH_LEN,
            parallelism: Argon2Constants.PARALLELISM,
            type: argon2.ArgonType.Argon2id,
          });
          resolve(result);
        } catch (err) {
          reject(err);
        }
      },
      timeCost === 10 ? 0 : 150 // Timeout for every action accept default local encryption (10 rounds) for animation load
    );
  });

  // Import the raw key into a CryptoKey object for AES-GCM.
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    argon2Result.hash,
    {
      name: 'AES-GCM',
      length: Argon2Constants.KEY_LEN,
    },
    false,
    ['encrypt', 'decrypt']
  );

  return cryptoKey;
}
