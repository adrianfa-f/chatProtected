import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { FaArrowLeft, FaCircle, FaPhone } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { joinChat, leaveChat } from '../../services/socketService';
import { useCall } from '../../contexts/CallContext';

const ChatWindow = () => {
    const { activeChat, messages } = useChat();
    const { user } = useAuth();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const socket = useSocket();
    const { startCall } = useCall();

    const formatLastSeen = (lastSeen?: string | Date): string => {
        if (!lastSeen) return "Desconocido";
        const date = new Date(lastSeen);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInMinutes < 5) return "Recientemente";
        if (diffInHours < 24) return `Hoy a las ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        if (diffInHours < 48) return "Ayer";
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    };

    useEffect(() => {
        if (!socket?.connected) return;
        const handleReconnect = () => {
            if (activeChat?.id) {
                joinChat(socket, activeChat.id);
                console.log(`[CHAT WINDOW] Re-joined chat after reconnect: ${activeChat.id}`);
            }
        };
        socket.on('reconnect', handleReconnect);
        return () => {
            socket.off('reconnect', handleReconnect);
        };
    }, [socket, activeChat?.id]);

    useEffect(() => {
        if (!socket?.connected || !activeChat?.id) return;
        joinChat(socket, activeChat.id);
        return () => leaveChat(socket, activeChat.id);
    }, [socket, activeChat?.id]);

    useEffect(() => {
        if (messages.length > 0 && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "auto" });
        }
    }, [messages.length, activeChat?.id]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    if (!activeChat || !user) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center">
                <p>Cargando chat...</p>
            </div>
        );
    }

    if (!socket || !socket.connected) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-purple-600 animate-pulse">
                <p>Conectando con el chat...</p>
            </div>
        );
    }

    const otherUser = activeChat.user1.id === user.id
        ? activeChat.user2
        : activeChat.user1;

    return (
        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="bg-white shadow-sm py-3 px-4 flex items-center border-b border-gray-200 sticky top-0 z-10">
                <button onClick={() => navigate('/chat')} className="mr-3 text-gray-500 hover:text-gray-700">
                    <FaArrowLeft />
                </button>
                <div className="flex items-center">
                    <div className="relative mr-3">
                        <div className="bg-gray-300 rounded-full w-10 h-10 flex items-center justify-center">
                            <span className="font-semibold text-gray-600">
                                {otherUser.username.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        {otherUser.online && (
                            <FaCircle className="text-green-500 absolute bottom-0 right-0 bg-white rounded-full" size={12} />
                        )}
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-800">{otherUser.username}</h2>
                        <p className="text-xs text-gray-500 flex items-center">
                            {otherUser.online ? (
                                <>
                                    <span className="flex w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                    En línea
                                </>
                            ) : (
                                `Últ. vez: ${formatLastSeen(otherUser.lastSeen)}`
                            )}
                        </p>
                    </div>
                </div>
                <div className='ml-auto'>
                    <button
                        onClick={() => {
                            console.log('[ChatWindow] clicking phone → calling', otherUser.id);
                            startCall(otherUser.id);
                        }}
                        className="text-purple-600 hover:text-purple-800"
                    >
                        <FaPhone />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pt-16 pb-20">
                <div className="max-w-3xl mx-auto">
                    {messages
                        .filter(msg => msg.chatId === activeChat.id)
                        .map(message => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwn={message.senderId === user.id}
                            />
                        ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
                <MessageInput chatId={activeChat.id} />
            </div>
        </div>
    );
};

export default ChatWindow;