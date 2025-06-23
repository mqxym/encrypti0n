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
 * @returns {Promise<CryptoKey>}
 *   A promise that resolves to a non-extractable AES-GCM CryptoKey derived from the password.
 *
 * @throws {Error}
 *   If input validation fails.
 *
 * @example
 * ```js
 * const salt = crypto.getRandomValues(new Uint8Array(16));
 * const key = await deriveKey("myPassword", salt, 3);
 * // key is a CryptoKey usable with AES-GCM encrypt/decrypt operations
 * ```
 */
export async function deriveKey(
  password,
  salt,
  iterations,
  mem_cost = null
) {
  // === Password validation ===
  const isString = typeof password === 'string';
  const isBytes  = password instanceof Uint8Array;
  if (!isString && !isBytes) {
    throw new TypeError('`password` must be a string or Uint8Array');
  }
  if (isString && password.length === 0) {
    throw new RangeError('`password` string cannot be empty');
  }
  if (isBytes && password.byteLength === 0) {
    throw new RangeError('`password` Uint8Array cannot be empty');
  }


  if (!(salt instanceof Uint8Array)) {
    throw new TypeError('`salt` must be a Uint8Array');
  }
  if (salt.byteLength < 8) {
    throw new RangeError('`salt` must be at least 8 bytes');
  }

  // === Iterations / time cost validation ===
  if (!Number.isInteger(iterations)) {
    throw new TypeError('`iterations` must be an integer');
  }
  if (iterations <= 0) {
    throw new RangeError('`iterations` must be a positive integer');
  }

  // === Memory cost validation ===
  if (mem_cost !== null) {
    if (!Number.isInteger(mem_cost)) {
      throw new TypeError('`mem_cost` must be an integer or null');
    }
    if (mem_cost <= 0) {
      throw new RangeError('`mem_cost` must be a positive integer if provided');
    }
  }

  // Now run Argon2id
  const timeCost = iterations;
  const memoryCost = mem_cost ?? Argon2Constants.MEMORY_COST;

  let argon2Result = await new Promise((resolve, reject) => {
    setTimeout(
      async () => {
        try {
          const result = await argon2.hash({
            pass: password,
            salt,
            time: timeCost,
            mem: memoryCost,
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

  if (!argon2Result || !argon2Result.hash) {
    throw new Error('Argon2 failed to produce a hash');
  }

  // Import into Web Crypto API
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

  // Zero out the raw hash in memory
  argon2Result = null;

  return cryptoKey;
}

// Same as deriveKey but different use (wrap, unwrap)

export async function deriveKek(password, salt, iterations) {

  // === Password validation ===
  const isString = typeof password === 'string';
  const isBytes  = password instanceof Uint8Array;
  if (!isString && !isBytes) {
    throw new TypeError('`password` must be a string or Uint8Array');
  }
  if (isString && password.length === 0) {
    throw new RangeError('`password` string cannot be empty');
  }
  if (isBytes && password.byteLength === 0) {
    throw new RangeError('`password` Uint8Array cannot be empty');
  }


  if (!(salt instanceof Uint8Array)) {
    throw new TypeError('`salt` must be a Uint8Array');
  }
  if (salt.byteLength < 8) {
    throw new RangeError('`salt` must be at least 8 bytes');
  }

  // === Iterations / time cost validation ===
  if (!Number.isInteger(iterations)) {
    throw new TypeError('`iterations` must be an integer');
  }
  if (iterations <= 0) {
    throw new RangeError('`iterations` must be a positive integer');
  }

  const timeCost = iterations; 

  // Derive the raw key using Argon2id
  let argon2Result = await new Promise((resolve, reject) => {
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

  if (!argon2Result || !argon2Result.hash) {
    throw new Error('Argon2 failed to produce a hash');
  }

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

  argon2Result = null;
  return cryptoKey;
}