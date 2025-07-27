// src/components/chat/CallScreen.tsx
import React, { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';

const CallScreen: React.FC = () => {
    const { inCall, remoteStream, endCall } = useCall();
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && remoteStream) {
            audioRef.current.srcObject = remoteStream;
            audioRef.current.play().catch(console.warn);
        }
    }, [remoteStream]);

    if (!inCall) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
            <h2 className="text-white mb-4">En llamada…</h2>
            <audio
                ref={el => {
                    if (el && remoteStream) {
                        el.srcObject = remoteStream;
                        el.play().catch(console.warn);
                    }
                }}
                autoPlay
            />
            <button
                onClick={() => {
                    console.log('[CallScreen] endCall invoked');
                    endCall();
                }}
                className="mt-6 px-4 py-2 bg-red-600 text-white rounded"
            >
                Colgar
            </button>
        </div>
    );
};

export default CallScreen;
