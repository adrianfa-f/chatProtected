import libsodium from 'libsodium-wrappers';
import { deriveKey, encryptData, decryptData } from '../utils/cryptoUtils';
import { saveItem, getItem, CRYPTO_KEYS_STORE } from '../utils/db';

const CRYPTO_KEY_ID = 'derived_key_meta';
const SALT_STORAGE_KEY = 'crypto_salt';

let isSodiumReady = false;

async function initializeSodium(): Promise<void> {
    if (!isSodiumReady) {
        await libsodium.ready;
        isSodiumReady = true;
    }
}

// Generación de par de claves Asimétricas
export const generateKeyPair = async () => {
    await initializeSodium();
    const keypair = libsodium.crypto_box_keypair();
    return {
        publicKey: libsodium.to_base64(keypair.publicKey),
        privateKey: libsodium.to_base64(keypair.privateKey)
    };
};

// Encriptar texto con clave pública
export const encryptMessage = async (
    message: string,
    publicKey: string
): Promise<string> => {
    await initializeSodium();
    const msgBytes = libsodium.from_string(message);
    const pubBytes = libsodium.from_base64(publicKey);
    const sealed = libsodium.crypto_box_seal(msgBytes, pubBytes);
    return libsodium.to_base64(sealed);
};

// Desencriptar texto con clave privada
export const decryptMessage = async (
    ciphertext: string,
    privateKey: string
): Promise<string> => {
    await initializeSodium();
    const ctBytes = libsodium.from_base64(ciphertext);
    const pkBytes = libsodium.from_base64(privateKey);
    const pubBytes = libsodium.crypto_scalarmult_base(pkBytes);
    const opened = libsodium.crypto_box_seal_open(ctBytes, pubBytes, pkBytes);
    return libsodium.to_string(opened);
};

// Recuperar clave simétrica derivada con contraseña
export const getCryptoKey = async (password: string): Promise<CryptoKey> => {
    const keyMeta = await getItem(CRYPTO_KEYS_STORE, CRYPTO_KEY_ID);
    if (!keyMeta) {
        throw new Error('No hay clave criptográfica configurada');
    }
    return deriveKey(password, keyMeta.salt);
};

// Setup inicial de la clave derivada y guardado de su metadata
export const setupCryptoKey = async (password: string): Promise<CryptoKey> => {
    let salt = localStorage.getItem(SALT_STORAGE_KEY);
    if (!salt) {
        salt = crypto.randomUUID();
        localStorage.setItem(SALT_STORAGE_KEY, salt);
    }

    const key = await deriveKey(password, salt);

    await saveItem(CRYPTO_KEYS_STORE, {
        id: CRYPTO_KEY_ID,
        salt,
        algorithm: 'AES-GCM',
        derivedAt: new Date().toISOString()
    });

    return key;
};

// Encriptar clave privada con la clave derivada
export const encryptPrivateKey = async (
    privateKey: string,
    password: string
): Promise<{ encryptedKey: string; iv: string }> => {
    const key = await setupCryptoKey(password);
    const encrypted = await encryptData(key, privateKey);
    return { encryptedKey: encrypted.data, iv: encrypted.iv };
};

// Desencriptar clave privada
export const decryptPrivateKey = async (
    encryptedKey: string,
    iv: string,
    password: string
): Promise<string> => {
    const key = await getCryptoKey(password);
    return decryptData(key, encryptedKey, iv);
};
