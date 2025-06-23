// src/services/userService.ts
import api from './api';

const publicKeyCache = new Map<string, string>();

export const getUserPublicKey = async (userId: string): Promise<string> => {
    // Verificar caché
    if (publicKeyCache.has(userId)) {
        return publicKeyCache.get(userId)!;
    }

    try {
        const response = await api.get(`/users/${userId}/public-key`);
        const publicKey = response.data.publicKey;

        // Almacenar en caché
        publicKeyCache.set(userId, publicKey);

        return publicKey;
    } catch (error) {
        console.error('Error fetching public key:', error);
        throw new Error('Failed to get user public key');
    }
};

export const clearPublicKeyCache = () => {
    publicKeyCache.clear();
};