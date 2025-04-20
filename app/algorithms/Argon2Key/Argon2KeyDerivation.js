/**
 * Derives a non-extractable AES-GCM key via argon2.
 * @param {string} password - The user-supplied or default password
 * @param {Uint8Array} saltBytes - Raw salt
 * @param {number} iterations - argon2 iteration count
 * @returns {Promise<CryptoKey>} Non-extractable AES-GCM key
 */
export async function deriveKey(password, salt, iterations) {
  // Argon2 parameters:
  // - timeCost: the number of iterations
  // - memoryCost: memory usage in KiB
  // - parallelism: degree of parallelism (controls parallel thread use)
  // - hashLen: desired key length in bytes (32 bytes = 256 bits)
  const timeCost = iterations; // You can adjust for increased security.
  const memoryCost = 2048; // Memory in KiB
  const parallelism = 1; // Parallelism factor
  const hashLen = 32; // 32 bytes (256 bits) for the AES key

  // Derive the raw key using Argon2 (using the Argon2id variant for security)
  const argon2Result = await new Promise((resolve, reject) => {
    setTimeout(
      async () => {
        try {
          const result = await argon2.hash({
            pass: password,
            salt: salt,
            time: timeCost,
            mem: memoryCost,
            hashLen: hashLen,
            parallelism: parallelism,
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
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );

  return cryptoKey;
}
