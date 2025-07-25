import { FaPhoneSlash, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { useCall } from '../../contexts/CallContext';
import { useEffect, useRef, useState } from 'react';

const CallScreen = () => {
    const { callState, remoteUser, endCall, acceptCall, localStream, remoteStream } = useCall();
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const [isMuted, setIsMuted] = useState(false);

    // Reproducir local (muted para no hacer eco)
    useEffect(() => {
        if (localStream && localAudioRef.current) {
            localAudioRef.current.srcObject = localStream;
            localAudioRef.current.play().catch(console.warn);
        }
    }, [localStream]);

    // Reproducir remoto
    useEffect(() => {
        if (remoteStream && remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(console.warn);
        }
    }, [remoteStream]);

    if (callState === 'idle') return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center">
            <div className="text-center text-white">
                <h2 className="text-2xl font-bold">
                    {callState === 'calling' && 'Llamando a'}
                    {callState === 'ringing' && 'Llamada entrante de'}
                    {callState === 'in-progress' && 'En llamada con'}
                </h2>
                <p className="text-xl mt-2">{remoteUser?.username}</p>

                {/* Controles para llamada activa */}
                {callState === 'in-progress' && (
                    <div className="mt-12 flex justify-center space-x-8">
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-4 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700'}`}
                        >
                            {isMuted ? <FaMicrophoneSlash size={24} /> : <FaMicrophone size={24} />}
                        </button>

                        <button
                            onClick={endCall}
                            className="p-4 bg-red-500 rounded-full"
                        >
                            <FaPhoneSlash size={24} />
                        </button>
                    </div>
                )}

                {/* Botones para llamada entrante */}
                {callState === 'ringing' && (
                    <div className="mt-12 flex justify-center space-x-8">
                        <button
                            onClick={acceptCall}
                            className="p-4 bg-green-500 text-white rounded-full font-semibold"
                        >
                            Aceptar
                        </button>
                        <button
                            onClick={endCall}
                            className="p-4 bg-red-500 text-white rounded-full font-semibold"
                        >
                            Rechazar
                        </button>
                    </div>
                )}
            </div>
            <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />
            <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
        </div>
    );
};

export default CallScreen;
