// src/contexts/CallContext.tsx

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from 'react';
import { useSocket } from './SocketContext';

declare global {
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

interface CallContextType {
    callState: 'idle' | 'calling' | 'ringing' | 'in-progress';
    remoteUser: { id: string; username: string } | null;
    setRemoteUser: (user: { id: string; username: string } | null) => void;
    startCall: (userId: string, username: string) => void;
    endCall: () => void;
    acceptCall: () => void;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isMuted: boolean;
    toggleMute: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
    const socket = useSocket();
    const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'in-progress'>('idle');
    const [remoteUser, setRemoteUser] = useState<{ id: string; username: string } | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const iceRestartTimeout = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const isCallIncoming = useRef(false);

    const endCall = useCallback(() => {

        isCallIncoming.current = false;

        if (iceRestartTimeout.current) {
            clearTimeout(iceRestartTimeout.current);
            iceRestartTimeout.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (remoteUser) {
            socket?.emit('call-ended', { to: remoteUser.id });
        }

        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }

        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
            setRemoteStream(null);
        }

        setRemoteUser(null);
        setCallState('idle');
        setIsMuted(false);
    }, [remoteUser, socket, localStream, remoteStream]);

    const restartIce = useCallback(async () => {
        if (!peerConnection.current || !remoteUser) return;

        if (iceRestartTimeout.current) {
            clearTimeout(iceRestartTimeout.current);
            iceRestartTimeout.current = null;
        }

        try {
            console.log('[WebRTC] Reiniciando conexión ICE...');
            const offer = await peerConnection.current.createOffer({ iceRestart: true });
            await peerConnection.current.setLocalDescription(offer);

            socket?.emit('webrtc-offer', {
                to: remoteUser.id,
                offer,
                iceRestart: true
            });

            iceRestartTimeout.current = setTimeout(() => {
                if (peerConnection.current?.iceConnectionState !== 'connected') {
                    restartIce();
                }
            }, 5000);
        } catch (err) {
            console.error('[WebRTC] Error al reiniciar ICE:', err);
            endCall();
        }
    }, [socket, remoteUser, endCall]);

    const verifyMicrophoneAccess = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(device => device.kind === 'audioinput');
        } catch (error) {
            console.error('[Audio] Error verificando dispositivos:', error);
            return false;
        }
    };

    const setupPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                {
                    urls: 'turn:numb.viagenie.ca',
                    username: 'webrtc@live.com',
                    credential: 'muazkh'
                },
                {
                    urls: 'turn:global.relay.metered.ca:80',
                    username: 'c13a8f6b6b3f6a7f3e9d0d7c',
                    credential: '1B+5CJkTPqly1P4I'
                }
            ],
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        });

        // envío de candidates ICE tras setLocalDescription
        pc.onicecandidate = (e) => {
            if (e.candidate && remoteUser?.id) {
                socket?.emit('webrtc-ice-candidate', {
                    to: remoteUser.id,
                    candidate: e.candidate
                });
            }
            if (e.candidate === null) {
                console.log('[ICE] Todos los candidates locales enviados');
            }
        };

        pc.onicegatheringstatechange = () => {
            console.log('[WebRTC] iceGatheringState →', pc.iceGatheringState);
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[WebRTC] iceConnectionState →', pc.iceConnectionState);
            if (pc.iceConnectionState === 'disconnected' ||
                pc.iceConnectionState === 'failed') {
                console.error('[WebRTC] Conexión ICE fallida, intentando reiniciar...');
                restartIce();
            }
        };

        pc.onsignalingstatechange = () => {
            console.log('[WebRTC] signalingState →', pc.signalingState);
        };

        // negociación inicial (solo si signalingState es 'stable')
        pc.onnegotiationneeded = async () => {
            if (pc.signalingState !== 'stable') return;
            console.log('[WebRTC] onnegotiationneeded disparado');
            const offer = await pc.createOffer({ iceRestart: false });
            await pc.setLocalDescription(offer);
            socket?.emit('webrtc-offer', {
                to: remoteUser!.id,
                offer,
                iceRestart: false
            });
        };

        pc.ontrack = (e) => {
            console.log('[WebRTC] Track recibido:', e.track.kind,
                'Estado:', e.track.readyState,
                'Habilitado:', e.track.enabled);
            if (e.streams && e.streams.length > 0) {
                console.log('[WebRTC] Configurando stream remoto con ID:', e.streams[0].id);
                const clonedStream = new MediaStream(e.streams[0].getTracks());
                setRemoteStream(clonedStream);

                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                }
            }
        };

        pc.addTransceiver('audio', { direction: 'sendrecv' });
        return pc;
    }, [socket, restartIce, remoteUser]);

    const acceptCall = useCallback(() => {
        if (remoteUser) {
            socket?.emit('call-accepted', { to: remoteUser.id });
            setCallState('in-progress');
        }
    }, [remoteUser, socket]);

    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = ({ from, username }: { from: string; username: string }) => {

            isCallIncoming.current = true;

            if (callState !== 'idle') {
                socket.emit('call-ended', { to: from });
                return;
            }
            setRemoteUser({ id: from, username });
            setCallState('ringing');
        };

        const handleWebRTCOffer = async ({
            from,
            offer,
            iceRestart
        }: {
            from: string;
            offer: RTCSessionDescriptionInit;
            iceRestart?: boolean;
        }) => {
            try {

                if (!iceRestart && !isCallIncoming.current) {
                    console.warn('[WebRTC] Offer recibida sin incoming-call → ignorando');
                    return;
                }

                if (callState !== 'ringing' && callState !== 'in-progress' && !iceRestart) return;

                if (!iceRestart) {
                    const hasMic = await verifyMicrophoneAccess();
                    if (!hasMic) {
                        console.error('[Audio] No hay micrófonos disponibles (callee)');
                        endCall();
                        return;
                    }
                    if (localStream) {
                        localStream.getTracks().forEach(track => track.stop());
                        setLocalStream(null);
                    }
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            channelCount: 1,
                            sampleRate: 16000,
                            sampleSize: 16
                        }
                    });
                    setLocalStream(stream);
                }

                if (!peerConnection.current || !iceRestart) {
                    if (peerConnection.current) peerConnection.current.close();
                    peerConnection.current = setupPeerConnection();
                }

                const pc = peerConnection.current!;

                if (!iceRestart && localStream) {
                    localStream.getTracks().forEach(track => {
                        const sender = pc.addTrack(track, localStream);
                        console.log(`[WebRTC] Track local añadido (callee): ${track.kind}`, sender);
                    });
                }

                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                console.log('[WebRTC] Offer remota establecida');

                if (!iceRestart) {
                    console.log('[WebRTC] Creando answer');
                    const answer = await pc.createAnswer();
                    console.log('[WebRTC] Setting localDescription (answer)');
                    await pc.setLocalDescription(answer);
                    console.log('[WebRTC] Enviando answer');
                    socket.emit('webrtc-answer', { to: from, answer });
                }

            } catch (err) {
                console.error('[CallContext] Error al manejar oferta:', err);
                endCall();
            }
        };

        const handleWebRTCAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit; from: string }) => {
            try {
                const pc = peerConnection.current;
                if (!pc) return;
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('[WebRTC] Respuesta remota establecida');
                setCallState('in-progress');
            } catch (err) {
                console.error('[CallContext] Error al aplicar respuesta:', err);
                endCall();
            }
        };

        const handleWebRTCIceCandidate = async ({ candidate, from }: { candidate: RTCIceCandidateInit; from: string }) => {
            if (!peerConnection.current || !candidate || remoteUser?.id !== from) return;
            try {
                console.log('[WebRTC] ICE candidate recibido de', from, candidate);
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('[WebRTC] Candidate añadido exitosamente');
            } catch (err) {
                console.error('[WebRTC] Error añadiendo candidate:', err);
            }
        };

        const handleCallAccepted = () => setCallState('in-progress');
        const handleCallEnded = () => endCall();
        const handleProceedWithWebRTC = () => {
            if (peerConnection.current) restartIce();
        };
        const handlePeerDisconnected = ({ userId }: { userId: string }) => {
            if (remoteUser?.id === userId) {
                endCall();
            }
        };

        socket.on('incoming-call', handleIncomingCall);
        socket.on('webrtc-offer', handleWebRTCOffer);
        socket.on('webrtc-answer', handleWebRTCAnswer);
        socket.on('webrtc-ice-candidate', handleWebRTCIceCandidate);
        socket.on('call-accepted', handleCallAccepted);
        socket.on('call-ended', handleCallEnded);
        socket.on('proceed-with-webrtc', handleProceedWithWebRTC);
        socket.on('peer-disconnected', handlePeerDisconnected);

        return () => {
            socket.off('incoming-call', handleIncomingCall);
            socket.off('webrtc-offer', handleWebRTCOffer);
            socket.off('webrtc-answer', handleWebRTCAnswer);
            socket.off('webrtc-ice-candidate', handleWebRTCIceCandidate);
            socket.off('call-accepted', handleCallAccepted);
            socket.off('call-ended', handleCallEnded);
            socket.off('proceed-with-webrtc', handleProceedWithWebRTC);
            socket.off('peer-disconnected', handlePeerDisconnected);
        };
    }, [socket, setupPeerConnection, endCall, localStream, callState, remoteUser?.id, restartIce]);

    const startCall = useCallback(async (userId: string, username: string) => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }

        setRemoteUser({ id: userId, username });
        setCallState('calling');

        const hasMic = await verifyMicrophoneAccess();
        if (!hasMic) {
            console.error('[Audio] No se detectaron micrófonos disponibles');
            endCall();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 16000,
                    sampleSize: 16
                }
            });
            setLocalStream(stream);

            const pc = setupPeerConnection();
            peerConnection.current = pc;

            stream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, stream);
                console.log(`[WebRTC] Track local añadido: ${track.kind}`, sender);
            });

            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            await pc.setLocalDescription(offer);
            console.log('[WebRTC] Oferta local creada:', offer.sdp);

            socket?.emit('incoming-call', { to: userId, username });
            socket?.emit('webrtc-offer', { to: userId, offer });
        } catch (err) {
            console.error('[CallContext] Error al iniciar llamada:', err);
            endCall();
        }
    }, [setupPeerConnection, socket, endCall, localStream]);

    const toggleMute = useCallback(() => {
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                audioTracks[0].enabled = !audioTracks[0].enabled;
                setIsMuted(!audioTracks[0].enabled);
            }
        }
    }, [localStream]);

    return (
        <CallContext.Provider
            value={{
                callState,
                remoteUser,
                setRemoteUser,
                startCall,
                endCall,
                acceptCall,
                localStream,
                remoteStream,
                isMuted,
                toggleMute
            }}
        >
            {children}
        </CallContext.Provider>
    );
};

/* eslint-disable-next-line react-refresh/only-export-components */
export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within a CallProvider');
    return context;
};
