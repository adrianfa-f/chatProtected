// src/components/chat/ActiveCallScreen.tsx
import { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash } from 'react-icons/fa';

const ActiveCallScreen = () => {
    const { peerId, localStream, remoteStream, endCall } = useCall();
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const localAudioRef = useRef<HTMLAudioElement | null>(null);
    const prevRemoteStream = useRef<MediaStream | null>(null);

    // Configurar y reproducir audio remoto
    const setupRemoteAudio = (el: HTMLAudioElement | null) => {
        remoteAudioRef.current = el;
        if (!el || !remoteStream) return;

        // Evitar recargar el mismo stream
        if (remoteStream === prevRemoteStream.current) return;
        prevRemoteStream.current = remoteStream;

        // Asignar y reproducir inmediatamente
        el.srcObject = remoteStream;
        el.play().catch(e => {
            if (e.name !== 'AbortError') {
                console.error('Error al reproducir audio remoto:', e);
            }
        });
    };

    // Configurar audio local (muteado)
    const setupLocalAudio = (el: HTMLAudioElement | null) => {
        localAudioRef.current = el;
        if (el && localStream) {
            el.srcObject = localStream;
        }
    };

    // Limpieza al desmontar el componente
    useEffect(() => {
        return () => {
            // Detener los streams al finalizar la llamada
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            if (remoteStream) {
                remoteStream.getTracks().forEach(track => track.stop());
            }

            // Limpiar referencias
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = null;
            }
            if (localAudioRef.current) {
                localAudioRef.current.srcObject = null;
            }
        };
    }, [localStream, remoteStream]);

    return (
        <div className="fixed inset-0 bg-gray-800 flex flex-col items-center justify-center z-50 text-white">
            <p className="text-xl mb-4">
                En llamada con <span className="font-semibold">{peerId}</span>
            </p>

            {/* Audio remoto con la mecánica que funciona */}
            <audio
                ref={setupRemoteAudio}
                autoPlay
                className="hidden"
            />

            {/* Audio local (muteado) */}
            <audio
                ref={setupLocalAudio}
                muted
                className="hidden"
            />

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