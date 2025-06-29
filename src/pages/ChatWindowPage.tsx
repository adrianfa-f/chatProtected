import { useParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { useEffect } from 'react';
import ChatWindow from '../components/chat/ChatWindow';
import { useSocket } from '../contexts/SocketContext';
import { joinChat, leaveChat } from '../services/socketService';
import { useAuth } from '../contexts/AuthContext';

const ChatWindowPage = () => {
    const { chatId } = useParams<{ chatId: string }>();
    const { activeChat, setActiveChat, chats, loadChatMessages } = useChat();
    const socket = useSocket();
    const { user } = useAuth();

    useEffect(() => {
        if (chatId) {
            const chat = chats.find(c => c.id === chatId);
            if (chat) {
                setActiveChat(chat);
                loadChatMessages(chatId);
            }
        }
    }, [chatId, chats, loadChatMessages, setActiveChat]);

    useEffect(() => {
        if (!chatId || !socket || !user) return;

        joinChat(socket, chatId);

        return () => {
            leaveChat(socket, chatId);
        };
    }, [chatId, socket, user]);

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