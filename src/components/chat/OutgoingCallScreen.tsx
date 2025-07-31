import { FaPhoneSlash } from 'react-icons/fa';
import { useCall } from '../../contexts/CallContext';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext'

const OutgoingCallScreen = () => {
    const { cancelCall } = useCall();
    const { user } = useAuth()
    const { activeChat } = useChat()

    if (!activeChat || !user) return null;

    const otherUser = activeChat.user1.id === user.id ? activeChat.user2 : activeChat.user1;

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 to-purple-800 flex flex-col items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center">
                <div className="flex flex-col items-center">
                    <div className="relative mb-8">
                        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-75 animate-pulse"></div>
                        <div className="relative bg-gray-200 border-4 border-white rounded-full w-32 h-32 overflow-hidden">
                            {/* Imagen de perfil aquí */}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">
                        Llamando a <span className="text-yellow-300">{otherUser.username}</span>
                    </h2>
                    <p className="text-gray-300 mb-8 animate-pulse">Esperando respuesta...</p>

                    <button
                        onClick={cancelCall}
                        className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-red-500/30"
                    >
                        <FaPhoneSlash className="text-xl" />
                        <span>Cancelar llamada</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OutgoingCallScreen;