import { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { searchUsers, sendChatRequest } from '../../services/chatService';
import type { ChatRequest, User } from '../../types/types';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { useSocket } from '../../contexts/SocketContext';
import { sendChatRequestSocket } from '../../services/socketService';

const StartNewChatModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState('');
    const { addChatRequest } = useChat();
    const { user } = useAuth();
    const socket = useSocket();

    const handleSearch = async () => {
        if (!user) {
            setError('No se pudo identificar tu usuario');
            return;
        }
        if (!socket?.connected) {
            setError('Socket no conectado');
            return;
        }

        if (!searchTerm.trim()) return;
        setIsSearching(true);
        setError('');
        try {
            const results = await searchUsers(searchTerm);
            setSearchResults(results);
        } catch (error) {
            console.error('Error searching users:', error);
            setError('Error al buscar usuarios');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleStartChat = async (userToChat: User) => {
        if (!user) {
            setError('No se pudo identificar tu usuario');
            return;
        }

        try {
            const newRequest = await sendChatRequest(userToChat.id);
            sendChatRequestSocket(socket, userToChat.id);
            const requestForState: ChatRequest = {
                ...newRequest,
                fromUser: user,
                toUser: userToChat
            };

            addChatRequest(requestForState);
            onClose();
        } catch (error) {
            console.error('Error sending chat request:', error);
            setError('Error al enviar solicitud de chat');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Iniciar nuevo chat</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white"
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className="p-4">
                    {error && <div className="text-red-500 mb-4 p-2 bg-red-50 rounded">{error}</div>}

                    <div className="flex mb-4">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por username"
                                className="w-full border border-gray-300 text-gray-900 rounded-lg p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="bg-purple-600 text-white px-4 rounded-lg ml-2 hover:bg-purple-700 transition-colors"
                        >
                            Buscar
                        </button>
                    </div>

                    {isSearching ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                    ) : (
                        <div className="max-h-80 overflow-y-auto">
                            {searchResults.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <p>No se encontraron usuarios</p>
                                    <p className="text-sm mt-1">Intenta con otro nombre de usuario</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-200">
                                    {searchResults.map(user => (
                                        <li
                                            key={user.id}
                                            className="flex justify-between items-center p-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors"
                                            onClick={() => handleStartChat(user)}
                                        >
                                            <div className="flex items-center">
                                                <div className="bg-gray-300 rounded-full w-10 h-10 flex items-center justify-center mr-3">
                                                    <span className="font-semibold text-gray-600">
                                                        {user.username.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <span className="font-medium">{user.username}</span>
                                            </div>
                                            <button className="bg-purple-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-purple-700 transition-colors">
                                                Chatear
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StartNewChatModal;