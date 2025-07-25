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

export const sendChatRequestSocket = (socket: Socket | null, toUserId: string) => {
    if (!socket?.connected) return false;
    socket.emit('send-chat-request', toUserId);
    return true;
};


export const sendMessageSocket = (
    socket: Socket | null,
    message: Omit<Message, 'id'>
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

export const handleWebRTCOffer = (
    socket: Socket,
    callback: (data: { from: string; offer: RTCSessionDescription }) => void
) => {
    socket.on('webrtc-offer', callback);
};

export const handleWebRTCAnswer = (
    socket: Socket,
    callback: (data: { answer: RTCSessionDescription }) => void
) => {
    socket.on('webrtc-answer', callback);
};

export const handleWebRTCICECandidate = (
    socket: Socket,
    callback: (data: { candidate: RTCIceCandidate }) => void
) => {
    socket.on('webrtc-ice-candidate', callback);
};