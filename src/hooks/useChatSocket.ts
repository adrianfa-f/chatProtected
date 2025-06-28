import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import type { Message } from '../types/types';

export const useChatSocket = () => {
    const socket = useSocket();
    const { user } = useAuth();
    const {
        addMessage,
        updateChatLastMessage,
        setUserOnlineStatus,
        loadChatMessages
    } = useChat();

    useEffect(() => {
        if (!socket || !user) return;

        const handleNewMessage = (message: Message) => {
            // Solo procesar mensajes relevantes para el usuario actual
            if (message.receiverId === user.id || message.senderId === user.id) {
                addMessage(message);
                updateChatLastMessage(message.chatId, new Date(message.createdAt));
            }
        };

        const handleUserStatus = (data: {
            userId: string;
            online: boolean;
            lastSeen?: Date;
        }) => {
            setUserOnlineStatus(data.userId, data.online, data.lastSeen);
        };

        // Nuevo handler para notificaciones push
        const handleNotification = (data: {
            chatId: string;
            messageId: string
        }) => {
            // Recargar mensajes solo si es necesario
            loadChatMessages(data.chatId);
        };

        socket.on('receive-message', handleNewMessage);
        socket.on('user-status', handleUserStatus);
        socket.on('new-message-notification', handleNotification);

        return () => {
            socket.off('receive-message', handleNewMessage);
            socket.off('user-status', handleUserStatus);
            socket.off('new-message-notification', handleNotification);
        };
    }, [socket, user, addMessage, updateChatLastMessage,
        setUserOnlineStatus, loadChatMessages]);
};