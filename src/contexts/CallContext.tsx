// src/contexts/CallContext.tsx
import React, { createContext, useContext } from 'react';
import { useAudioCall } from '../hooks/useAudioCall';

interface CallContextValue {
    startCall: (remoteId: string) => Promise<void>;
    endCall: () => void;
    inCall: boolean;
    remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { startCall, endCall, inCall, remoteStream } = useAudioCall();
    return (
        <CallContext.Provider value={{ startCall, endCall, inCall, remoteStream }}>
            {children}
        </CallContext.Provider>
    );
};

/* eslint-disable-next-line react-refresh/only-export-components */
export const useCall = () => {
    const ctx = useContext(CallContext);
    if (!ctx) throw new Error('useCall debe usarse dentro de CallProvider');
    return ctx;
};
