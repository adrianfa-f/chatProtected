import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { FaCircle } from 'react-icons/fa';
import { useSocket } from '../../contexts/SocketContext';
import { joinChat, leaveChat } from '../../services/socketService';
import type { Message } from '../../types/types';

const ChatWindow = () => {
    const { activeChat, messages, addMessage } = useChat();
    const { user } = useAuth();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const socket = useSocket();

    // Función para formatear la última conexión
    const formatLastSeen = (lastSeen?: string | Date): string => {
        if (!lastSeen) return "Desconocido";

        const date = new Date(lastSeen);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
        const diffInHours = Math.floor(diffInMinutes / 60);

        if (diffInMinutes < 5) {
            return "Recientemente";
        } else if (diffInHours < 24) {
            return `Hoy a las ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffInHours < 48) {
            return "Ayer";
        } else {
            return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
        }
    };

    // Manejar reconexiones
    useEffect(() => {
        if (!socket) {
            console.log('[CHAT WINDOW] Socket no disponible');
            return;
        }

        console.log('[CHAT WINDOW] Configurando listener de reconexión');

        const handleReconnect = () => {
            console.log('[CHAT WINDOW] Socket reconectado');
            if (activeChat?.id) {
                joinChat(socket, activeChat.id);
                console.log(`[CHAT WINDOW] Re-joined chat after reconnect: ${activeChat.id}`);
            }
        };

        socket.on('reconnect', handleReconnect);

        return () => {
            console.log('[CHAT WINDOW] Limpiando listener de reconexión');
            socket.off('reconnect', handleReconnect);
        };
    }, [socket, activeChat?.id]);

    // Unirse/salir del chat
    useEffect(() => {
        if (!activeChat?.id || !socket) {
            console.log('[CHAT WINDOW] No hay chat activo o socket no disponible');
            return;
        }

        console.log(`[CHAT WINDOW] Uniendo al chat: ${activeChat.id}`);
        joinChat(socket, activeChat.id);

        return () => {
            console.log(`[CHAT WINDOW] Saliendo del chat: ${activeChat.id}`);
            leaveChat(socket, activeChat.id);
        };
    }, [activeChat?.id, socket]);

    // Configurar listeners de WebSocket para mensajes entrantes
    useEffect(() => {
        if (!socket) {
            console.log('[CHAT WINDOW] Socket no disponible para configurar listeners');
            return;
        }

        console.log('[CHAT WINDOW] Configurando listeners de WebSocket');

        // Handler para mensajes entrantes
        const handleReceiveMessage = (message: Message) => {
            console.log('[CHAT WINDOW] Mensaje recibido via socket:', message);
            // Llamar a addMessage para actualizar el estado
            addMessage(message);
        };

        const handleMessageError = (error: string) => {
            console.error('[CHAT WINDOW] Error al enviar mensaje:', error);
        };

        socket.on('receive-message', handleReceiveMessage);
        socket.on('message-error', handleMessageError);

        return () => {
            socket.off('receive-message', handleReceiveMessage);
            socket.off('message-error', handleMessageError);
        };
    }, [socket, addMessage]); // Añadir addMessage como dependencia

    // Scroll automático al final de los mensajes
    useEffect(() => {
        if (messages.length > 0 && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "auto" });
        }
    }, [activeChat?.id, messages.length]);

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

    const otherUser = activeChat.user1.id === user.id
        ? activeChat.user2
        : activeChat.user1;

    return (
        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Encabezado fijo */}
            <div className="bg-white shadow-sm py-3 px-4 flex items-center border-b border-gray-200 sticky top-0 z-10">
                <button
                    onClick={() => navigate('/chat')}
                    className="mr-3 text-gray-500 hover:text-gray-700"
                >
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
            </div>

            {/* Área de mensajes con scroll */}
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
                    {/* Referencia para scroll automático */}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input fijo en la parte inferior */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
                <MessageInput chatId={activeChat.id} />
            </div>
        </div>
    );
};

export default ChatWindow;