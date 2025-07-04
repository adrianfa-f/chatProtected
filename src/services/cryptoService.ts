import libsodium from 'libsodium-wrappers';

// Variable global para control de inicialización
let isSodiumReady = false;

// Función de inicialización mejorada
async function initializeSodium() {
    if (!isSodiumReady) {
        await libsodium.ready;
        isSodiumReady = true;
    }
    return;
}

// Exportaciones explícitas con inicialización
export const generateKeyPair = async () => {
    await initializeSodium();
    const keypair = libsodium.crypto_box_keypair();
    return {
        publicKey: libsodium.to_base64(keypair.publicKey),
        privateKey: libsodium.to_base64(keypair.privateKey)
    };
};

export const encryptMessage = async (message: string, publicKey: string) => {
    await initializeSodium();
    const messageBytes = libsodium.from_string(message);
    const publicKeyBytes = libsodium.from_base64(publicKey);
    const encrypted = libsodium.crypto_box_seal(messageBytes, publicKeyBytes);
    return libsodium.to_base64(encrypted);
};

export const decryptMessage = async (ciphertext: string, privateKey: string) => {
    console.log("eSTOY DESENCRIPTANDO EL MENSAJE")
    await initializeSodium();
    const ciphertextBytes = libsodium.from_base64(ciphertext);
    const privateKeyBytes = libsodium.from_base64(privateKey);
    const publicKeyBytes = libsodium.crypto_scalarmult_base(privateKeyBytes);
    const decrypted = libsodium.crypto_box_seal_open(
        ciphertextBytes,
        publicKeyBytes,
        privateKeyBytes
    );
    console.log("mensaje desencriptado: ", decrypted)
    return libsodium.to_string(decrypted);
};