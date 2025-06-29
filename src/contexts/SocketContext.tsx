import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
    children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const { user, isAuthenticated } = useAuth();

    useEffect(() => {
        if (!isAuthenticated || !user) return;

        const wsServer = import.meta.env.VITE_WS_SERVER || 'http://localhost:4000';
        console.log(`[SocketProvider] Conectando a: ${wsServer}`);

        const newSocket = io(wsServer, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket'],
            query: { userId: user.id }
        });

        // Eventos para depuración
        newSocket.on('connect', () => {
            console.log('[SocketProvider] Socket conectado:', newSocket.id);
            // Autenticar al usuario con el servidor
            newSocket.emit('authenticate', user.id);
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

        // Registrar todos los eventos entrantes para depuración
        newSocket.onAny((event, ...args) => {
            console.log(`[SocketProvider] Evento recibido: ${event}`, args);
        });

        setSocket(newSocket);

        return () => {
            console.log('[SocketProvider] Desconectando socket');
            newSocket.disconnect();
        };
    }, [user, isAuthenticated]);

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