import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const [socketReady, setSocketReady] = useState(false);

    useEffect(() => {
        // 🔐 Espera a que haya sesión válida con ID de usuario
        if (!isAuthenticated || !user?.id) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocketReady(false);
                console.log('[SocketProvider] Socket desconectado por falta de sesión');
            }
            return;
        }

        if (socketRef.current) return; // Ya existe

        const wsServer = import.meta.env.VITE_WS_SERVER;

        console.log(`[SocketProvider] Iniciando conexión a: ${wsServer}`);

        const socket = io(wsServer, {
            transports: ['websocket'],
            path: '/socket.io/',
            query: { userId: user.id },
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            console.log('[SocketProvider] ✅ Conectado con ID:', socket.id);
            setSocketReady(true);
        });

        socket.on('disconnect', (reason) => {
            console.warn('[SocketProvider] 🔌 Desconectado:', reason);
            setSocketReady(false);
        });

        socket.on('connect_error', (err) => {
            console.error('[SocketProvider] ❌ Error de conexión:', err.message);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setSocketReady(false);
            console.log('[SocketProvider] 🧹 Socket desmontado');
        };
    }, [isAuthenticated, user?.id]);

    return (
        <SocketContext.Provider value={socketReady ? socketRef.current : null}>
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
