// src/contexts/CallContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { useAudioCall } from '../hooks/useAudioCall';

interface CallContextValue {
    startCall: (remoteId: string) => Promise<void>;
    endCall: () => void;
    inCall: boolean;
    remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentRemoteId, setCurrentRemoteId] = useState<string>('');
    const { startCall: _startCallRaw, endCall, inCall, remoteStream } = useAudioCall(currentRemoteId);

    const startCall = async (remoteId: string) => {
        console.log('[CallContext] startCall to', remoteId);
        setCurrentRemoteId(remoteId);
        await _startCallRaw();
    };

    return (
        <CallContext.Provider value={{ startCall, endCall, inCall, remoteStream }}>
            {children}
        </CallContext.Provider>
    );
};

/* eslint-disable-next-line react-refresh/only-export-components */
export const useCall = (): CallContextValue => {
    const ctx = useContext(CallContext);
    if (!ctx) throw new Error('useCall must be used within CallProvider');
    return ctx;
};
