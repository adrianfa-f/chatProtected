export interface User {
    id: string;
    username: string;
    createdAt?: Date;
    online?: boolean; // Nuevo campo para el estado en línea
    lastSeen?: Date;  // Nuevo campo para la última vez visto
}

export type MessageStatus = 'seen' | 'delivered';

export interface Message {
    id: string;
    chatId: string;
    senderId: string;
    receiverId: string; // Este campo es necesario para el envío por WebSocket
    ciphertext: string;
    plaintext?: string;
    createdAt: Date;
    status?: MessageStatus;
    nonce?: string; // Agregar si es necesario
}

export interface Chat {
    id: string;
    user1: User;
    user2: User;
    updatedAt: Date;
    lastMessage?: string;
    lastSenderId?: string;
    unreadCount?: number;
}

export interface ChatRequest {
    id: string;
    fromUser: User;
    toUser: User;
    status: 'pending' | 'accepted' | 'rejected';
    timestamp: Date;
}

// Nuevo tipo para almacenamiento local
export interface LocalMessageStore {
    [chatId: string]: {
        [messageId: string]: string;
    };
}