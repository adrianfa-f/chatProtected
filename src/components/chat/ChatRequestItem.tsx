import { FaUser } from 'react-icons/fa';
import type { ChatRequest } from '../../types/types';
import { useSocket } from "../../contexts/SocketContext";
import { useChat } from "../../contexts/ChatContext"

interface ChatRequestItemProps {
    request: ChatRequest;
    currentUserId?: string;
}

const ChatRequestItem = ({
    request,
    currentUserId
}: ChatRequestItemProps) => {
    const socket = useSocket()
    const { setChatRequests } = useChat()

    // Determinar si es una solicitud recibida
    const isReceived = request.toUser.id === currentUserId;
    const otherUser = isReceived ? request.fromUser : request.toUser;

    const handleAccept = () => {
        if (!socket?.connected) return;
        socket.emit('accept-chat-request', request.id);
        setChatRequests(prev => prev.filter(req => req.id !== request.id));
    };

    const handleReject = () => {
        if (!socket?.connected) return;
        socket.emit('reject-chat-request', request.id);
    };

    return (
        <div className="p-4 flex items-center">
            <div className="bg-gray-300 rounded-full w-10 h-10 flex items-center justify-center mr-3">
                <FaUser className="text-gray-600" />
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-semibold">
                    {otherUser.username}
                </p>
                <p className="text-sm text-gray-500">
                    {isReceived ? 'Te envió una solicitud' : 'Solicitud enviada'}
                </p>
            </div>

            <div className="ml-2">
                {isReceived && request.status === 'pending' ? (
                    <div className="flex space-x-2">
                        <button
                            onClick={handleAccept}
                            className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors"
                        >
                            Aceptar
                        </button>
                        <button
                            onClick={handleReject}
                            className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 transition-colors"
                        >
                            Rechazar
                        </button>
                    </div>
                ) : (
                    <span className={`text-sm ${request.status === 'accepted' ? 'text-green-500' : 'text-gray-500'}`}>
                        {request.status === 'accepted' ? 'Aceptado' : request.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                    </span>
                )}
            </div>
        </div>
    );
};

export default ChatRequestItem;