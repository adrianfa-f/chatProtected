import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContactsSidebar from '../components/chat/ContactsSidebar';
import type { Chat } from '../types/types';

const ChatPage = () => {
    const [activeTab, setActiveTab] = useState<'chats' | 'requests' | 'calls'>('chats');
    const navigate = useNavigate();

    const handleSelectChat = (chat: Chat) => {
        navigate(`/chat/${chat.id}`);
    };

    return (
        <div className="flex h-[100dvh] bg-gray-50">
            <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col border-r border-gray-200 h-full">
                <ContactsSidebar
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onSelectChat={handleSelectChat}
                />
            </div>
        </div>
    );
};

export default ChatPage;