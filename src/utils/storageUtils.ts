import type { Message, MessageStatus } from "../types/types";

// Funciones para localStorage (actualizadas)
export const saveMessagesToLocalStorage = (chatId: string, messages: Message[]) => {
    const key = `chat_${chatId}_messages`;
    localStorage.setItem(key, JSON.stringify(messages));
};

export const loadMessagesFromLocalStorage = (chatId: string): Message[] | null => {
    const key = `chat_${chatId}_messages`;
    const data = localStorage.getItem(key);
    if (!data) return null;

    // Convertir a objetos Date y asegurar el tipo de status
    const messages: Message[] = JSON.parse(data).map((msg: Message) => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
        status: msg.status as MessageStatus
    }));

    return messages;
};

export const sortMessagesByDate = (messages: Message[]): Message[] => {
    return [...messages].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
};

// Limpieza periódica de mensajes antiguos
export const cleanupOldChats = () => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('chat_') && key.endsWith('_messages')) {
            const data = localStorage.getItem(key);
            if (!data) return;

            try {
                const messages: Message[] = JSON.parse(data);
                const lastMessage = messages[messages.length - 1];

                if (!lastMessage) {
                    localStorage.removeItem(key);
                    return;
                }

                const lastMessageDate = new Date(lastMessage.createdAt).getTime();
                if (lastMessageDate < oneWeekAgo) {
                    localStorage.removeItem(key);
                }
            } catch (error) {
                console.error('Error cleaning up chat messages:', error);
                localStorage.removeItem(key);
            }
        }
    });
};

// Ejecutar limpieza al cargar la aplicación
cleanupOldChats();