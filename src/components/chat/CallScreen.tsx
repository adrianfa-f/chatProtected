// src/components/chat/CallScreen.tsx
import { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash } from 'react-icons/fa';

const CallScreen = () => {
    const {
        status,
        peerId,
        localStream,
        remoteStream,
        cancelCall,
        declineCall,
        acceptCall,
        endCall
    } = useCall();

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
    }, [remoteStream]);

    // Manejo del stream local
    useEffect(() => {
        if (localAudioRef.current && localStream) {
            localAudioRef.current.srcObject = localStream;
        }
    }, [localStream]);

    return (
        <>
            {/* Elementos de audio ocultos */}
            <audio
                ref={remoteAudioRef}
                onCanPlay={() => {
                    remoteAudioRef.current?.play().catch(e => {
                        if (e.name !== 'AbortError') {
                            console.error('Error al reproducir audio remoto:', e);
                        }
                    });
                }}
                className="hidden"
            />
            <audio
                ref={localAudioRef}
                muted
                className="hidden"
            />

            {/* Pantallas de estado de llamada */}
            {status === 'calling' && (
                <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50 text-white">
                    <p className="text-xl mb-4">
                        Llamando a <span className="font-semibold">{peerId}</span>...
                    </p>
                    <button
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                        onClick={cancelCall}
                    >
                        <FaPhoneSlash className="inline mr-2" /> Colgar
                    </button>
                </div>
            )}

            {status === 'ringing' && (
                <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50 text-white">
                    <p className="text-xl mb-4">
                        Llamada entrante de <span className="font-semibold">{peerId}</span>
                    </p>
                    <div className="flex space-x-4">
                        <button
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
                            onClick={acceptCall}
                        >
                            Aceptar
                        </button>
                        <button
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                            onClick={declineCall}
                        >
                            Rechazar
                        </button>
                    </div>
                </div>
            )}

            {status === 'inCall' && (
                <div className="fixed inset-0 bg-gray-800 flex flex-col items-center justify-center z-50 text-white">
                    <p className="text-xl mb-4">
                        En llamada con <span className="font-semibold">{peerId}</span>
                    </p>
                    <button
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                        onClick={endCall}
                    >
                        <FaPhoneSlash className="inline mr-2" /> Colgar
                    </button>
                </div>
            )}
        </>
    );
};

export default CallScreen;