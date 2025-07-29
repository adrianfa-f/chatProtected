// src/components/chat/CallScreen.tsx
import { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash } from 'react-icons/fa';

const CallScreen = () => {
    const { status, localStream, remoteStream, endCall, peerId } = useCall();
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const prevRemoteStream = useRef<MediaStream | null>(null);

    // Manejo seguro del stream remoto
    useEffect(() => {
        if (!remoteAudioRef.current || !remoteStream) return;

        // Evitar recargar el mismo stream
        if (remoteStream === prevRemoteStream.current) return;

        prevRemoteStream.current = remoteStream;

        remoteAudioRef.current.srcObject = remoteStream;

        // No intentar reproducir aquí - se hará en onCanPlay
    }, [remoteStream]);

    // Manejo del stream local (siempre muteado)
    useEffect(() => {
        if (localAudioRef.current && localStream) {
            localAudioRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Solo mostrar cuando estamos en llamada activa
    if (status !== 'inCall') {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
                <h2 className="text-xl font-semibold text-center mb-4">
                    En llamada con <span className="text-purple-600">{peerId}</span>
                </h2>

                {/* Indicador de estado */}
                <div className="flex items-center justify-center mb-6">
                    <span className="flex w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    <p className="text-sm text-gray-600">Llamada activa</p>
                </div>

                {/* Audio para stream remoto */}
                <audio
                    ref={remoteAudioRef}
                    onCanPlay={() => {
                        // Reproducir solo cuando el audio esté listo
                        remoteAudioRef.current?.play().catch(e => {
                            if (e.name !== 'AbortError') {
                                console.error('Error al reproducir audio remoto:', e);
                            }
                        });
                    }}
                    className="hidden"
                />

                {/* Audio para stream local (muteado) */}
                {localStream && (
                    <audio
                        ref={localAudioRef}
                        muted
                        className="hidden"
                    />
                )}

                {/* Botón para finalizar llamada */}
                <div className="flex justify-center mt-4">
                    <button
                        onClick={endCall}
                        className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors flex items-center justify-center"
                        aria-label="Finalizar llamada"
                    >
                        <FaPhoneSlash className="text-xl" />
                        <span className="ml-2 font-medium">Colgar</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallScreen;