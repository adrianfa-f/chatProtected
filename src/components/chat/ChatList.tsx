// src/components/ChatList.tsx

import { FaCircle } from 'react-icons/fa';
import { useEffect, useState } from 'react';
import type { Chat } from '../../types/types';
import { useAuth } from '../../contexts/AuthContext';
import { decryptMessage } from '../../services/cryptoService';

interface ChatListProps {
    chats: Chat[];
    onSelectChat: (chat: Chat) => void;
}

interface ProcessedChat extends Chat {
    lastMessageContent?: string;
}

const ChatList = ({ chats, onSelectChat }: ChatListProps) => {
    const { user, privateKey, storageService } = useAuth();
    const [processedChats, setProcessedChats] = useState<ProcessedChat[]>([]);

    const formatChatDate = (date: Date): string => {
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
        const diffInHours = Math.floor(diffInMinutes / 60);

        if (diffInMinutes < 5) return 'Ahora';
        if (diffInHours < 24)
            return date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        if (diffInHours < 48) return 'Ayer';
        return date.toLocaleDateString([], {
            day: '2-digit',
            month: '2-digit'
        });
    };

    useEffect(() => {
        const preprocess = async () => {
            if (!user) {
                setProcessedChats([]);
                return;
            }

            const updated = await Promise.all(
                chats.map(async (chat): Promise<ProcessedChat> => {
                    let content = '';

                    // Si no hay mensaje, devolvemos vacío
                    if (!chat.lastMessage) {
                        return { ...chat, lastMessageContent: '' };
                    }

                    // Si el último mensaje lo enviaste tú, lee desde IndexedDB (simétrico)
                    if (chat.lastSenderId === user.id && storageService) {
                        try {
                            const own = await storageService.getLastMessage(chat.id);
                            content = own ?? '';
                        } catch {
                            content = '';
                        }
                    }
                    // Si es de otro usuario, descífralo asimétricamente
                    else if (chat.lastSenderId !== user.id && privateKey) {
                        try {
                            content = await decryptMessage(
                                chat.lastMessage,
                                privateKey
                            );
                        } catch {
                            content = '🔒 Mensaje cifrado';
                        }
                    }
                    // Fallback: si no hay clave o servicio, muestra raw
                    else {
                        content = chat.lastMessage;
                    }

                    return { ...chat, lastMessageContent: content };
                })
            );

            setProcessedChats(updated);
        };

        preprocess();
    }, [chats, user, privateKey, storageService]);

    if (!user) {
        return (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <p className="mb-3 font-medium">
                    Inicia sesión para ver tus chats
                </p>
            </div>
        );
    }

    if (processedChats.length === 0) {
        return (
            <div className="p-8 text-center">
                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl max-w-md mx-auto">
                    <p className="text-gray-600 dark:text-gray-300 mb-3 font-medium">
                        No tienes chats activos
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Inicia una nueva conversación con el botón +
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2 px-1">
            {processedChats.map((chat) => {
                const other = chat.user1.id === user.id ? chat.user2 : chat.user1;
                const isOnline = other.online;

                return (
                    <div
                        key={chat.id}
                        onClick={() => onSelectChat(chat)}
                        className="p-3 flex items-center cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                    >
                        <div className="relative mr-3">
                            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold shadow-md">
                                {other.username.charAt(0).toUpperCase()}
                            </div>
                            {isOnline && (
                                <div className="absolute bottom-0 right-0 bg-white dark:bg-gray-900 rounded-full p-0.5">
                                    <FaCircle className="text-green-500" size={12} />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-gray-800 truncate">
                                    {other.username}
                                </p>
                                <span
                                    className={`text-xs whitespace-nowrap ${Date.now() - new Date(chat.updatedAt).getTime() < 300_000
                                        ? 'text-purple-600 font-medium'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    {formatChatDate(new Date(chat.updatedAt))}
                                </span>
                            </div>

                            {chat.lastMessageContent && (
                                <div className="flex items-center mt-1">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
                                        {chat.lastMessageContent}
                                    </p>
                                    {!!chat.unreadCount && (
                                        <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs ml-2 flex-shrink-0">
                                            {chat.unreadCount}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ChatList;
