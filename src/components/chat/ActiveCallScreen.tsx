// src/components/chat/ActiveCallScreen.tsx
import { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash } from 'react-icons/fa';

const ActiveCallScreen = () => {
    const { peerId, localStream, remoteStream, endCall } = useCall();
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const prevRemoteStream = useRef<MediaStream | null>(null);

    // 1. Manejo seguro del audio remoto
    useEffect(() => {
        const audioEl = remoteAudioRef.current;
        if (!audioEl || !remoteStream) return;

        // Evitar recargar el mismo stream
        if (remoteStream === prevRemoteStream.current) return;
        prevRemoteStream.current = remoteStream;

        // Asignar el stream
        audioEl.srcObject = remoteStream;

        // Reproducir con manejo de errores
        const playAudio = () => {
            audioEl.play().catch(e => {
                if (e.name !== 'AbortError') {
                    console.error('Error en audio remoto:', e);
                }
            });
        };

        // Intentar reproducir inmediatamente
        playAudio();

        // Configurar evento para reintentar si es necesario
        audioEl.oncanplay = playAudio;

        // Limpiar al desmontar
        return () => {
            audioEl.oncanplay = null;
        };
    }, [remoteStream]);

    // 2. Manejo del audio local (muteado)
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

            {/* Elementos de audio */}
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