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
        setUserOnlineStatus
    } = useChat();

    useEffect(() => {
        if (!socket || !user) return;

        // Manejar nuevos mensajes recibidos
        const handleNewMessage = (message: Message) => {
            // Solo procesar si el mensaje es para este usuario
            if (message.receiverId === user.id || message.senderId === user.id) {
                addMessage(message);
                updateChatLastMessage(message.chatId, new Date(message.createdAt));
            }
        };

        // Manejar cambios de estado de usuarios
        const handleUserStatus = (data: {
            userId: string;
            online: boolean;
            lastSeen?: Date;
        }) => {
            setUserOnlineStatus(data.userId, data.online, data.lastSeen);
        };

        // Escuchar eventos del socket
        socket.on('receive-message', handleNewMessage);
        socket.on('user-status', handleUserStatus);

        return () => {
            socket.off('receive-message', handleNewMessage);
            socket.off('user-status', handleUserStatus);
        };
    }, [socket, user, addMessage, updateChatLastMessage, setUserOnlineStatus]);
};