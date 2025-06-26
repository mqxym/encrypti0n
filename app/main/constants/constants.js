/**
 * @namespace KeyManagementConstants
 * @description
 * Constants for key generation and slot naming constraints.
 * @property {number} KEY_LENGTH - Length of generated keys in characters.
 * @property {string} ALLOWED_CHARACTERS - Allowed characters in generated keys.
 * @property {number} MAX_SLOT_NAME_LENGTH - Maximum length for slot names.
 */
export const KeyManagementConstants = {
    KEY_LENGTH: 24,
    ALLOWED_CHARACTERS: "-_+.,()[]*#?=&%$§€@!%^{}|;':/<>?",
    MAX_SLOT_NAME_LENGTH: 15
};

/**
 * @namespace UIConstants
 * @description
 * Constants for UI behavior timing.
 * @property {number} ACTION_DELAY - Delay in milliseconds for button feedback actions.
 */
export const UIConstants = {
    ACTION_DELAY: 1000
};

/**
 * @namespace EncryptionServiceConstants
 * @description
 * Configuration parameters for EncryptionService.
 * 
 * @property {number} LOW_ITERATION_COUNT - Low iteration count for Argon2id key derivation.
 * @property {number} MIDDLE_ITERATION_COUNT - Medium iteration count for Argon2id key derivation.
 * @property {number} HIGH_ITERATION_COUNT - High iteration count for Argon2id key derivation.
 * 
 * @property {number} LOW_SALT_LENGTH_BYTES - Salt length in bytes for Argon2id.
 * @property {number} HIGH_SALT_LENGTH_BYTES - Salt length in bytes for Argon2id.
 * 
 * @property {number} CURRENT_DATA_VERSION - Marks version of the encryption data format (algorithm/schema changes).
 * @property {number} START_BYTE - Identifier or flag byte to mark the beginning of encrypted data.
 */
export const EncryptionServiceConstants = {
    LOW_ITERATION_COUNT: 5,
    MIDDLE_ITERATION_COUNT: 20,
    HIGH_ITERATION_COUNT: 40,
    LOW_SALT_LENGTH_BYTES: 12,
    HIGH_SALT_LENGTH_BYTES: 16,
    CURRENT_DATA_VERSION: 0b000, // 0-7 for 7 different schemas in the future
    START_BYTE: 0x01
};


/**
 * @namespace ConfigManagerConstants
 * @description
 * Configuration parameters for application encryption management.
 * @property {number} CURRENT_DATA_VERSION - Schema version of stored configuration.
 * @property {number} ARGON2_SALT_LENGTH - Length in bytes of Argon2 salt.
 * @property {number} ARGON2_ROUNDS_NO_PW - Argon2 rounds when no master password is used (v1, obsolete).
 * @property {number} ARGON2_ROUNDS_MIN - Minimum Argon2 rounds for master password.
 * @property {number} ARGON2_ROUNDS_MAX - Maximum Argon2 rounds for master password.
 * @property {number} ARGON2_MEM_DEFAULT_KEY - Argon2 memory cost (KiB) for default key derivation (v1, obsolete).
 */
export const ConfigManagerConstants = {
    CURRENT_DATA_VERSION: 2,
    ARGON2_SALT_LENGTH: 16,
    ARGON2_ROUNDS_NO_PW: 1,
    ARGON2_ROUNDS_MIN: 20,
    ARGON2_ROUNDS_MAX: 21,
    ARGON2_MEM_DEFAULT_KEY: 2048
};

/**
 * @namespace AppDataConstants
 * @description
 * Constants related to application data lock settings.
 * @property {number} APP_DATA_LOCK_TIMEOUT - Inactivity timeout in seconds before app lock.
 * @property {number} READ_FILE_TIMEOUT - Timeout in miliseconds before stopping file reading.
 * @property {number} EXPORT_PROCESS_TIMEOUT - Timeout in miliseconds before stopping export process
 * @property {number} IMPORT_PROCESS_TIMEOUT - Timeout in miliseconds before stopping export process
 */
export const AppDataConstants = {
    APP_DATA_LOCK_TIMEOUT: 300,
    READ_FILE_TIMEOUT: 15000,
    EXPORT_PROCESS_TIMEOUT: 40000,
    IMPORT_PROCESS_TIMEOUT: 40000,
};

/**
 * @namespace Argon2Constants
 * @description
 * Parameters for Argon2 key derivation.
 * @property {number} MEMORY_COST - Memory usage in KiB.
 * @property {number} PARALLELISM - Degree of parallelism for hashing.
 * @property {number} HASH_LEN - Desired hash length in bytes.
 * @property {number} KEY_LEN - Length in bits of imported AES-GCM key.
 * @property {number} ANIMATION_WAIT_MS - Delay in milliseconds before Argon2 starts (UI animation).
 */
export const Argon2Constants = {
    MEMORY_COST: 65536, // memoryCost: memory usage in KiB
    PARALLELISM: 1,     // parallelism: degree of parallelism
    HASH_LEN: 32,       // hashLen: key length in bytes (256 bits)
    KEY_LEN: 256,       // 256 bits
    ANIMATION_WAIT_MS: 150 // UI animation delay before hashing
};

/**
 * @namespace AESGCMConstants
 * @description
 * Constants for AES-GCM encryption parameters.
 * @property {number} IV_LENGTH - Length in bytes of the AES-GCM initialization vector.
 */
export const AESGCMConstants = {
    IV_LENGTH: 12
};


/**
 * @namespace AESGCMConstants
 * @description
 * Constants for data encoding
 * @property {Uint8Array} OBFUSCATION_VALUE - A static value used for XOR data obfuscation for export / import
 */
export const EncodeConstants = {
    OBFUSCATION_VALUE: new TextEncoder().encode('https://encrypti0n.com/index.html?user=mqxym&password=11myx11'),
    OBFUSCATION_VALUE_OUTER: new TextEncoder().encode('zOekjqqmK:{4Q?wTka!9qO1hb_x.]*_,_[O6F$>RCa?WBC=LniO,VP_V|Z+tes2m')
}