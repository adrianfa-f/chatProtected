import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import type { Chat, Message, ChatRequest, User } from '../types/types';
import { useCrypto } from '../hooks/useCrypto';
import { getUserPublicKey } from '../services/userService';
import { useSocket } from './SocketContext';
import { sendMessageSocket } from '../services/socketService';

interface ChatContextType {
    chats: Chat[];
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    activeChat: Chat | null;
    setActiveChat: (chat: Chat | null) => void;
    messages: Message[];
    chatRequests: ChatRequest[];
    searchAndRequestUser: (query: string) => Promise<User[]>;
    loadChatMessages: (chatId: string) => Promise<void>;
    sendMessage: (chatId: string, content: string) => Promise<void>;
    loadChats: () => Promise<void>;
    loadChatRequests: () => Promise<void>;
    addChatRequest: (request: ChatRequest) => void;
    addMessage: (message: Message) => void;
    setUserOnlineStatus: (userId: string, online: boolean, lastSeen?: Date) => void;
    updateChatLastMessage: (chatId: string, timestamp: Date) => void;
    setChatRequests: React.Dispatch<React.SetStateAction<ChatRequest[]>>;
    getLastMessagePreview: (chatId: string) => Promise<string>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);

    const { user, privateKey, storageService } = useAuth();
    const { encryptMessage, decryptMessage, isReady: isCryptoReady } = useCrypto();

    const socket = useSocket();
    const activeChatRef = useRef(activeChat);
    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    const loadChats = useCallback(async () => {
        try {
            const response = await api.get('/api/chats/');
            console.log("Respuesta de tus chats: ", response)
            setChats(response.data.data);
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }, []);

    const loadChatRequests = useCallback(async () => {
        try {
            const response = await api.get('/api/chat-requests');
            setChatRequests(response.data);
        } catch (error) {
            console.error('Error loading chat requests:', error);
        }
    }, []);

    // Cargar chats y solicitudes al iniciar
    useEffect(() => {
        if (user && isCryptoReady && storageService) {
            loadChats();
            loadChatRequests();
        }
    }, [user, isCryptoReady, loadChatRequests, loadChats, storageService]);

    const addChatRequest = useCallback((request: ChatRequest) => {
        setChatRequests(prev => [...prev, request]);
    }, []);

    const searchAndRequestUser = useCallback(async (query: string): Promise<User[]> => {
        try {
            const response = await api.get(`/api/users/search?query=${query}`);
            return response.data;
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }, []);

    const loadChatMessages = useCallback(async (chatId: string) => {
        if (!user || !privateKey || !storageService) return;

        // 1. Cargar tus mensajes locales
        const myMessages = await storageService.loadMessages(chatId) || [];

        // 2. Obtener todos los mensajes del backend
        const serverMessages = await api.get(`/api/messages/${chatId}`).then(res => res.data.data);
        console.log("todos los mensajes obtenidos del backend", serverMessages)

        // 3. Procesar todos los mensajes
        const processedMessages = await Promise.all(
            serverMessages.map(async (msg: Message) => {
                // Si el mensaje es propio, usar la versión local si existe
                if (msg.senderId === user.id) {
                    const localMessage = myMessages.find((m: Message) => m.ciphertext === msg.ciphertext);
                    return localMessage || msg;
                }

                // Si es ajeno, desencriptarlo
                try {
                    const plaintext = await decryptMessage(msg.ciphertext, privateKey);
                    return { ...msg, plaintext };
                } catch (error) {
                    console.error('Error al desencriptar mensaje:', error);
                    return { ...msg, plaintext: 'No se pudo descifrar el mensaje' };
                }
            })
        );

        // 4. Actualizar solo el status en mensajes propios
        const updatedLocalMessages = myMessages.map((local: Message) => {
            const match = serverMessages.find(
                (msg: Message) => msg.senderId === user.id && msg.ciphertext === local.ciphertext
            );

            if (match && match.status && local.status !== match.status) {
                return { ...local, status: match.status };
            }

            return local;
        });

        // 5. Establecer en estado y guardar solo los mensajes propios actualizados
        const sortedMessages = [...processedMessages].sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        setMessages(sortedMessages);

        // Guardar mensajes actualizados
        await storageService.saveMessages(chatId, updatedLocalMessages);
    }, [user, privateKey, storageService, decryptMessage]);

    const sendMessage = useCallback(async (chatId: string, content: string) => {
        if (!user || !storageService) return;

        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;

        const recipientId = chat.user1.id === user.id ? chat.user2.id : chat.user1.id;
        const publicKey = await getUserPublicKey(recipientId);
        const ciphertext = await encryptMessage(content, publicKey);

        // Crear mensaje temporal
        const tempMessage: Message = {
            id: `temp_${Date.now()}`,
            chatId,
            senderId: user.id,
            receiverId: recipientId,
            ciphertext,
            plaintext: content,
            createdAt: new Date(),
            status: 'delivered'
        };

        // Guardar en el estado
        setMessages(prev => [...prev, tempMessage]);

        // Guardar en el almacenamiento seguro
        await storageService.saveMessages(chatId, [tempMessage]);

        // Enviar por socket
        sendMessageSocket(socket, tempMessage);
    }, [chats, user, encryptMessage, socket, storageService]);

    // Función para actualizar la última actividad de un chat
    const updateChatLastMessage = useCallback((chatId: string, timestamp: Date) => {
        setChats(prevChats =>
            prevChats.map(chat =>
                chat.id === chatId ? { ...chat, updatedAt: timestamp } : chat
            )
        );
    }, []);

    // Función para agregar un mensaje recibido por WebSocket
    const addMessage = useCallback(async (message: Message) => {
        if (!user || !privateKey || !storageService) return;

        // Mensajes propios: actualizar con ID real y guardar en storage
        if (message.senderId === user.id) {
            setMessages(prev => {
                const updated = prev.map(msg =>
                    msg.id.startsWith('temp_') && msg.ciphertext === message.ciphertext
                        ? { ...message, plaintext: msg.plaintext }  // Mantener texto plano
                        : msg
                );

                // Guardar solo mensajes propios en storage
                const myMessages = updated.filter(msg => msg.senderId === user.id);
                storageService.saveMessages(message.chatId, myMessages).catch(console.error);

                return updated;
            });
            return;
        }

        // Mensajes recibidos: descifrar y agregar al estado
        try {
            const plaintext = await decryptMessage(message.ciphertext, privateKey);
            const fullMessage = { ...message, plaintext };

            // Solo agregar al estado (no guardar en storage porque no es nuestro)
            setMessages(prev => {
                // Evitar duplicados
                if (prev.some(m => m.id === fullMessage.id)) return prev;
                return [...prev, fullMessage].sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
            });

            // Actualizar última actividad del chat
            updateChatLastMessage(fullMessage.chatId, new Date(fullMessage.createdAt));
        } catch (error) {
            console.error('Error processing received message:', error);
        }
    }, [user, privateKey, storageService, updateChatLastMessage, decryptMessage]);

    // Función para actualizar el estado de un usuario (online/offline)
    const setUserOnlineStatus = useCallback((userId: string, online: boolean, lastSeen?: Date) => {
        setChats(prevChats =>
            prevChats.map(chat => {
                if (chat.user1.id === userId) {
                    return {
                        ...chat,
                        user1: {
                            ...chat.user1,
                            online,
                            lastSeen: lastSeen || chat.user1.lastSeen
                        }
                    };
                } else if (chat.user2.id === userId) {
                    return {
                        ...chat,
                        user2: {
                            ...chat.user2,
                            online,
                            lastSeen: lastSeen || chat.user2.lastSeen
                        }
                    };
                }
                return chat;
            })
        );
    }, []);

    // Función para obtener el último mensaje (usada en la lista de chats)
    const getLastMessagePreview = useCallback(async (chatId: string): Promise<string> => {
        if (!storageService) return '';

        try {
            const lastMessage = await storageService.getLastMessage(chatId);
            return lastMessage || '';
        } catch (error) {
            console.error('Error getting last message:', error);
            return '';
        }
    }, [storageService]);

    // Limpieza periódica de mensajes antiguos
    /* useEffect(() => {
        if (!storageService) return;

        const cleanupInterval = setInterval(() => {
            storageService.cleanupOldChats().catch(console.error);
        }, 24 * 60 * 60 * 1000); // Diariamente

        return () => clearInterval(cleanupInterval);
    }, [storageService]); */

    return (
        <ChatContext.Provider value={{
            chats,
            setChats,
            activeChat,
            setActiveChat,
            messages,
            chatRequests,
            searchAndRequestUser,
            loadChatMessages,
            sendMessage,
            loadChats,
            loadChatRequests,
            addChatRequest,
            addMessage,
            setUserOnlineStatus,
            updateChatLastMessage,
            setChatRequests,
            getLastMessagePreview
        }}>
            {children}
        </ChatContext.Provider>
    );
};

/* eslint-disable-next-line react-refresh/only-export-components */
export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};