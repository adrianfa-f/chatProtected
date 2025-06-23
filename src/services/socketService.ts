import { Socket } from 'socket.io-client';
import type { Message } from '../types/types';

export const joinChat = (socket: Socket | null, chatId: string) => {
    socket?.emit('join-chat', chatId);
};

export const leaveChat = (socket: Socket | null, chatId: string) => {
    socket?.emit('leave-chat', chatId);
};

export const sendMessageSocket = (
    socket: Socket | null,
    message: Omit<Message, 'id' | 'createdAt'>
) => {
    socket?.emit('send-message', message);
};