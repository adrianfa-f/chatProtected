import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { FaPaperPlane } from 'react-icons/fa';

interface MessageInputProps {
    chatId: string;
}

const MessageInput = ({ chatId }: MessageInputProps) => {
    const [message, setMessage] = useState('');
    const { sendMessage } = useChat();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            sendMessage(chatId, message);
            setMessage('');
            // Resetear altura después de enviar
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    // Ajustar altura del textarea automáticamente
    useEffect(() => {
        if (textareaRef.current) {
            // Resetear altura primero
            textareaRef.current.style.height = 'auto';

            // Calcular nueva altura (máximo 100px)
            const scrollHeight = textareaRef.current.scrollHeight;
            const maxHeight = 100;
            const newHeight = Math.min(scrollHeight, maxHeight);

            textareaRef.current.style.height = `${newHeight}px`;
            textareaRef.current.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden';
        }
    }, [message]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <div className="bg-white border-t border-gray-200">
            <form
                onSubmit={handleSubmit}
                className="flex items-end p-4 gap-2"
            >
                <div className="flex-1 relative min-h-[48px]">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribe un mensaje..."
                        className="w-full border border-gray-300 text-gray-900 rounded-lg py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        rows={1}
                        style={{
                            minHeight: '48px',
                            maxHeight: '100px',
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={!message.trim()}
                    className={`p-3 rounded-full mb-1 flex-shrink-0 ${message.trim()
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-300 text-gray-500'
                        } transition-colors`}
                >
                    <FaPaperPlane />
                </button>
            </form>
        </div>
    );
};

export default MessageInput;