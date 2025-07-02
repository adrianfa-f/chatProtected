import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import type { Chat, Message, ChatRequest, User } from '../types/types';
import { useCrypto } from '../hooks/useCrypto';
import { getUserPublicKey } from '../services/userService';
import { useSocket } from './SocketContext';
import { sendMessageSocket } from '../services/socketService';

// Funciones para localStorage
const saveMyMessagesToLocalStorage = (chatId: string, messages: Message[]) => {
    const key = `chat_${chatId}_messages`;

    // Filtrar solo mensajes propios
    const myMessages = messages.filter(msg => msg.senderId === (localStorage.getItem('userId') || ''));

    localStorage.setItem(key, JSON.stringify(myMessages));
};

const loadMyMessagesFromLocalStorage = (chatId: string): Message[] | null => {
    const key = `chat_${chatId}_messages`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
};

const sortMessagesByDate = (messages: Message[]): Message[] => {
    return [...messages].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
};

// Servicios necesarios
const getMessages = async (chatId: string): Promise<Message[]> => {
    const response = await api.get(`/api/messages/${chatId}`);
    return response.data.data;
};

const getChatRequests = async (): Promise<ChatRequest[]> => {
    const response = await api.get('/api/chat-requests');
    return response.data;
};

const respondToRequestService = async (requestId: string, accepted: boolean): Promise<ChatRequest> => {
    const response = await api.patch(`/api/chat-requests/${requestId}`, {
        status: accepted ? 'accepted' : 'rejected'
    });
    return response.data;
};

interface ChatContextType {
    chats: Chat[];
    activeChat: Chat | null;
    setActiveChat: (chat: Chat | null) => void;
    messages: Message[];
    chatRequests: ChatRequest[];
    searchAndRequestUser: (query: string) => Promise<User[]>;
    respondToRequest: (requestId: string, accepted: boolean) => Promise<void>;
    loadChatMessages: (chatId: string) => Promise<void>;
    sendMessage: (chatId: string, content: string) => Promise<void>;
    loadChats: () => Promise<void>;
    loadChatRequests: () => Promise<void>;
    addChatRequest: (request: ChatRequest) => void;
    // Nuevas funciones para WebSocket
    addMessage: (message: Message) => void;
    setUserOnlineStatus: (userId: string, online: boolean, lastSeen?: Date) => void;
    updateChatLastMessage: (chatId: string, timestamp: Date) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);

    const { user, privateKey } = useAuth();
    const { encryptMessage, decryptMessage, isReady: isCryptoReady } = useCrypto();

    const socket = useSocket();
    const activeChatRef = useRef(activeChat);
    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    const loadChats = useCallback(async () => {
        try {
            const response = await api.get('/api/chats/');
            setChats(response.data.data);
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }, []);

    const loadChatRequests = useCallback(async () => {
        try {
            const requests = await getChatRequests();
            setChatRequests(requests);
        } catch (error) {
            console.error('Error loading chat requests:', error);
        }
    }, []);

    // Cargar chats y solicitudes al iniciar
    useEffect(() => {
        if (user && isCryptoReady) {
            loadChats();
            loadChatRequests();
        }
    }, [user, isCryptoReady, loadChatRequests, loadChats]);

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

    const respondToRequest = useCallback(async (requestId: string, accepted: boolean) => {
        try {
            const response = await respondToRequestService(requestId, accepted);

            const updatedRequest = response;
            setChatRequests(prev => prev.map(req =>
                req.id === requestId ? {
                    ...updatedRequest,
                    status: updatedRequest.status as 'pending' | 'accepted' | 'rejected'
                } : req
            ));

            if (accepted) {
                await loadChats();
                setChatRequests(prev => prev.filter(req => req.id !== requestId));
            }
        } catch (error) {
            console.error('Error responding to chat request:', error);
            throw error;
        }
    }, [loadChats]);

    const loadChatMessages = useCallback(async (chatId: string) => {
        if (!user || !privateKey) return;

        // 1. Cargar solo mensajes propios desde localStorage
        const myMessages = loadMyMessagesFromLocalStorage(chatId) || [];

        // 2. Obtener todos los mensajes del backend
        const serverMessages = await getMessages(chatId);

        // 3. Procesar mensajes
        const processedMessages = await Promise.all(
            serverMessages.map(async (msg: Message) => {
                // Mensajes propios: usar texto plano de localStorage si está disponible
                if (msg.senderId === user.id) {
                    const localMessage = myMessages.find(m => m.ciphertext === msg.ciphertext);
                    return localMessage || msg;
                }

                // Mensajes recibidos: descifrar
                try {
                    const plaintext = await decryptMessage(msg.ciphertext, privateKey);
                    return { ...msg, plaintext };
                } catch (error) {
                    console.error('Error decrypting message', error);
                    return { ...msg, plaintext: 'No se pudo descifrar el mensaje' };
                }
            })
        );

        // 4. Ordenar y establecer en estado
        const sortedMessages = sortMessagesByDate(processedMessages);
        setMessages(sortedMessages);

    }, [user, privateKey, decryptMessage]);

    const sendMessage = useCallback(async (chatId: string, content: string) => {
        if (!user) return;

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
            plaintext: content, // Texto plano
            createdAt: new Date().toISOString()
        };

        // Guardar en el estado
        setMessages(prev => [...prev, tempMessage]);

        const existingMyMessages = loadMyMessagesFromLocalStorage(chatId) || [];
        const updatedMyMessages = [...existingMyMessages, tempMessage];
        saveMyMessagesToLocalStorage(chatId, updatedMyMessages);

        // Enviar por socket
        sendMessageSocket(socket, tempMessage);
    }, [chats, user, encryptMessage, socket]);

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
        if (!user || !privateKey) return;

        // Mensajes propios: actualizar con ID real y guardar en localStorage
        if (message.senderId === user.id) {
            // Actualizar mensaje con ID real
            setMessages(prev => {
                const updated = prev.map(msg =>
                    msg.id.startsWith('temp_') && msg.ciphertext === message.ciphertext
                        ? { ...message, plaintext: msg.plaintext }  // Mantener texto plano
                        : msg
                );

                // Guardar solo mensajes propios en localStorage
                saveMyMessagesToLocalStorage(message.chatId, updated);

                return updated;
            });
            return;
        }

        // Mensajes recibidos: descifrar y agregar al estado
        try {
            const plaintext = await decryptMessage(message.ciphertext, privateKey);
            const fullMessage = { ...message, plaintext };

            // Solo agregar al estado (no guardar en localStorage)
            setMessages(prev => {
                // Evitar duplicados
                if (prev.some(m => m.id === fullMessage.id)) return prev;
                return sortMessagesByDate([...prev, fullMessage]);
            });

            // Actualizar última actividad del chat
            updateChatLastMessage(fullMessage.chatId, new Date(fullMessage.createdAt));
        } catch (error) {
            console.error('Error processing received message:', error);
        }
    }, [user, privateKey, updateChatLastMessage, decryptMessage]);

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

    return (
        <ChatContext.Provider value={{
            chats,
            activeChat,
            setActiveChat,
            messages,
            chatRequests,
            searchAndRequestUser,
            respondToRequest,
            loadChatMessages,
            sendMessage,
            loadChats,
            loadChatRequests,
            addChatRequest,
            addMessage,
            setUserOnlineStatus,
            updateChatLastMessage
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