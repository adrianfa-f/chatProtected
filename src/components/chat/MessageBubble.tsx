import { FaCheck, FaCheckDouble, FaPaperclip, FaExternalLinkAlt } from 'react-icons/fa';
import type { ChatItem } from '../../types/types';

interface MessageBubbleProps {
    item: ChatItem;
    isOwn: boolean;
}

const MessageBubble = ({ item, isOwn }: MessageBubbleProps) => {
    const isMedia = 'fileType' in item;
    const messageTime = new Date(item.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    const renderContent = () => {
        if (!isMedia) {
            // Es un mensaje de texto normal
            return <p>{item.plaintext || item.ciphertext}</p>;
        }

        switch (item.fileType) {
            case 'image':
                return (
                    <div className="mt-1">
                        <img
                            src={item.url}
                            alt="Imagen enviada"
                            className="max-w-xs max-h-64 rounded-lg object-contain"
                        />
                        <p className="mt-1 text-sm">{item.filename}</p>
                    </div>
                );

            case 'file':
                return (
                    <div className="flex items-center p-2 bg-white bg-opacity-20 rounded-lg">
                        <FaPaperclip className="mr-2 flex-shrink-0" />
                        <a
                            href={item.url}
                            download={item.filename}
                            className="text-blue-500 hover:text-blue-700 truncate"
                            title={item.filename}
                        >
                            {item.filename}
                        </a>
                    </div>
                );

            case 'link':
                return (
                    <div className="mt-1 p-2 bg-blue-50 rounded-lg">
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 flex items-center"
                        >
                            {item.url}
                            <FaExternalLinkAlt className="ml-1 text-xs" />
                        </a>
                    </div>
                );

            default:
                return <p>{item.filename || 'Contenido multimedia'}</p>;
        }
    };

    return (
        <div className={`flex mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${isOwn
                    ? 'bg-purple-600 text-white rounded-br-none ml-12'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none mr-12'
                    }`}
            >
                {renderContent()}

                <div className={`flex items-center justify-end mt-1 text-xs ${isOwn ? 'text-purple-200' : 'text-gray-500'}`}>
                    <span className="mr-1">{messageTime}</span>
                    {isOwn && 'status' in item && (
                        item.status === 'seen'
                            ? <FaCheckDouble className="text-gray-300" />
                            : <FaCheck className="text-gray-300" />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;