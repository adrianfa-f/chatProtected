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
        if (!isAuthenticated || !user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const wsServer = import.meta.env.VITE_WS_SERVER;

        if (socket && socket.connected) return;

        console.log(`[SocketProvider] Conectando a: ${wsServer}`);

        const newSocket = io(wsServer, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket'],
            upgrade: false,
            path: '/socket.io/',
            query: {
                userId: user.id
            }
        });

        newSocket.on('connect', () => {
            console.log('[SocketProvider] Socket conectado');
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[SocketProvider] Socket desconectado:', reason);
        });

        newSocket.on('connect_error', (err) => {
            console.error('[SocketProvider] Error de conexión:', err.message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user, isAuthenticated, socket]);

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