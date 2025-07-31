// src/components/chat/OutgoingCallScreen.tsx
import { FaPhoneSlash } from 'react-icons/fa';
import { useCall } from '../../contexts/CallContext';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext'

const OutgoingCallScreen = () => {
    const { cancelCall } = useCall();
    const { user } = useAuth()
    const { activeChat } = useChat()

    if (!activeChat || !user) return

    const otherUser = activeChat.user1.id === user.id ? activeChat.user2 : activeChat.user1

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                <div className="flex flex-col items-center">
                    <div className="animate-pulse mb-4">
                        <div className="bg-gray-200 border-2 border-dashed rounded-full w-24 h-24" />
                    </div>
                    <h2 className="text-xl font-bold text-center mb-2">
                        Llamando a <span className="text-purple-600">{otherUser.username}</span>
                    </h2>
                    <p className="text-gray-600 mb-6">Esperando respuesta...</p>
                    <button
                        onClick={cancelCall}
                        className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 transition flex items-center"
                    >
                        <FaPhoneSlash className="mr-2" />
                        Cancelar llamada
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OutgoingCallScreen;