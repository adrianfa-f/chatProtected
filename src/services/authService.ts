import api from './api';
import { generateKeyPair } from './cryptoService';

export const login = async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });

    // Extraer datos necesarios
    const { user } = response.data.data;

    // Guardar en sessionStorage (SOLO datos esenciales)
    sessionStorage.setItem('userId', user.id);
    sessionStorage.setItem('username', user.username);

    // Recuperar clave privada si existe
    const privateKey = sessionStorage.getItem(`privateKey-${user.username}`) || '';

    return {
        user: {
            id: user.id,
            username: user.username
        },
        privateKey
    };
};

export const register = async (username: string, password: string) => {
    const { publicKey, privateKey } = await generateKeyPair();

    const response = await api.post('/auth/register', {
        username,
        password,
        publicKey
    });

    const { user } = response.data.data;

    // Guardar en sessionStorage
    sessionStorage.setItem('userId', user.id);
    sessionStorage.setItem('username', user.username);
    localStorage.setItem(`privateKey-${username}`, privateKey);

    return {
        user: {
            id: user.id,
            username: user.username
        },
        privateKey
    };
};