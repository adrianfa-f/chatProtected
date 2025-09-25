import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { FaPaperPlane, FaPaperclip, FaLink, FaTimes, FaVideo, FaMicrophone } from 'react-icons/fa';
import { useSocket } from '../../contexts/SocketContext';
import AudioRecorder from './AudioRecorder';

interface MessageInputProps {
    chatId: string;
}

const MessageInput = ({ chatId }: MessageInputProps) => {
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    const [linkUrl, setLinkUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const { user } = useAuth();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const socket = useSocket();
    const { activeChat, sendMessage } = useChat();
    const [showAudioRecorder, setShowAudioRecorder] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);

    const getReceiverId = () => {
        if (!activeChat || !user) return '';
        return activeChat.user1.id === user.id ? activeChat.user2.id : activeChat.user1.id;
    };

    // Generar preview para imágenes
    useEffect(() => {
        if (attachment && attachment.type.startsWith('image/')) {
            const objectUrl = URL.createObjectURL(attachment);
            setAttachmentPreview(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        } else {
            setAttachmentPreview(null);
        }
    }, [attachment]);

    const handleSendAudio = async (audioBlob: Blob) => {
        if (!socket || !user) return;

        const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
            type: 'audio/webm'
        });

        const reader = new FileReader();
        reader.onload = (event) => {
            const fileData = event.target?.result;
            if (!fileData) return;

            socket.emit('send-media', {
                chatId,
                senderId: user.id,
                receiverId: getReceiverId(),
                file: {
                    name: audioFile.name,
                    type: audioFile.type,
                    size: audioFile.size,
                    data: (fileData as string).split(',')[1]
                }
            });
        };
        reader.readAsDataURL(audioFile);
        setShowAudioRecorder(false);
    };

    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setAttachment(e.target.files[0]);
            setShowLinkInput(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            sendMessage(chatId, message);
            setMessage('');
            resetTextareaHeight();
        }
    };

    const resetTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleAttachFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setAttachment(e.target.files[0]);
            setShowLinkInput(false);
        }
    };

    const handleSendAttachment = () => {
        if (!attachment || !socket || !user) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const fileData = event.target?.result;
            if (!fileData) return;

            socket.emit('send-media', {
                chatId,
                senderId: user.id,
                receiverId: getReceiverId(),
                file: {
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size,
                    data: fileData.toString().split(',')[1]
                }
            });

            setAttachment(null);
            setAttachmentPreview(null);
        };
        reader.readAsDataURL(attachment);
    };

    const handleSendLink = () => {
        if (!linkUrl.trim() || !socket || !user) return;

        socket.emit('send-link', {
            chatId,
            senderId: user.id,
            receiverId: getReceiverId(),
            url: linkUrl
        });

        setLinkUrl('');
        setShowLinkInput(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (attachment) {
                handleSendAttachment();
            } else if (showLinkInput) {
                handleSendLink();
            } else {
                handleSubmit(e);
            }
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            const maxHeight = 100;
            const newHeight = Math.min(scrollHeight, maxHeight);
            textareaRef.current.style.height = `${newHeight}px`;
            textareaRef.current.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden';
        }
    }, [message]);

    const clearAttachment = () => {
        setAttachment(null);
        setAttachmentPreview(null);
    };

    return (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            {showAudioRecorder && (
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <AudioRecorder
                        onSend={handleSendAudio}
                        onCancel={() => setShowAudioRecorder(false)}
                    />
                </div>
            )}

            {(attachment || showLinkInput) && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
                    {attachment ? (
                        <div className="flex items-center space-x-3">
                            {attachmentPreview ? (
                                <>
                                    <img
                                        src={attachmentPreview}
                                        alt="Preview"
                                        className="w-12 h-12 object-cover rounded-lg"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {attachment.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {(attachment.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <FaPaperclip className="text-gray-400 text-lg" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {attachment.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {(attachment.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                </>
                            )}
                            <button
                                onClick={clearAttachment}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <FaTimes />
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex">
                            <input
                                type="text"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                placeholder="Pega el enlace aquí"
                                className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                onClick={handleSendLink}
                                className="bg-purple-600 text-white px-3 rounded-r hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed"
                                disabled={!linkUrl.trim()}
                            >
                                Enviar
                            </button>
                        </div>
                    )}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="flex items-end p-4 gap-2"
            >
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setShowAudioRecorder(true)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Grabar audio"
                    >
                        <FaMicrophone />
                    </button>

                    <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Adjuntar video"
                    >
                        <FaVideo />
                    </button>
                    <input
                        type="file"
                        ref={videoInputRef}
                        onChange={handleVideoSelect}
                        className="hidden"
                        accept="video/*"
                        capture="user"
                    />
                    
                    <button
                        type="button"
                        onClick={handleAttachFile}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Adjuntar archivo"
                    >
                        <FaPaperclip />
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => setShowLinkInput(!showLinkInput)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Enviar enlace"
                    >
                        <FaLink />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*, .pdf, .doc, .docx, .txt"
                    />
                </div>

                <div className="flex-1 relative min-h-[48px]">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribe un mensaje..."
                        className="w-full border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none bg-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400"
                        rows={1}
                        style={{
                            minHeight: '48px',
                            maxHeight: '100px',
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={!message.trim() && !attachment}
                    className={`p-3 rounded-full flex-shrink-0 transition-colors ${
                        message.trim() || attachment
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={attachment ? handleSendAttachment : undefined}
                >
                    <FaPaperPlane />
                </button>
            </form>
        </div>
    );
};

export default MessageInput;