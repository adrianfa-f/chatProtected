import { createContext, useContext, useState, type ReactNode } from 'react';
import { useWebRTC } from '../hooks/useWebRTC'; // ✅ Importar el hook aquí

interface CallContextType {
    callState: 'idle' | 'calling' | 'ringing' | 'in-progress';
    remoteUser: { id: string; username: string } | null;
    startCall: (userId: string, username: string) => void;
    endCall: () => void;
    acceptCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

/* eslint-disable-next-line react-refresh/only-export-components */
export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within a CallProvider');
    return context;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
    const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'in-progress'>('idle');
    const [remoteUser, setRemoteUser] = useState<{ id: string; username: string } | null>(null);

    const { startCall: initiateWebRTC, endCall: endWebRTC } = useWebRTC(); // ✅ Extraer funciones desde el hook

    const startCall = (userId: string, username: string) => {
        setRemoteUser({ id: userId, username });
        setCallState('calling');
        initiateWebRTC(userId); // ✅ Inicia la parte WebRTC correctamente
    };

    const endCall = () => {
        setCallState('idle');
        setRemoteUser(null);
        endWebRTC(); // ✅ Finaliza la parte WebRTC también
    };

    const acceptCall = () => {
        setCallState('in-progress');
    };

    return (
        <CallContext.Provider value={{ callState, remoteUser, startCall, endCall, acceptCall }}>
            {children}
        </CallContext.Provider>
    );
};
