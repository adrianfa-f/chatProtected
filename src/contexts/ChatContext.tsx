import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import type { Chat, Message, ChatRequest, User } from '../types/types';
import { useCrypto } from '../hooks/useCrypto';
import { getUserPublicKey } from '../services/userService';

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

    const activeChatRef = useRef(activeChat);
    const messagesRef = useRef(messages);

    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

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

        const cachedMessages = loadMessagesFromLocalStorage(chatId) || [];
        setMessages(cachedMessages);

        try {
            const response = await getMessages(chatId);
            const serverMessages = response;

            const newMessages = serverMessages.filter(serverMsg =>
                !cachedMessages.some(cachedMsg => cachedMsg.id === serverMsg.id)
            );

            const processedNewMessages = await Promise.all(
                newMessages.map(async (msg: Message) => {
                    if (msg.senderId === user.id) {
                        return msg;
                    }

                    try {
                        const plaintext = await decryptMessage(msg.ciphertext, privateKey);
                        return { ...msg, plaintext };
                    } catch (error) {
                        console.error('Error decrypting message', error);
                        return { ...msg, plaintext: 'No se pudo descifrar el mensaje' };
                    }
                })
            );

            const allMessages = [...cachedMessages, ...processedNewMessages];
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
                createdAt: new Date().toISOString(),
            };

            setMessages(prev => {
                const updated = [...prev, tempMessage];
                saveMessagesToLocalStorage(chatId, updated);
                return sortMessagesByDate(updated);
            });

            // SOLO ENVIAR POR HTTP (eliminado WebSocket)
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
                        };
                    }
                    return msg;
                });

                saveMessagesToLocalStorage(chatId, updated);
                return sortMessagesByDate(updated);
            });

        } catch (error) {
            console.error('Error sending message:', error);
        }
    }, [chats, user, encryptMessage]); // Eliminada dependencia de socket

    const updateChatLastMessage = useCallback((chatId: string, timestamp: Date) => {
        setChats(prevChats =>
            prevChats.map(chat =>
                chat.id === chatId ? { ...chat, updatedAt: timestamp } : chat
            )
        );
    }, []);

    const addMessage = useCallback(async (message: Message) => {
        if (!user || !privateKey) return;

        // Verificar si el mensaje ya existe
        if (messagesRef.current.some(m => m.id === message.id)) {
            console.log('[ChatContext] Mensaje duplicado ignorado', message.id);
            return;
        }

        // Ignorar mensajes propios
        if (message.senderId === user.id) {
            console.log('[ChatContext] Ignorando mensaje propio');
            return;
        }

        let processedMessage = message;

        try {
            const plaintext = await decryptMessage(message.ciphertext, privateKey);
            processedMessage = { ...message, plaintext };
        } catch (error) {
            console.error(error)
            processedMessage = { ...message, plaintext: '❌ Error al descifrar' };
        }

        const cachedMessages = loadMessagesFromLocalStorage(processedMessage.chatId) || [];
        const updatedMessages = [...cachedMessages, processedMessage];
        saveMessagesToLocalStorage(processedMessage.chatId, updatedMessages);

        const currentActiveChat = activeChatRef.current;
        if (currentActiveChat && currentActiveChat.id === processedMessage.chatId) {
            setMessages(prev => {
                if (prev.some(m => m.id === processedMessage.id)) return prev;
                const newMessages = [...prev, processedMessage];
                return sortMessagesByDate(newMessages);
            });
        }

        updateChatLastMessage(processedMessage.chatId, new Date(processedMessage.createdAt));
    }, [user, privateKey, decryptMessage, updateChatLastMessage]);

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