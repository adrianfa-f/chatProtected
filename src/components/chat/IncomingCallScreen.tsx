import { FaPhone, FaTimes } from 'react-icons/fa';
import { useCall } from '../../contexts/CallContext';
import { useEffect, useRef } from 'react';

const IncomingCallScreen = () => {
    const { peerIdRef, startCall, declineCall, collingUserName } = useCall();
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audioElement = audioRef.current;

        if (audioElement) {
            audioElement.play().catch(e => console.log("Error al reproducir audio:", e));
        }

        return () => {
            if (audioElement) {
                audioElement.pause();
                audioElement.currentTime = 0;
            }
        };
    }, []);

    const handleCancel = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        declineCall();
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 to-purple-800 flex flex-col items-center justify-center z-50">

            <audio
                ref={audioRef}
                src="../../assets/tonoCall/ringtone-126505.mp3"
                loop
            />

            <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center">
                <div className="flex flex-col items-center">
                    <div className="relative mb-8">
                        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-green-500 to-teal-400 opacity-75 animate-pulse"></div>
                        <div className="relative bg-gray-200 border-4 border-white rounded-full w-32 h-32 overflow-hidden">
                            {/* Imagen de perfil aquí */}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">
                        Llamada de <span className="text-yellow-300">{collingUserName}</span>
                    </h2>
                    <p className="text-gray-300 mb-8">¿Deseas responder?</p>

                    <div className="flex gap-6">
                        <button
                            onClick={() => startCall(peerIdRef.current!)}
                            className="bg-green-500 hover:bg-green-600 text-white p-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-green-500/30"
                        >
                            <FaPhone className="text-2xl" />
                        </button>
                        <button
                            onClick={handleCancel}
                            className="bg-red-500 hover:bg-red-600 text-white p-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-red-500/30"
                        >
                            <FaTimes className="text-2xl" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallScreen;