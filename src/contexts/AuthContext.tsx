import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginService, register as registerService } from '../services/authService';

interface User {
    id: string;
    username: string;
}

interface AuthContextType {
    user: User | null;
    privateKey: string | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [privateKey, setPrivateKey] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const isAuthenticated = !!user;

    // Inicializar desde sessionStorage
    useEffect(() => {
        const userId = sessionStorage.getItem('userId');
        const username = sessionStorage.getItem('username');

        if (userId && username) {
            const storedPrivateKey = localStorage.getItem(`privateKey-${username}`);
            setUser({ id: userId, username });
            setPrivateKey(storedPrivateKey);
        }
        setIsInitialized(true);
    }, []);

    const login = async (username: string, password: string) => {
        const data = await loginService(username, password);
        setUser(data.user);
    };

    const register = async (username: string, password: string) => {
        const data = await registerService(username, password);
        setUser(data.user);
        setPrivateKey(data.privateKey);
    };

    const logout = () => {
        // Limpiar sessionStorage
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('username');

        // Mantener clave privada para futuras sesiones
        setUser(null);
        setPrivateKey(null);
    };

    if (!isInitialized) {
        return <div>Loading...</div>;
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                privateKey,
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
export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};