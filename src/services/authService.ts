import api from './api';
import { generateKeyPair } from './cryptoService';
import { encryptPrivateKey } from './cryptoService';
import { saveItem, SESSION_STORE } from '../utils/db';

export const login = async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    const { user } = response.data.data;

    await saveItem(SESSION_STORE, {
        id: 'current_user',
        userId: user.id,
        username: user.username
    });

    return {
        user: {
            id: user.id,
            username: user.username
        }
    };
};

export const register = async (username: string, password: string) => {
    const { publicKey, privateKey } = await generateKeyPair();

    const response = await api.post('/api/auth/register', {
        username,
        password,
        publicKey
    });

    const { user } = response.data.data;

    await saveItem(SESSION_STORE, {
        id: 'current_user',
        userId: user.id,
        username: user.username
    });

    // Guardar clave privada cifrada
    const encrypted = await encryptPrivateKey(privateKey, password);
    await saveItem('crypto_keys', {
        id: `privateKey_${username}`,
        encryptedKey: encrypted.encryptedKey,
        iv: encrypted.iv
    });

    return {
        user: {
            id: user.id,
            username: user.username
        },
        privateKey
    };
};