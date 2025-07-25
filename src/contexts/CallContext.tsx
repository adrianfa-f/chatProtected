import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useSocket } from './SocketContext';

interface CallContextType {
    callState: 'idle' | 'calling' | 'ringing' | 'in-progress';
    remoteUser: { id: string; username: string } | null;
    setRemoteUser: (user: { id: string; username: string } | null) => void;
    startCall: (userId: string, username: string) => void;
    endCall: () => void;
    acceptCall: () => void;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

/* eslint-disable-next-line react-refresh/only-export-components */
export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within a CallProvider');
    return context;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
    const socket = useSocket();
    const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'in-progress'>('idle');
    const [remoteUser, setRemoteUser] = useState<{ id: string; username: string } | null>(null);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);

    const setupPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                {
                    urls: 'turn:numb.viagenie.ca',
                    username: 'webrtc@live.com',
                    credential: 'muazkh'
                }
            ]
        });

        pc.onicecandidate = (e) => {
            console.log('[WebRTC] onicecandidate →', e.candidate);
            if (e.candidate && remoteUser?.id) {
                socket?.emit('webrtc-ice-candidate', {
                    to: remoteUser.id,
                    candidate: e.candidate
                });
            }
        };

        pc.onicegatheringstatechange = () => {
            console.log('[WebRTC] iceGatheringState →', pc.iceGatheringState);
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[WebRTC] iceConnectionState →', pc.iceConnectionState);
        };

        pc.onsignalingstatechange = () => {
            console.log('[WebRTC] signalingState →', pc.signalingState);
        };

        pc.ontrack = (e) => {
            console.log('[WebRTC] ontrack ← streams:', e.streams);
            setRemoteStream(e.streams[0]);
        };

        return pc;
    }, [socket, remoteUser?.id]);

    // Memoizar endCall para que tenga una referencia estable
    const endCall = useCallback(() => {
        // Notificar al otro usuario que la llamada ha terminado
        if (remoteUser) {
            socket?.emit('call-ended', { to: remoteUser.id });
        }

        // Limpiar recursos
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }

        setRemoteStream(null);
        setRemoteUser(null);
        setCallState('idle');
    }, [remoteUser, socket, localStream]); // Dependencias

    // Memoizar acceptCall para consistencia
    const acceptCall = useCallback(() => {
        if (remoteUser) {
            // Notificar al remitente que la llamada fue aceptada
            socket?.emit('call-accepted', { to: remoteUser.id });
            setCallState('in-progress');
        }
    }, [remoteUser, socket]);

    useEffect(() => {
        if (!socket) return;

        // Evento para recibir una llamada
        socket.on('incoming-call', ({ from, username }) => {
            setRemoteUser({ id: from, username });
            setCallState('ringing');
        });

        // Oferta recibida
        socket.on('webrtc-offer', async ({ from, offer }) => {
            try {
                // Solo inicializamos el stream si estamos en estado 'ringing'
                if (callState === 'ringing') {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    setLocalStream(stream);

                    const pc = setupPeerConnection();
                    peerConnection.current = pc;
                    stream.getTracks().forEach(track => pc.addTrack(track, stream));

                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    socket.emit('webrtc-answer', { to: from, answer });
                }
            } catch (err) {
                console.error('[CallContext] Error al manejar oferta:', err);
                endCall();
            }
        });

        // Respuesta recibida
        socket.on('webrtc-answer', async ({ answer }) => {
            try {
                if (peerConnection.current) {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
                    setCallState('in-progress');
                }
            } catch (err) {
                console.error('[CallContext] Error al aplicar respuesta:', err);
                endCall();
            }
        });

        // ICE candidate
        socket.on('webrtc-ice-candidate', async ({ from, candidate }) => {
            console.log('[WebRTC] ICE candidate recibido de', from, candidate);
            if (peerConnection.current) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('[WebRTC] Candidate añadido');
                } catch (err) {
                    console.error('[WebRTC] Error añadiendo candidate:', err);
                }
            }
        });

        // Llamada aceptada por el destinatario
        socket.on('call-accepted', () => {
            setCallState('in-progress');
        });

        // Llamada finalizada por el remitente
        socket.on('call-ended', () => {
            endCall();
        });

        return () => {
            socket.off('incoming-call');
            socket.off('webrtc-offer');
            socket.off('webrtc-answer');
            socket.off('webrtc-ice-candidate');
            socket.off('call-accepted');
            socket.off('call-ended');
        };
    }, [socket, setupPeerConnection, callState, endCall]); // Ahora endCall está incluido

    // Memoizar startCall para consistencia
    const startCall = useCallback(async (userId: string, username: string) => {
        setRemoteUser({ id: userId, username });
        setCallState('calling');

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);

        const pc = setupPeerConnection();
        peerConnection.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket?.emit('incoming-call', { to: userId, username });
        socket?.emit('webrtc-offer', { to: userId, offer });
    }, [setupPeerConnection, socket, setRemoteUser, setCallState]);

    return (
        <CallContext.Provider value={{
            callState,
            remoteUser,
            setRemoteUser,
            startCall,
            endCall,
            acceptCall,
            localStream,
            remoteStream
        }}>
            {children}
        </CallContext.Provider>
    );
};