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
    DEVICE_KEY_STORE
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
            const username = sessionStorage.getItem('username');
            if (!username) {
                setIsInitialized(true);
                return;
            }

            try {
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
                    id: sessionStorage.getItem('userId') || '',
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

        console.log("se guardan cosas en sessionStorage")
        // Guardar en sessionStorage
        sessionStorage.setItem('userId', data.user.id);
        sessionStorage.setItem('username', data.user.username);

        // Obtener clave derivada
        const cryptoKey = await getCryptoKey(password);
        console.log("Obtenemos la clave derivada: ", cryptoKey)

        // Descifrar clave privada
        const keyMeta = await getItem(CRYPTO_KEYS_STORE, `privateKey_${username}`);
        if (!keyMeta) throw new Error('No encrypted private key found');
        console.log("Obtenemos el objeto que contiene la clave privada encriptada: ", keyMeta)

        const decryptedKey = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: base64ToBuffer(keyMeta.iv)
            },
            cryptoKey,
            base64ToBuffer(keyMeta.encryptedKey)
        );
        console.log("Buffer de la clave privada decrypted: ", decryptedKey)

        setPrivateKey(new TextDecoder().decode(decryptedKey));

        // Inicializar StorageService
        setStorageService(new StorageService(cryptoKey));
        console.log("Actualizacion de los estados de privateKey y storeService")

        // Generar/recuperar clave de dispositivo
        let deviceKeyItem = await getItem(DEVICE_KEY_STORE, 'deviceKey');
        console.log("Tratamos de obtener la clave del dispositivo: ", deviceKeyItem)
        if (!deviceKeyItem) {
            console.log("fallamos para traer la clave del dispositivo, vamos a crearla")
            const rawKey = await generateDeviceKey();
            console.log("generamos una clave del dispositivo: ", rawKey)
            deviceKeyItem = {
                id: 'deviceKey',
                rawKey: bufferToBase64(rawKey)
            };
            console.log("creamos un objeto para guardarla: ", deviceKeyItem)
            await saveItem(DEVICE_KEY_STORE, deviceKeyItem);
            console.log("Guardamos el objeto en deviceKey en indexedDB")
        }

        // Exportar clave derivada
        const rawDerivedKey = await crypto.subtle.exportKey("raw", cryptoKey);
        console.log("exportar la clave derivada: ", rawDerivedKey)

        // Cifrar clave derivada con clave de dispositivo
        const deviceCryptoKey = await crypto.subtle.importKey(
            "raw",
            base64ToBuffer(deviceKeyItem.rawKey),
            { name: "AES-GCM" },
            false,
            ["encrypt"]
        );
        console.log("Exportacion de clave derivada como buffer: ", deviceCryptoKey)

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedDerivedKey = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            deviceCryptoKey,
            rawDerivedKey
        );
        console.log("encriptado el buffer de la clave derivada: ", encryptedDerivedKey)

        console.log("Se guarda?")
        // Guardar clave derivada cifrada
        await saveItem(ENCRYPTED_DERIVED_KEY_STORE, {
            id: `derivedKey_${username}`,
            encryptedData: bufferToBase64(encryptedDerivedKey),
            iv: bufferToBase64(iv)
        });
        console.log("creo que si")
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
                isAuthenticated
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