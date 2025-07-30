import { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash } from 'react-icons/fa';

const ActiveCallScreen = () => {
    const { peerId, localStream, remoteStream, endCall } = useCall();
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);

    // Configuración directa de audio remoto
    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(e => {
                if (e.name !== 'AbortError') {
                    console.error('Error en audio remoto:', e);
                }
            });
        }
    }, [remoteStream]);

    // Configuración de audio local
    useEffect(() => {
        if (localAudioRef.current && localStream) {
            localAudioRef.current.srcObject = localStream;
        }
    }, [localStream]);

    return (
        <div className="fixed inset-0 bg-gray-800 flex flex-col items-center justify-center z-50 text-white">
            <p className="text-xl mb-4">
                En llamada con <span className="font-semibold">{peerId}</span>
            </p>

            <audio ref={remoteAudioRef} />
            <audio ref={localAudioRef} muted className="hidden" />

            <button
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded flex items-center"
                onClick={endCall}
            >
                <FaPhoneSlash className="mr-2" /> Colgar
            </button>
        </div>
    );
};

export default ActiveCallScreen;