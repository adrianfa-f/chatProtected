import { useState, useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import StartNewChatModal from './StartNewChatModal';
import ChatList from './ChatList';
import ChatRequestList from './ChatRequestList';
import { FaSearch, FaUserPlus, FaComments, FaBell, FaTimes } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import type { Chat } from '../../types/types';

interface ContactsSidebarProps {
    activeTab: 'chats' | 'requests';
    setActiveTab: (tab: 'chats' | 'requests') => void;
    onSelectChat: (chat: Chat) => void;
}

const ContactsSidebar = ({
    activeTab,
    setActiveTab,
    onSelectChat
}: ContactsSidebarProps) => {
    const {
        chats,
        chatRequests,
        loadChats,
        loadChatRequests
    } = useChat();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            loadChats();
            loadChatRequests();
        }
    }, [user, loadChats, loadChatRequests]);

    // Contar solicitudes pendientes recibidas
    const pendingRequestsCount = chatRequests.filter(r =>
        r.status === 'pending' && r.toUser.id === user?.id
    ).length;

    // Manejar la expansión del campo de búsqueda
    const handleSearchClick = () => {
        setIsSearchExpanded(true);
        setTimeout(() => {
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        }, 10);
    };

    // Manejar el cierre del campo de búsqueda
    const handleCloseSearch = () => {
        setIsSearchExpanded(false);
        setSearchQuery('');
    };

    return (
        <div className="bg-gray-800 text-white shadow-lg flex flex-col h-full flex-col-container">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                {/* Logo - oculto cuando búsqueda expandida */}
                <div className={`transition-all duration-300 ${isSearchExpanded ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                    <div className="flex items-center">
                        <div className="bg-purple-600 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                            <span className="font-bold">WC</span>
                        </div>
                        <h1 className="text-xl font-bold">WhatsCifrado</h1>
                    </div>
                </div>

                {/* Botón de búsqueda - solo visible cuando no está expandido */}
                {!isSearchExpanded && (
                    <button
                        onClick={handleSearchClick}
                        className="text-gray-300 hover:text-white p-2"
                        aria-label="Buscar"
                    >
                        <FaSearch className="text-xl" />
                    </button>
                )}

                {/* Campo de búsqueda - solo visible cuando expandido */}
                {isSearchExpanded && (
                    <div className="absolute left-4 right-4 flex items-center bg-white text-gray-800 rounded-lg px-3 py-2 z-10">
                        <FaSearch className="text-gray-400 mr-2" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar chats, contactos..."
                            className="bg-transparent border-0 focus:outline-none w-full"
                        />
                        <button
                            onClick={handleCloseSearch}
                            className="text-gray-500 hover:text-gray-700 ml-2"
                        >
                            <FaTimes />
                        </button>
                    </div>
                )}

                {/* Botones de acción - oculto cuando búsqueda expandida */}
                <div className={`transition-all duration-300 ${isSearchExpanded ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 p-2 rounded-full transition-colors"
                        aria-label="Nuevo chat"
                    >
                        <FaUserPlus />
                    </button>
                </div>
            </div>

            {/* Pestañas - siempre visibles */}
            <div className="bg-gray-700 border-t border-gray-600">
                <div className="container mx-auto px-4 flex">
                    <button
                        className={`flex items-center py-3 px-4 ${activeTab === 'chats'
                            ? 'text-white border-b-2 border-purple-500'
                            : 'text-gray-300 hover:text-white'
                            }`}
                        onClick={() => setActiveTab('chats')}
                    >
                        <FaComments className="mr-2" />
                        <span>Chats</span>
                    </button>

                    <button
                        className={`flex items-center py-3 px-4 relative ${activeTab === 'requests'
                            ? 'text-white border-b-2 border-purple-500'
                            : 'text-gray-300 hover:text-white'
                            }`}
                        onClick={() => setActiveTab('requests')}
                    >
                        <FaBell className="mr-2" />
                        <span>Solicitudes</span>
                        {pendingRequestsCount > 0 && (
                            <span className="ml-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                {pendingRequestsCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Área de contenido - Ahora con altura flexible y min-h-0 */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 text-gray-800">
                {activeTab === 'chats' ? (
                    <ChatList
                        chats={chats}
                        onSelectChat={onSelectChat}
                    />
                ) : (
                    <ChatRequestList
                        requests={chatRequests}
                        user={user}
                    />
                )}
            </div>

            <StartNewChatModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
};

export default ContactsSidebar;