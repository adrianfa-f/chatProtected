import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useChat } from '../contexts/ChatContext';
import type { ChatRequest, MediaFile, Message } from '../types/types';
import { useAuth } from '../contexts/AuthContext';

export const useChatSocket = () => {
    const socket = useSocket();
    const { addMessage, setUserOnlineStatus, addChatRequest, loadChats, setChatRequests, setChats, activeChat, addMediaFile } = useChat();
    const { logout, user } = useAuth();

    useEffect(() => {
        if (!socket) return;

        const handleNewRequest = (request: ChatRequest) => {
            addChatRequest(request);
        };

        const handleNewChatCreated = () => {
            console.log('[Socket] Nuevo chat creado, recargando lista de chats');
            loadChats();
        };

        const handleChatRejected = (requestId: string) => {
            console.log('[Socket] Solicitud rechazada:', requestId);
            setChatRequests(prev => prev.map(req =>
                req.id === requestId ? { ...req, status: 'rejected' } : req
            ));
        };

        const handleChatAccepted = () => {
            console.log('[Socket] Chat aceptado por este usuario, recargando lista');
            loadChats();
        };

        const handleReceiveMessage = (message: Message) => {
            if (!socket?.connected || !user) return;
            if (message.senderId === user.id) {
                console.log('[Socket] Ignorando mensaje emitido por uno mismo');
                return;
            }
            console.log('[useChatSocket] Mensaje recibido', message);
            addMessage(message);
        };

        const handleNewMessageNotification = (data: {
            chatId: string;
            senderId: string;
            messageId: string;
        }) => {
            console.log('[Socket] Notificación de nuevo mensaje recibida', data);

            // Mostrar notificación local solo si la app no está enfocada
            if (document.visibilityState !== 'visible') {
                // Mostrar notificación local como respaldo
                new Notification('Nuevo mensaje', {
                    body: 'Tienes un nuevo mensaje',
                    icon: '/icon-192x192.png',
                    data: { chatId: data.chatId }
                });
            }
        };

        const handleChatMessageSummary = (data: {
            chatId: string;
            senderId: string;
            ciphertext: string;
        }) => {
            const { chatId, senderId, ciphertext } = data;

            setChats(prevChats =>
                prevChats.map(chat =>
                    chat.id === chatId
                        ? {
                            ...chat,
                            lastMessage: ciphertext,
                            lastSenderId: senderId,
                            unreadCount:
                                senderId !== user?.id
                                    ? (chat.unreadCount || 0) + 1
                                    : chat.unreadCount || 0
                        }
                        : chat
                )
            );
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

        const handleAuthenticated = () => {
            console.log('[useChatSocket] Socket autenticado');
        };

        const handleInvalidToken = () => {
            console.log('[useChatSocket] Token inválido - forzar logout');
            /* logout(); */
        };

        const handleReceiveMedia = (media: MediaFile) => {
            console.log('[useChatSocket] Archivo multimedia recibido', media);
            addMediaFile(media);
        };

        const handleReceiveLink = (link: MediaFile) => {
            console.log('[useChatSocket] Enlace recibido', link);
            addMediaFile(link);
        };

        const handleNewMediaNotification = (data: {
            chatId: string;
            senderId: string;
            mediaId: string;
        }) => {
            // Mostrar notificación si no estamos en ese chat
            if (activeChat?.id !== data.chatId) {
                // Implementar lógica de notificación
                console.log('Nuevo archivo multimedia recibido en otro chat');
            }
        };

        socket.on('receive-message', handleReceiveMessage);
        socket.on('user-status', handleUserStatus);
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('error', handleError);
        socket.on('authenticated', handleAuthenticated);
        socket.on('invalid-token', handleInvalidToken);
        socket.on('receive-chat-request', handleNewRequest);
        socket.on('new-chat-created', handleNewChatCreated);
        socket.on('chat-request-rejected', handleChatRejected);
        socket.on('chat-accepted', handleChatAccepted);
        socket.on('chat-message-summary', handleChatMessageSummary);
        socket.on('new-message-notification', handleNewMessageNotification);
        socket.on('receive-media', handleReceiveMedia);
        socket.on('receive-link', handleReceiveLink);
        socket.on('new-media-notification', handleNewMediaNotification);

        // Registrar todos los eventos para depuración
        socket.onAny((event, ...args) => {
            console.log(`[useChatSocket] Evento recibido: ${event}`, args);
        });

        return () => {
            socket.off('receive-message', handleReceiveMessage);
            socket.off('user-status', handleUserStatus);
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('error', handleError);
            socket.off('authenticated', handleAuthenticated);
            socket.off('invalid-token', handleInvalidToken);
            socket.off('receive-chat-request', handleNewRequest);
            socket.off('new-chat-created', handleNewChatCreated);
            socket.off('chat-request-rejected', handleChatRejected);
            socket.off('chat-accepted', handleChatAccepted);
            socket.off('chat-message-summary', handleChatMessageSummary);
            socket.off('new-message-notification', handleNewMessageNotification);
            socket.off('receive-media', handleReceiveMedia);
            socket.off('receive-link', handleReceiveLink);
            socket.off('new-media-notification', handleNewMediaNotification);
            socket.offAny();
        };
    }, [
        socket,
        addMessage,
        setUserOnlineStatus,
        logout,
        user,
        addChatRequest,
        loadChats,
        setChatRequests,
        setChats,
        activeChat,
        addMediaFile
    ]);
};