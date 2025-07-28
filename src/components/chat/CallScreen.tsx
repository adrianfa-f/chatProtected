// src/components/CallScreen.tsx
import { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash } from 'react-icons/fa';

const CallScreen = () => {
    const { localStream, remoteStream, endCall, isCalling } = useCall();
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);

    // Cuando cambie remoteStream, conéctalo al <audio>
    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(() => { });
        }
    }, [remoteStream]);

    // (Opcional) mostrar tu propio audio
    useEffect(() => {
        if (localAudioRef.current && localStream) {
            localAudioRef.current.srcObject = localStream;
            // no autoplay para evitar feedback
        }
    }, [localStream]);

    if (!isCalling) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-lg">
                <h2 className="text-xl mb-4">Llamada en curso</h2>

                <audio ref={remoteAudioRef} autoPlay />

                {localStream && (
                    <audio
                        ref={localAudioRef}
                        muted
                        style={{ display: 'none' }}
                    />
                )}

                <button
                    onClick={endCall}
                    className="mt-6 p-3 bg-red-600 text-white rounded-full hover:bg-red-700"
                >
                    <FaPhoneSlash /> Colgar
                </button>
            </div>
        </div>
    );
}

export default CallScreen
