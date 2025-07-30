// src/components/chat/ActiveCallScreen.tsx
import { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash } from 'react-icons/fa';

const ActiveCallScreen = () => {
    const { peerId, localStream, remoteStream, endCall } = useCall();
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(e => {
                if (e.name !== 'AbortError') console.error('Error audio remoto:', e);
            });
        }
    }, [remoteStream]);

    useEffect(() => {
        if (localAudioRef.current && localStream) {
            localAudioRef.current.srcObject = localStream;
        }
    }, [localStream]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                        <div className="bg-gray-200 border-2 border-dashed rounded-full w-24 h-24" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>
                    <h2 className="text-xl font-bold text-center mb-2">
                        En llamada con <span className="text-purple-600">{peerId}</span>
                    </h2>
                    <p className="text-gray-600 mb-6">00:00</p>
                    <button
                        onClick={endCall}
                        className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 transition flex items-center"
                    >
                        <FaPhoneSlash className="mr-2" />
                        Finalizar llamada
                    </button>
                </div>
            </div>
            <audio ref={remoteAudioRef} />
            <audio ref={localAudioRef} muted className="hidden" />
        </div>
    );
};

export default ActiveCallScreen;