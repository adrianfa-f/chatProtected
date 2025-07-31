import { useEffect, useRef, useState } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';

const ActiveCallScreen = () => {
    const { localStream, remoteStream, endCall } = useCall();
    const [isMuted, setIsMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const { activeChat } = useChat();
    const { user } = useAuth();

    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(() => { });
        }
    }, [remoteStream]);

    useEffect(() => {
        if (localAudioRef.current && localStream) {
            localAudioRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Obtener nombre de la otra persona
    const otherUser = activeChat && user
        ? activeChat.user1.id === user.id ? activeChat.user2 : activeChat.user1
        : null;

    // Formatear duración de llamada
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 to-purple-800 flex flex-col items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center">
                <div className="flex flex-col items-center">
                    <div className="relative mb-6">
                        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-75 animate-ping"></div>
                        <div className="relative bg-gray-200 border-4 border-white rounded-full w-32 h-32 overflow-hidden">
                            {/* Imagen de perfil aquí */}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-1">
                        En llamada con <span className="text-yellow-300">{otherUser?.username || 'Usuario'}</span>
                    </h2>
                    <p className="text-gray-300 text-xl font-mono mb-8">{formatTime(callDuration)}</p>

                    <div className="flex gap-6">
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-5 rounded-full transition-all duration-300 ${isMuted
                                    ? 'bg-rose-500 hover:bg-rose-600'
                                    : 'bg-blue-500 hover:bg-blue-600'
                                }`}
                        >
                            {isMuted
                                ? <FaMicrophoneSlash className="text-2xl text-white" />
                                : <FaMicrophone className="text-2xl text-white" />
                            }
                        </button>

                        <button
                            onClick={endCall}
                            className="bg-red-500 hover:bg-red-600 text-white p-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-red-500/30"
                        >
                            <FaPhoneSlash className="text-2xl" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Elementos de audio */}
            <audio ref={remoteAudioRef} autoPlay />
            {localStream && (
                <audio
                    ref={localAudioRef}
                    muted={isMuted}
                    style={{ display: 'none' }}
                />
            )}
        </div>
    );
}

export default ActiveCallScreen;