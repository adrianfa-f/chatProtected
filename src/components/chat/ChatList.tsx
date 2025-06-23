import { FaCircle } from 'react-icons/fa';
import type { Chat, User } from '../../types/types';

interface ChatListProps {
    chats: Chat[];
    onSelectChat: (chat: Chat) => void;
    user: User | null;
}

const ChatList = ({
    chats,
    onSelectChat,
    user
}: ChatListProps) => {
    // Función para formatear la fecha según las especificaciones
    const formatChatDate = (date: Date): string => {
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
        const diffInHours = Math.floor(diffInMinutes / 60);

        if (diffInMinutes < 5) {
            return "Ahora";
        } else if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInHours < 48) {
            return "Ayer";
        } else {
            return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
        }
    };

    // Si no hay chats o no es un array, mostramos mensaje
    if (!Array.isArray(chats) || chats.length === 0) {
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

    // Si no hay usuario, no podemos determinar el otro usuario en el chat
    if (!user) {
        return (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <p className="mb-3 font-medium">No se pudo cargar la información del usuario</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 px-1">
            {chats.map(chat => {
                const otherUser = chat.user1.id === user.id ? chat.user2 : chat.user1;
                const isOnline = otherUser.online; // Usar el estado en línea real

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
                                <p className="font-semibold text-gray-800 truncate">
                                    {otherUser.username}
                                </p>
                                <span className={`text-xs whitespace-nowrap ${new Date().getTime() - new Date(chat.updatedAt).getTime() < 300000
                                    ? "text-purple-600 font-medium"
                                    : "text-gray-500 dark:text-gray-400"
                                    }`}>
                                    {formatChatDate(new Date(chat.updatedAt))}
                                </span>
                            </div>

                            {chat.lastMessage && (
                                <div className="flex items-center mt-1">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
                                        {chat.lastMessage}
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