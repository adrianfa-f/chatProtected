// src/components/chat/ActiveCallScreen.tsx
import { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash } from 'react-icons/fa';

const ActiveCallScreen = () => {
    const { peerId, localStream, remoteStream, endCall } = useCall();
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);

    // Manejo seguro de los streams de audio
    useEffect(() => {
        // Capturar los elementos de audio actuales
        const remoteAudioEl = remoteAudioRef.current;
        const localAudioEl = localAudioRef.current;

        // Configurar audio remoto
        if (remoteAudioEl && remoteStream) {
            remoteAudioEl.srcObject = remoteStream;

            // Intentar reproducir cuando el audio esté listo
            const playRemoteAudio = () => {
                remoteAudioEl.play().catch(e => {
                    if (e.name !== 'AbortError') {
                        console.error('Error al reproducir audio remoto:', e);
                    }
                });
            };

            remoteAudioEl.oncanplay = playRemoteAudio;
            playRemoteAudio();
        }

        // Configurar audio local (siempre muteado)
        if (localAudioEl && localStream) {
            localAudioEl.srcObject = localStream;
        }

        // Limpiar al desmontar el componente
        return () => {
            if (remoteAudioEl) {
                remoteAudioEl.oncanplay = null;
                remoteAudioEl.srcObject = null;
            }
            if (localAudioEl) {
                localAudioEl.srcObject = null;
            }
        };
    }, [localStream, remoteStream]);

    return (
        <div className="fixed inset-0 bg-gray-800 flex flex-col items-center justify-center z-50 text-white">
            <p className="text-xl mb-4">
                En llamada con <span className="font-semibold">{peerId}</span>
            </p>

            {/* Elementos de audio ocultos */}
            <audio ref={remoteAudioRef} className="hidden" />
            <audio ref={localAudioRef} muted className="hidden" />

            <button
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                onClick={endCall}
            >
                <FaPhoneSlash className="inline mr-2" /> Colgar
            </button>
        </div>
    );
};

export default ActiveCallScreen;