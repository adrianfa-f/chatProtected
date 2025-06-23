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

        // Usar import.meta.env en lugar de process.env
        const wsServer = import.meta.env.VITE_WS_SERVER || 'http://localhost:4000';

        const newSocket = io(wsServer, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket'],
            query: {
                userId: user.id
            }
        });

        // Autenticar al usuario con el servidor
        newSocket.emit('authenticate', user.id);
        setSocket(newSocket);

        return () => {
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