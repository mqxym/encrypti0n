import { Argon2Constants } from "../../constants/constants.js";

/**
 * Derives a non-extractable AES-GCM CryptoKey from a password using Argon2id.
 *
 * @async
 * @function deriveKey
 * @param {string|Uint8Array} password
 *   The user-supplied password or raw key material.  
 *   If provided as a Uint8Array, it will be interpreted as UTF-8 bytes.
 * @param {Uint8Array} salt
 *   The random salt bytes to use for key derivation.  
 *   Must be at least Argon2Constants.SALT_LEN bytes long.
 * @param {number} iterations
 *   The Argon2 time cost (number of iterations) to use when hashing.
 * @param {number} [mem_cost=null]
 *   Optional Argon2 memory cost in kibibytes.  
 *   If omitted or null, defaults to `Argon2Constants.MEMORY_COST`.  
 *   Must be an integer when provided.
 * @returns {Promise<CryptoKey>}
 *   A promise that resolves to a non-extractable AES-GCM CryptoKey derived from the password.
 *
 * @throws {Error}
 *   If `mem_cost` is provided but is not an integer.
 *   If the Argon2 hashing operation fails.
 *
 * @example
 * ```js
 * const salt = crypto.getRandomValues(new Uint8Array(16));
 * const key = await deriveKey("myPassword", salt, 3);
 * // key is a CryptoKey usable with AES-GCM encrypt/decrypt operations
 * ```
 */
export async function deriveKey(password, salt, iterations, mem_cost = null) {
  if (mem_cost !== null && !Number.isInteger(mem_cost)) {
    throw new Error('mem_cost must be an integer');
  }

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
            mem: mem_cost ?? Argon2Constants.MEMORY_COST,
            hashLen: Argon2Constants.HASH_LEN,
            parallelism: Argon2Constants.PARALLELISM,
            type: argon2.ArgonType.Argon2id,
          });
          resolve(result);
        } catch (err) {
          reject(err);
        }
      },
      timeCost === 1 ? 0 : Argon2Constants.ANIMATION_WAIT_MS
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

  argon2Result.hash = null;

  return cryptoKey;
}

export async function deriveKek(password, salt, iterations) {

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
      timeCost === Argon2Constants.ANIMATION_WAIT_MS
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
    ['wrapKey', 'unwrapKey']
  );

  argon2Result.hash = null;
  return cryptoKey;
}