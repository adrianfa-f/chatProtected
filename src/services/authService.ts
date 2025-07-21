import api from './api';
import { generateKeyPair } from './cryptoService';
import { encryptPrivateKey } from './cryptoService';
import { saveItem, SESSION_STORE } from '../utils/db';
import { urlBase64ToUint8Array } from '../utils/encodingUtils';

export const registerPushNotifications = async (userId: string) => {
    if (!('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') return;

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
        });

        // Enviar suscripción al backend
        try {
            const response = await api.post('/api/users/subscribe', { subscription, userId });
            if (response.status !== 200) {
                throw new Error('Error al registrar suscripción');
            }
            console.log('Suscripción registrada correctamente');
        } catch (error) {
            console.error('Error registrando suscripción:', error);
            // Implementar lógica de reintento
        }
    } catch (error) {
        console.error('Error registrando notificaciones:', error);
    }
};

export const login = async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    const { user } = response.data.data;

    await saveItem(SESSION_STORE, {
        id: 'current_user',
        userId: user.id,
        username: user.username
    });

    if (user && user.id) {
        await registerPushNotifications(user.id);
    }

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

    if (user && user.id) {
        await registerPushNotifications(user.id);
    }

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