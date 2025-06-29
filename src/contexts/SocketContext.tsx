import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
    children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const { user, isAuthenticated, logout } = useAuth();

    useEffect(() => {
        if (!isAuthenticated || !user) {
            // Limpiar socket si no autenticado
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const wsServer = import.meta.env.VITE_WS_SERVER || 'http://localhost:4000';

        // Evitar recrear conexión si ya existe y está conectada
        if (socket && socket.connected) return;

        console.log(`[SocketProvider] Conectando a: ${wsServer}`);

        // Obtener token actualizado
        const accessToken = localStorage.getItem('accessToken');

        const newSocket = io(wsServer, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket'],
            auth: {
                token: accessToken
            }
        });

        // Eventos para depuración
        newSocket.on('connect', () => {
            console.log('[SocketProvider] Socket conectado:', newSocket.id);
            // Autenticar al usuario con el servidor
            newSocket.emit('authenticate', accessToken);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[SocketProvider] Socket desconectado:', reason);
        });

        newSocket.on('error', (error) => {
            console.error('[SocketProvider] Error de socket:', error);
        });

        newSocket.on('connect_error', (err) => {
            console.error('[SocketProvider] Error de conexión:', err.message);
        });

        newSocket.on('invalid-token', () => {
            console.log('[SocketProvider] Token inválido - forzar logout');
            logout();
        });

        // Actualizar token en reconexiones
        newSocket.on('reconnect_attempt', () => {
            const token = localStorage.getItem('accessToken');
            if (token) {
                newSocket.auth = { token };
            }
        });

        // Registrar todos los eventos entrantes para depuración
        newSocket.onAny((event, ...args) => {
            console.log(`[SocketProvider] Evento recibido: ${event}`, args);
        });

        setSocket(newSocket);

        return () => {
            console.log('[SocketProvider] Desconectando socket');
            newSocket.disconnect();
        };
    }, [user, isAuthenticated, logout, socket]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

/* eslint-disable-next-line react-refresh/only-export-components */
export const useSocket = () => {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};