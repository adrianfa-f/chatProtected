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
            return <p className="break-words">{item.plaintext || item.ciphertext}</p>;
        }

        switch (item.fileType) {
            case 'image':
                return (
                    <div className="mt-1">
                        <img
                            src={item.url}
                            alt="Imagen enviada"
                            className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                                // Abrir imagen en modal o ventana nueva
                                window.open(item.url, '_blank');
                            }}
                        />
                        {item.filename && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 break-words">
                                {item.filename}
                            </p>
                        )}
                    </div>
                );

            case 'video':
                return (
                    <div className="mt-1">
                        <video
                            src={item.url}
                            controls
                            className="max-w-full max-h-64 rounded-lg"
                        />
                        {item.filename && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {item.filename}
                            </p>
                        )}
                    </div>
                );

            case 'audio':
                return (
                    <div className="mt-1">
                        <audio
                            src={item.url}
                            controls
                            className="w-full"
                        />
                        {item.filename && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {item.filename}
                            </p>
                        )}
                    </div>
                );

            case 'file':
                return (
                    <div className="flex items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <FaPaperclip className="mr-2 flex-shrink-0 text-gray-600 dark:text-gray-300" />
                        <a
                            href={item.url}
                            download={item.filename}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 truncate break-all"
                            title={item.filename}
                            onClick={(e) => {
                                e.preventDefault();
                                const link = document.createElement('a');
                                link.href = item.url;
                                link.setAttribute('download', item.filename);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                        >
                            {item.filename}
                        </a>
                    </div>
                );

            case 'link':
                return (
                    <div className="mt-1 p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center break-all"
                        >
                            {item.url}
                            <FaExternalLinkAlt className="ml-1 text-xs" />
                        </a>
                    </div>
                );

            default:
                return <p className="text-gray-600 dark:text-gray-400">{item.filename || 'Contenido multimedia'}</p>;
        }
    };

    return (
        <div className={`flex mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${isOwn
                    ? 'bg-purple-600 text-white rounded-br-none ml-12'
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-none mr-12'
                    }`}
            >
                {renderContent()}

                <div className={`flex items-center justify-end mt-1 text-xs ${isOwn ? 'text-purple-200' : 'text-gray-500 dark:text-gray-400'}`}>
                    <span className="mr-1">{messageTime}</span>
                    {isOwn && 'status' in item && (
                        item.status === 'seen'
                            ? <FaCheckDouble className="text-gray-300 dark:text-gray-500" />
                            : <FaCheck className="text-gray-300 dark:text-gray-500" />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;