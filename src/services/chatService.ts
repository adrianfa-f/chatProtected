import api from './api';
import type { User, ChatRequest, Message, Chat } from '../types/types';



// Buscar usuarios
export const searchUsers = async (query: string): Promise<User[]> => {
    const response = await api.get(`/users/search?query=${query}`);
    return response.data;
};

// Enviar solicitud de chat
export const sendChatRequest = async (toUserId: string): Promise<ChatRequest> => {
    try {
        const response = await api.post('/chat-requests', { toUserId });
        return {
            ...response.data,
            timestamp: new Date(response.data.timestamp)
        };
    } catch (error) {
        console.error('Error sending chat request:', error);
        throw new Error('Failed to send chat request');
    }
};

// Responder a solicitud de chat
export const respondToChatRequest = async (requestId: string, accepted: boolean): Promise<ChatRequest> => {
    const response = await api.patch(`/chat-requests/${requestId}`, { status: accepted ? 'accepted' : 'rejected' });
    return response.data;
};

// Obtener chats
export const getChats = async (): Promise<Chat[]> => {
    const response = await api.get('/chats');
    return response.data;
};

// Obtener mensajes
export const getMessages = async (chatId: string): Promise<Message[]> => {
    const response = await api.get(`/messages/${chatId}`);
    return response.data;
};

// Enviar mensaje
export const sendMessage = async (chatId: string, ciphertext: string, nonce: string): Promise<Message> => {
    const response = await api.post(`/messages/${chatId}`, { ciphertext, nonce });

    return response.data;
};