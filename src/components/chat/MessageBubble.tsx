import { FaCheckDouble } from 'react-icons/fa';
import type { Message } from '../../types/types';

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
}

const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => {
    // Formatear la hora del mensaje
    console.log("Estatus del mensaje: ", message.status)
    const messageTime = new Date(message.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className={`flex mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${isOwn
                    ? 'bg-purple-600 text-white rounded-br-none ml-12' // +12px margen izquierdo
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none mr-12' // +12px margen derecho
                    }`}
            >
                <p>{message.plaintext || message.ciphertext}</p>

                <div className={`flex items-center justify-end mt-1 text-xs ${isOwn ? 'text-purple-200' : 'text-gray-500'
                    }`}>
                    <span className="mr-1">{messageTime}</span>
                    {isOwn && (
                        message.status === 'seen'
                            ? <FaCheckDouble className="text-purple-200" />
                            : <FaCheckDouble className="text-gray-300" />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;