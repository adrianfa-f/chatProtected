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
    encryptPrivateKey
} from '../services/cryptoService';
import { getItem, saveItem, CRYPTO_KEYS_STORE } from '../utils/db';
import { decryptData } from '../utils/cryptoUtils';
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
    const [storageService, setStorageService] =
        useState<StorageService | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const isAuthenticated = !!user;

    useEffect(() => {
        const userId = sessionStorage.getItem('userId');
        const username = sessionStorage.getItem('username');
        if (userId && username) {
            setUser({ id: userId, username });
        }
        setIsInitialized(true);
    }, []);

    const initializeStorage = async (
        password: string
    ): Promise<StorageService> => {
        const cryptoKey = await getCryptoKey(password);
        return new StorageService(cryptoKey);
    };

    const login = async (
        username: string,
        password: string
    ): Promise<void> => {
        const data = await loginService(username, password);
        setUser(data.user);

        // Descifra clave privada
        const keyMeta = await getItem(
            CRYPTO_KEYS_STORE,
            `privateKey_${username}`
        );
        if (!keyMeta) throw new Error('No encrypted private key found');

        const cryptoKey = await getCryptoKey(password);
        const decryptedKey = await decryptData(
            cryptoKey,
            keyMeta.encryptedKey,
            keyMeta.iv
        );
        setPrivateKey(decryptedKey);

        // Inicializa StorageService
        const storage = await initializeStorage(password);
        setStorageService(storage);
    };

    const register = async (
        username: string,
        password: string
    ): Promise<void> => {
        const data = await registerService(username, password);
        setUser(data.user);

        // Cifra y guarda clave privada
        const { encryptedKey, iv } = await encryptPrivateKey(
            data.privateKey,
            password
        );
        await saveItem(CRYPTO_KEYS_STORE, {
            id: `privateKey_${username}`,
            encryptedKey,
            iv
        });
        setPrivateKey(data.privateKey);

        // Inicializa StorageService
        const storage = await initializeStorage(password);
        setStorageService(storage);
    };

    const logout = (): void => {
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('username');
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
