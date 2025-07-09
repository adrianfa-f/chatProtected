import { bufferToBase64, base64ToBuffer } from './encodingUtils';

export const deriveKey = async (password: string, salt: string): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const importedKey = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256',
        },
        importedKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
};

export const encryptData = async (key: CryptoKey, data: string): Promise<{ iv: string; data: string }> => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedData
    );

    return {
        iv: bufferToBase64(iv),
        data: bufferToBase64(encrypted)
    };
};

export const decryptData = async (key: CryptoKey, encryptedData: string, iv: string): Promise<string> => {
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBuffer(iv) },
        key,
        base64ToBuffer(encryptedData)
    );

    return new TextDecoder().decode(decrypted);
};