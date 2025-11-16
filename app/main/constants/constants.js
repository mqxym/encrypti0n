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
 * @namespace FileOpsConstants
 * @description
 * Default value for stream encryption file size limit
 * @property {number} STREAM_ENCRYPTION_MIN_SIZE
 */
export const FileOpsConstants = {
    STREAM_ENCRYPTION_MIN_SIZE: 1024 * 1024 * 150,
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
    ARGON2_MEM_DEFAULT_KEY: 2048,
    LS_KEY_NAME: "encMainConf",
    IDB_DB_NAME: "ENC_APP_KEYS",
    IDB_STORE_NAME: "keys",
    IDB_KEY_ID: "deviceKey"
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
 * @namespace EncodeConstants
 * @description
 * Constants for data encoding
 * @property {Uint8Array} OBFUSCATION_VALUE - A static value used for XOR data obfuscation for export / import
 */
export const EncodeConstants = {
    OBFUSCATION_VALUE: new TextEncoder().encode('https://encrypti0n.com/index.html?user=mqxym&password=11myx11'),
    OBFUSCATION_VALUE_OUTER: new TextEncoder().encode('zOekjqqmK:{4Q?wTka!9qO1hb_x.]*_,_[O6F$>RCa?WBC=LniO,VP_V|Z+tes2m')
}