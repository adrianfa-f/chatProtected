import { FaCircle } from 'react-icons/fa';
import { useEffect, useState } from 'react';
import { decryptMessage } from '../../services/cryptoService';
import { getLastOwnMessage } from '../../utils/storageUtils';
import type { Chat, User } from '../../types/types';
import { useAuth } from '../../contexts/AuthContext';

interface ChatListProps {
    chats: Chat[];
    onSelectChat: (chat: Chat) => void;
    user: User | null;
}

interface ProcessedChat extends Chat {
    lastMessageContent?: string;
}

const ChatList = ({ chats, onSelectChat, user }: ChatListProps) => {
    const { privateKey } = useAuth();
    const [processedChats, setProcessedChats] = useState<ProcessedChat[]>([]);

    const formatChatDate = (date: Date): string => {
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
        const diffInHours = Math.floor(diffInMinutes / 60);

        if (diffInMinutes < 5) return 'Ahora';
        if (diffInHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffInHours < 48) return 'Ayer';
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    };

    // Procesar los chats para generar lastMessageContent
    useEffect(() => {
        const preprocessChats = async () => {
            const updated = await Promise.all(
                chats.map(async (chat): Promise<ProcessedChat> => {
                    let lastMessageContent = chat.lastMessage;

                    if (chat.lastMessage) {
                        if (chat.lastSenderId === user?.id) {
                            const local = getLastOwnMessage(chat.id);
                            if (local) lastMessageContent = local;
                        } else if (privateKey) {
                            try {
                                console.log("ultimo mensaje cifrado: ", chat.lastMessage)
                                console.log("clave privada: ", privateKey)
                                lastMessageContent = await decryptMessage(chat.lastMessage, privateKey);
                            } catch {
                                lastMessageContent = '🔒 Mensaje cifrado';
                            }
                        }
                    }

                    return {
                        ...chat,
                        lastMessageContent
                    };
                })
            );

            setProcessedChats(updated);
        };

        preprocessChats();
    }, [chats, user, privateKey]);

    if (!Array.isArray(processedChats) || processedChats.length === 0) {
        return (
            <div className="p-8 text-center">
                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl max-w-md mx-auto">
                    <p className="text-gray-600 dark:text-gray-300 mb-3 font-medium">No tienes chats activos</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Inicia una nueva conversación con el botón +</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <p className="mb-3 font-medium">No se pudo cargar la información del usuario</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 px-1">
            {processedChats.map(chat => {
                const otherUser = chat.user1.id === user.id ? chat.user2 : chat.user1;
                const isOnline = otherUser.online;

                return (
                    <div
                        key={chat.id}
                        className="p-3 flex items-center cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                        onClick={() => onSelectChat(chat)}
                    >
                        <div className="relative mr-3">
                            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold shadow-md">
                                {otherUser.username.charAt(0).toUpperCase()}
                            </div>
                            {isOnline && (
                                <div className="absolute bottom-0 right-0 bg-white dark:bg-gray-900 rounded-full p-0.5">
                                    <FaCircle className="text-green-500" size={12} />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-gray-800 truncate">{otherUser.username}</p>
                                <span
                                    className={`text-xs whitespace-nowrap ${new Date().getTime() - new Date(chat.updatedAt).getTime() < 300000
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
                                    {chat.unreadCount && chat.unreadCount > 0 && (
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
