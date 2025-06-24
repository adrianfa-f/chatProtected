import { useParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { useEffect } from 'react';
import ChatWindow from '../components/chat/ChatWindow';
import { useSocket } from '../contexts/SocketContext';
import { joinChat, leaveChat } from '../services/socketService';

const ChatWindowPage = () => {
    const { chatId } = useParams<{ chatId: string }>();
    const { activeChat, setActiveChat, chats, loadChatMessages } = useChat();
    const socket = useSocket();

    useEffect(() => {
        if (chatId) {
            // Buscar el chat en la lista
            const chat = chats.find(c => c.id === chatId);
            if (chat) {
                setActiveChat(chat);
                loadChatMessages(chatId);
            }
        }
    }, [chatId, chats, loadChatMessages, setActiveChat]);

    // Unirse y salir del chat usando WebSockets
    useEffect(() => {
        if (!chatId || !socket) return;

        // Unirse al chat específico
        joinChat(socket, chatId);

        return () => {
            // Salir del chat al desmontar el componente
            leaveChat(socket, chatId);
        };
    }, [chatId, socket]);

    return (
        <div className="flex h-[100dvh] bg-gray-50">
            <div className="flex-1 flex flex-col w-full">
                {activeChat ? (
                    <ChatWindow />
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p>Chat no encontrado</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatWindowPage;