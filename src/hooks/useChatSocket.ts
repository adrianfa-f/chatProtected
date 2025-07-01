import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import type { Message } from '../types/types';

export const useChatSocket = () => {
    const socket = useSocket();
    const { addMessage, setUserOnlineStatus } = useChat();
    const { logout } = useAuth();

    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (message: Message) => {
            console.log('[useChatSocket] Mensaje recibido', message);
            addMessage(message);
        };

        const handleUserStatus = (data: {
            userId: string;
            online: boolean;
            lastSeen?: Date
        }) => {
            console.log('[useChatSocket] Actualizando estado de usuario:', data);
            setUserOnlineStatus(data.userId, data.online, data.lastSeen);
        };

        const handleConnect = () => console.log('[useChatSocket] Socket conectado');
        const handleDisconnect = () => console.log('[useChatSocket] Socket desconectado');
        const handleError = (error: string) => console.error('[useChatSocket] Error de socket:', error);
        const handleAuthenticated = () => console.log('[useChatSocket] Socket autenticado');
        const handleInvalidToken = () => {
            console.log('[useChatSocket] Token inválido - forzar logout');
            logout();
        };

        socket.on('receive-message', handleReceiveMessage);
        socket.on('user-status', handleUserStatus);
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('error', handleError);
        socket.on('authenticated', handleAuthenticated);
        socket.on('invalid-token', handleInvalidToken);

        return () => {
            socket.off('receive-message', handleReceiveMessage);
            socket.off('user-status', handleUserStatus);
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('error', handleError);
            socket.off('authenticated', handleAuthenticated);
            socket.off('invalid-token', handleInvalidToken);
        };
    }, [socket, addMessage, setUserOnlineStatus, logout]);
};