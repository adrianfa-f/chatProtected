import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import type { Chat, Message, ChatRequest, User } from '../types/types';
import { useCrypto } from '../hooks/useCrypto';
import { getUserPublicKey } from '../services/userService';
import { useSocket } from './SocketContext';
import { sendMessageSocket } from '../services/socketService';


// Funciones para localStorage
const saveMessagesToLocalStorage = (chatId: string, messages: Message[]) => {
    const key = `chat_${chatId}_messages`;
    localStorage.setItem(key, JSON.stringify(messages));
};

const loadMessagesFromLocalStorage = (chatId: string): Message[] | null => {
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

const sendMessageService = async (data: {
    chatId: string;
    receiverId: string;
    ciphertext: string;
    userId: string;
}): Promise<Message> => {
    const response = await api.post('/api/messages', {
        ...data,
        nonce: null
    });
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
    return response.data; // Asegurarse de devolver solo response.data
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

            // 1. Extraer la solicitud actualizada de la respuesta
            const updatedRequest = response;

            // 2. Actualizar estado de las solicitudes
            setChatRequests(prev => prev.map(req =>
                req.id === requestId ? {
                    ...updatedRequest,
                    status: updatedRequest.status as 'pending' | 'accepted' | 'rejected'
                } : req
            ));

            // 3. Si se aceptó, recargar chats y eliminar solicitud aceptada
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

        // 1. Cargar mensajes desde localStorage
        const cachedMessages = loadMessagesFromLocalStorage(chatId) || [];
        setMessages(cachedMessages);

        try {
            // 2. Obtener mensajes del servidor
            const response = await getMessages(chatId);
            const serverMessages = response;

            // 3. Procesar solo mensajes nuevos (no en caché)
            const newMessages = serverMessages.filter(serverMsg =>
                !cachedMessages.some(cachedMsg => cachedMsg.id === serverMsg.id)
            );

            const processedNewMessages = await Promise.all(
                newMessages.map(async (msg: Message) => {
                    // Mensajes propios: dejar plaintext como está
                    if (msg.senderId === user.id) {
                        return msg;
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

            // 4. Combinar con caché
            const allMessages = [...cachedMessages, ...processedNewMessages];

            // 5. Ordenar y guardar
            const sortedMessages = sortMessagesByDate(allMessages);
            setMessages(sortedMessages);
            saveMessagesToLocalStorage(chatId, sortedMessages);

        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }, [user, privateKey, decryptMessage]);

    const sendMessage = useCallback(async (chatId: string, content: string) => {
        if (!user) return;

        try {
            const chat = chats.find(c => c.id === chatId);
            if (!chat) throw new Error('Chat not found');

            const recipientId = chat.user1.id === user.id ? chat.user2.id : chat.user1.id;

            const publicKey = await getUserPublicKey(recipientId);
            const ciphertext = await encryptMessage(content, publicKey);

            const tempMessage: Message = {
                id: `temp_${Date.now()}`,
                chatId,
                senderId: user.id,
                receiverId: recipientId,
                ciphertext,
                plaintext: content,
                createdAt: new Date(),
                status: 'sending'
            };

            setMessages(prev => {
                const updated = [...prev, tempMessage];
                saveMessagesToLocalStorage(chatId, updated);
                return sortMessagesByDate(updated);
            });

            // 🔄 Emitir por WebSocket
            const socketMessage = {
                chatId,
                senderId: user.id,
                receiverId: recipientId,
                ciphertext,
            };
            const socketOk = sendMessageSocket(socket, socketMessage);
            if (!socketOk) {
                console.warn('[ChatContext] No se pudo emitir el mensaje por WebSocket');
            }

            // 💾 Persistir en backend
            const response = await sendMessageService({
                chatId,
                receiverId: recipientId,
                ciphertext,
                userId: user.id
            });

            const sentMessage = response;

            setMessages(prev => {
                const updated = prev.map(msg => {
                    if (msg.id === tempMessage.id) {
                        return {
                            ...sentMessage,
                            plaintext: content,
                            status: 'sent' as const
                        };
                    }
                    return msg;
                });

                saveMessagesToLocalStorage(chatId, updated);
                return sortMessagesByDate(updated);
            });

        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => {
                const updated = prev.map(msg =>
                    msg.id.startsWith('temp_') ? { ...msg, status: 'failed' as const } : msg
                );
                saveMessagesToLocalStorage(chatId, updated);
                return updated;
            });
        }
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

        // Ignorar mensajes propios
        if (message.senderId === user.id) {
            console.log('[ChatContext] Ignorando mensaje propio');
            return;
        }

        console.log('[ChatContext] Mensaje recibido para chat:', message.chatId);

        let processedMessage = message;

        try {
            const plaintext = await decryptMessage(message.ciphertext, privateKey);
            processedMessage = { ...message, plaintext };
        } catch (error) {
            console.error(error)
            processedMessage = { ...message, plaintext: '❌ Error al descifrar' };
        }

        // GUARDAR SIEMPRE EN LOCALSTORAGE (sin depender de activeChat)
        const cachedMessages = loadMessagesFromLocalStorage(processedMessage.chatId) || [];
        const updatedMessages = [...cachedMessages, processedMessage];
        saveMessagesToLocalStorage(processedMessage.chatId, updatedMessages);

        // Solo actualizar estado si es el chat activo
        const currentActiveChat = activeChatRef.current;
        if (currentActiveChat && currentActiveChat.id === processedMessage.chatId) {
            setMessages(prev => {
                // Evitar duplicados
                if (prev.some(m => m.id === processedMessage.id)) return prev;

                const newMessages = [...prev, processedMessage];
                return sortMessagesByDate(newMessages);
            });
        }

        updateChatLastMessage(processedMessage.chatId, new Date(processedMessage.createdAt));
    }, [user, privateKey, decryptMessage, updateChatLastMessage]);

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
            // Nuevas funciones para WebSocket
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