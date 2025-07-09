import api from './api';
import { generateKeyPair } from './cryptoService';
import { encryptPrivateKey } from './cryptoService';
import { saveItem } from '../utils/db';

export const login = async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    const { user } = response.data.data;

    sessionStorage.setItem('userId', user.id);
    sessionStorage.setItem('username', user.username);

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

    sessionStorage.setItem('userId', user.id);
    sessionStorage.setItem('username', user.username);

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