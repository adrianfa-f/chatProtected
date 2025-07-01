import { Socket } from 'socket.io-client';
import type { Message } from '../types/types';

export const joinChat = (socket: Socket | null, chatId: string) => {
    if (!socket || !socket.connected) {
        console.warn('[SocketService] Intento de unirse a chat sin socket o socket no conectado');
        return;
    }
    console.log(`[SocketService] Uniendo al chat: ${chatId}`);
    socket.emit('join-chat', chatId);
};

export const leaveChat = (socket: Socket | null, chatId: string) => {
    if (!socket || !socket.connected) {
        console.warn('[SocketService] Intento de salir de chat sin socket o socket no conectado');
        return;
    }
    console.log(`[SocketService] Saliendo del chat: ${chatId}`);
    socket.emit('leave-chat', chatId);
};

export const sendMessageSocket = (
    socket: Socket | null,
    message: Omit<Message, 'id' | 'createdAt'>
) => {
    if (!socket || !socket.connected) return false;

    console.log('[SocketService] Enviando mensaje via socket ONLY');
    try {
        socket.emit('send-message', message);
        return true;
    } catch (error) {
        console.error('[SocketService] Error al enviar mensaje:', error);
        return false;
    }
};

export const testSocketConnection = (socket: Socket | null) => {
    if (!socket) {
        console.warn('[SocketService] Socket no disponible para prueba');
        return;
    }

    console.log('[SocketService] Probando conexión de socket');
    socket.emit('test-event', { message: 'Test from client' });
};