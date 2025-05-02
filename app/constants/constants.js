export const KeyManagementConstants = {
    KEY_LENGTH: 24,
    ALLOWED_CHARACTERS: "-_+.,()[]*#?=&%$§€@!%^{}|;':/<>?",
    MAX_SLOT_NAME_LENGTH: 15
};

export const UIConstants = {
    ACTION_DELAY: 1000
};

export const ConfigManagerConstants = {
    CURRENT_DATA_VERSION: 1,
    ARGON2_SALT_LENGTH: 16,
    ARGON2_ROUNDS_NO_PW: 1,
    ARGON2_ROUNDS_MIN: 20,
    ARGON2_ROUNDS_MAX: 21,
    ARGON2_MEM_DEFAULT_KEY: 2048
};

export const AppDataConstants = {
    APP_DATA_LOCK_TIMEOUT: 300
}

export const Argon2Constants = {
    MEMORY_COST: 65536, // memoryCost: memory usage in KiB
    PARALLELISM: 1,  // parallelism: degree of parallelism (controls parallel thread use)
    HASH_LEN: 32,  // hashLen: desired key length in bytes (32 bytes = 256 bits)
    KEY_LEN: 256,  // 256 bits
    ANIMATION_WAIT_MS: 150 // timeout before algorithm starts
};

export const AESGCMConstants = {
    IV_LENGTH: 12
}