import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import type { Message } from '../types/types';

export const useChatSocket = () => {
    const socket = useSocket();
    const { user } = useAuth();
    const {
        addMessage,
        updateChatLastMessage,
        setUserOnlineStatus
    } = useChat();

    useEffect(() => {
        if (!socket) {
            console.log('[useChatSocket] Socket no disponible');
            return;
        }

        if (!user) {
            console.log('[useChatSocket] Usuario no autenticado');
            return;
        }

        console.log('[useChatSocket] Configurando listeners de WebSocket');

        const handleNewMessage = (message: Message) => {
            console.log('[useChatSocket] Nuevo mensaje recibido via socket:', {
                id: message.id,
                chatId: message.chatId,
                senderId: message.senderId,
                receiverId: message.receiverId
            });

            if (message.receiverId === user.id || message.senderId === user.id) {
                console.log('[useChatSocket] Mensaje es para el usuario actual. Añadiendo al contexto.');
                addMessage(message);
                updateChatLastMessage(message.chatId, new Date(message.createdAt));
            } else {
                console.log('[useChatSocket] Mensaje no es para el usuario actual. Ignorando.');
            }
        };

        const handleUserStatus = (data: {
            userId: string;
            online: boolean;
            lastSeen?: Date;
        }) => {
            console.log(`[useChatSocket] Actualización de estado: ${data.userId} -> ${data.online ? 'online' : 'offline'}`);
            setUserOnlineStatus(data.userId, data.online, data.lastSeen);
        };

        const handleConnect = () => {
            console.log('[useChatSocket] Conectado al servidor WebSocket');
        };

        const handleDisconnect = (reason: string) => {
            console.log(`[useChatSocket] Desconectado del servidor: ${reason}`);
        };

        const handleConnectError = (err: Error) => {
            console.error('[useChatSocket] Error de conexión:', err);
        };

        socket.on('receive-message', handleNewMessage);
        socket.on('user-status', handleUserStatus);
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        return () => {
            console.log('[useChatSocket] Limpiando listeners de WebSocket');
            socket.off('receive-message', handleNewMessage);
            socket.off('user-status', handleUserStatus);
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect_error', handleConnectError);
        };
    }, [socket, user, addMessage, updateChatLastMessage, setUserOnlineStatus]);
};