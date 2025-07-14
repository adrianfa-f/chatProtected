import React, {
    createContext,
    useContext,
    useState,
    useEffect
} from 'react';
import {
    login as loginService,
    register as registerService
} from '../services/authService';
import {
    getCryptoKey,
} from '../services/cryptoService';
import {
    getItem,
    saveItem,
    deleteItem,
    CRYPTO_KEYS_STORE,
    ENCRYPTED_DERIVED_KEY_STORE,
    DEVICE_KEY_STORE,
    SESSION_STORE
} from '../utils/db';
import {
    bufferToBase64,
    base64ToBuffer
} from '../utils/encodingUtils';
import { StorageService } from '../services/storageService';
import type { User } from '../types/types';

interface AuthContextType {
    user: User | null;
    privateKey: string | null;
    storageService: StorageService | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({
    children
}: {
    children: React.ReactNode;
}) => {
    const [user, setUser] = useState<User | null>(null);
    const [privateKey, setPrivateKey] = useState<string | null>(null);
    const [storageService, setStorageService] = useState<StorageService | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const isAuthenticated = !!user;

    useEffect(() => {
        const initialize = async () => {
            const sessionData = await getItem(SESSION_STORE, 'current_user');
            if (!sessionData?.username) {
                setIsInitialized(true);
                return;
            }

            try {
                const username = sessionData.username;
                // 1. Obtener clave de dispositivo
                const deviceKeyItem = await getItem(DEVICE_KEY_STORE, 'deviceKey');
                if (!deviceKeyItem) return;

                // 2. Obtener clave derivada cifrada
                const encryptedKeyItem = await getItem(
                    ENCRYPTED_DERIVED_KEY_STORE,
                    `derivedKey_${username}`
                );
                if (!encryptedKeyItem) return;

                // 3. Descifrar clave derivada
                const deviceCryptoKey = await crypto.subtle.importKey(
                    "raw",
                    base64ToBuffer(deviceKeyItem.rawKey),
                    { name: "AES-GCM" },
                    false,
                    ["decrypt"]
                );

                const decryptedDerivedKey = await crypto.subtle.decrypt(
                    {
                        name: "AES-GCM",
                        iv: base64ToBuffer(encryptedKeyItem.iv)
                    },
                    deviceCryptoKey,
                    base64ToBuffer(encryptedKeyItem.encryptedData)
                );

                // 4. Importar clave derivada
                const derivedCryptoKey = await crypto.subtle.importKey(
                    "raw",
                    decryptedDerivedKey,
                    { name: "AES-GCM" },
                    false,
                    ["encrypt", "decrypt"]
                );

                // 5. Descifrar clave privada
                const keyMeta = await getItem(
                    CRYPTO_KEYS_STORE,
                    `privateKey_${username}`
                );
                if (!keyMeta) throw new Error('No encrypted private key found');

                const decryptedPrivateKey = await crypto.subtle.decrypt(
                    {
                        name: "AES-GCM",
                        iv: base64ToBuffer(keyMeta.iv)
                    },
                    derivedCryptoKey,
                    base64ToBuffer(keyMeta.encryptedKey)
                );

                setPrivateKey(new TextDecoder().decode(decryptedPrivateKey));

                // 6. Inicializar storage
                setStorageService(new StorageService(derivedCryptoKey));

                // 7. Establecer usuario
                setUser({
                    id: sessionData.userId,
                    username
                });

            } catch (error) {
                console.error('Error restoring session:', error);
            } finally {
                setIsInitialized(true);
            }
        };

        initialize();
    }, []);

    const generateDeviceKey = async (): Promise<ArrayBuffer> => {
        const key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
        return crypto.subtle.exportKey("raw", key);
    };

    const login = async (username: string, password: string): Promise<void> => {
        const data = await loginService(username, password);
        setUser(data.user);

        // Guardar en sessionStorage
        await saveItem(SESSION_STORE, {
            id: 'current_user',
            userId: data.user.id,
            username: data.user.username
        });

        // Obtener clave derivada
        const cryptoKey = await getCryptoKey(password);

        // Descifrar clave privada
        const keyMeta = await getItem(CRYPTO_KEYS_STORE, `privateKey_${username}`);
        if (!keyMeta) throw new Error('No encrypted private key found');

        const decryptedKey = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: base64ToBuffer(keyMeta.iv)
            },
            cryptoKey,
            base64ToBuffer(keyMeta.encryptedKey)
        );

        setPrivateKey(new TextDecoder().decode(decryptedKey));

        // Inicializar StorageService
        setStorageService(new StorageService(cryptoKey));

        // Generar/recuperar clave de dispositivo
        let deviceKeyItem = await getItem(DEVICE_KEY_STORE, 'deviceKey');
        if (!deviceKeyItem) {
            const rawKey = await generateDeviceKey();
            deviceKeyItem = {
                id: 'deviceKey',
                rawKey: bufferToBase64(rawKey)
            };
            await saveItem(DEVICE_KEY_STORE, deviceKeyItem);
        }

        // Exportar clave derivada
        const rawDerivedKey = await crypto.subtle.exportKey("raw", cryptoKey);

        // Cifrar clave derivada con clave de dispositivo
        const deviceCryptoKey = await crypto.subtle.importKey(
            "raw",
            base64ToBuffer(deviceKeyItem.rawKey),
            { name: "AES-GCM" },
            false,
            ["encrypt"]
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedDerivedKey = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            deviceCryptoKey,
            rawDerivedKey
        );

        // Guardar clave derivada cifrada
        await saveItem(ENCRYPTED_DERIVED_KEY_STORE, {
            id: `derivedKey_${username}`,
            encryptedData: bufferToBase64(encryptedDerivedKey),
            iv: bufferToBase64(iv)
        });
    };

    const register = async (username: string, password: string): Promise<void> => {
        const data = await registerService(username, password);
        setUser(data.user);

        // Guardar en sessionStorage
        sessionStorage.setItem('userId', data.user.id);
        sessionStorage.setItem('username', data.user.username);

        // Cifrar y guardar clave privada
        const cryptoKey = await getCryptoKey(password);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedKey = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            cryptoKey,
            new TextEncoder().encode(data.privateKey)
        );

        await saveItem(CRYPTO_KEYS_STORE, {
            id: `privateKey_${username}`,
            encryptedKey: bufferToBase64(encryptedKey),
            iv: bufferToBase64(iv)
        });

        setPrivateKey(data.privateKey);

        // Inicializar StorageService
        setStorageService(new StorageService(cryptoKey));

        // Generar clave de dispositivo
        const rawKey = await generateDeviceKey();
        await saveItem(DEVICE_KEY_STORE, {
            id: 'deviceKey',
            rawKey: bufferToBase64(rawKey)
        });

        // Exportar clave derivada
        const rawDerivedKey = await crypto.subtle.exportKey("raw", cryptoKey);

        // Cifrar clave derivada con clave de dispositivo
        const deviceCryptoKey = await crypto.subtle.importKey(
            "raw",
            rawKey,
            { name: "AES-GCM" },
            false,
            ["encrypt"]
        );

        const derivedIv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedDerivedKey = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: derivedIv },
            deviceCryptoKey,
            rawDerivedKey
        );

        // Guardar clave derivada cifrada
        await saveItem(ENCRYPTED_DERIVED_KEY_STORE, {
            id: `derivedKey_${username}`,
            encryptedData: bufferToBase64(encryptedDerivedKey),
            iv: bufferToBase64(derivedIv)
        });
    };

    const logout = (): void => {
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('username');

        if (user) {
            // Eliminar clave derivada cifrada
            deleteItem(ENCRYPTED_DERIVED_KEY_STORE, `derivedKey_${user.username}`);
        }

        setUser(null);
        setPrivateKey(null);
        setStorageService(null);
    };

    if (!isInitialized) {
        return <div>Loading...</div>;
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                privateKey,
                storageService,
                login,
                register,
                logout,
                isAuthenticated,
                isInitialized
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

/* eslint-disable-next-line react-refresh/only-export-components */
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};