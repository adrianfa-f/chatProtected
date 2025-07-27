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
    const remoteUserRef = useRef(remoteUser);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const iceRestartTimeout = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const isCallIncoming = useRef(false);
    const socketRef = useRef(socket);

    useEffect(() => {
        socketRef.current = socket;
    }, [socket]);


    useEffect(() => {
        remoteUserRef.current = remoteUser;
    }, [remoteUser]);

    const endCall = useCallback(() => {
        console.log('[Call] Finalizando llamada...');

        // A. Resetear estados PRIMERO para evitar referencias nulas
        setCallState('idle');
        setIsMuted(false);

        // B. Limpiar timeouts
        if (iceRestartTimeout.current) {
            clearTimeout(iceRestartTimeout.current);
            iceRestartTimeout.current = null;
        }

        // C. Cerrar contexto de audio
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        // D. Notificar al otro usuario (si existe)
        if (remoteUser) {
            socket?.emit('call-ended', { to: remoteUser.id });
        }

        // E. Cerrar conexión peer
        if (peerConnection.current) {
            // Remover todos los listeners para prevenir fugas de memoria
            peerConnection.current.onicecandidate = null;
            peerConnection.current.oniceconnectionstatechange = null;
            peerConnection.current.onsignalingstatechange = null;
            peerConnection.current.onnegotiationneeded = null;
            peerConnection.current.ontrack = null;

            peerConnection.current.close();
            peerConnection.current = null;
        }

        // F. Detener y limpiar streams
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false; // Forzar deshabilitación física
            });
            setLocalStream(null);
        }

        if (remoteStream) {
            remoteStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            setRemoteStream(null);
        }

        // G. Resetear usuario remoto ÚLTIMO
        setRemoteUser(null);
        remoteUserRef.current = null;

        console.log('[Call] Llamada finalizada completamente');
    }, [remoteUser, socket, localStream, remoteStream]);

    const restartIce = useCallback(async () => {
        if (!peerConnection.current || !remoteUser) return;

        if (peerConnection.current.iceConnectionState === 'connected') {
            console.log('[WebRTC] ICE ya conectado, omitiendo reinicio');
            return;
        }

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
                if (peerConnection.current?.iceConnectionState !== 'connected' &&
                    peerConnection.current?.iceConnectionState !== 'completed') {
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
                console.log('[ICE] Enviando candidato:', e.candidate);
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

            // Manejar reconexión con timeout
            if (pc.iceConnectionState === 'disconnected') {
                setTimeout(() => {
                    if (pc.iceConnectionState !== 'connected') {
                        console.error('[WebRTC] Reconexión fallida, reiniciando ICE...');
                        restartIce();
                    }
                }, 2000);
            }
            else if (pc.iceConnectionState === 'failed') {
                console.error('[WebRTC] Conexión ICE fallida, reiniciando...');
                restartIce();
            }
        };

        pc.onsignalingstatechange = () => {
            console.log('[WebRTC] signalingState →', pc.signalingState);
        };

        // negociación inicial (solo si signalingState es 'stable')
        pc.onnegotiationneeded = async () => {
            if (pc.signalingState !== 'stable') {
                console.warn('[WebRTC] onnegotiationneeded ignorado (signalingState no es stable)');
                return;
            }

            console.log('[WebRTC] onnegotiationneeded disparado');

            try {
                // Usar ref en lugar de state para acceder al valor actual
                if (!remoteUserRef.current) {
                    console.error('[WebRTC] Error: remoteUser es null en onnegotiationneeded');
                    return;
                }

                const offer = await pc.createOffer({ iceRestart: false });
                await pc.setLocalDescription(offer);

                socketRef.current?.emit('webrtc-offer', {
                    to: remoteUserRef.current.id,
                    offer,
                    iceRestart: false
                });
            } catch (err) {
                console.error('[WebRTC] Error en onnegotiationneeded:', err);
            }
        };

        pc.ontrack = (e) => {
            console.log('[WebRTC] Track recibido:', e.track.kind,
                'Estado:', e.track.readyState,
                'Habilitado:', e.track.enabled);
            if (e.streams && e.streams.length > 0) {
                console.log('[WebRTC] Configurando stream remoto con ID:', e.streams[0].id);

                // Prevenir duplicados
                if (!remoteStream || remoteStream.id !== e.streams[0].id) {
                    const clonedStream = new MediaStream(e.streams[0].getTracks());
                    setRemoteStream(clonedStream);
                }

                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                }
            }
        };

        return pc;
    }, [socket, restartIce, remoteUser, remoteStream]);

    const acceptCall = useCallback(() => {
        if (remoteUser) {
            socket?.emit('call-accepted', { to: remoteUser.id });
            setCallState('in-progress');
        }
    }, [remoteUser, socket]);

    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = async ({ from, username }: { from: string; username: string }) => {

            isCallIncoming.current = true;

            if (callState !== 'idle') {
                socket.emit('call-ended', { to: from });
                return;
            }

            try {
                const hasMic = await verifyMicrophoneAccess();
                if (hasMic) {
                    const preloadStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            channelCount: 1,
                            sampleRate: 16000,
                            sampleSize: 16
                        }
                    });
                    // Nos aseguramos de que venga activo
                    preloadStream.getAudioTracks().forEach(t => t.enabled = true);
                    setLocalStream(preloadStream);
                    console.log('[Audio] Micrófono precargado y habilitado en receptor');
                }
            } catch (err) {
                console.warn('[Audio] No se pudo precargar micrófono:', err);
            }
            //
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
                // 1. Validar usuario remoto
                if (!remoteUser) {
                    console.warn('[WebRTC] Offer recibida sin remoteUser. Creando temporal...');
                    setRemoteUser({ id: from, username: 'Usuario Temporal' });
                }

                // 2. Inicializar conexión si es necesario
                if (!peerConnection.current) {
                    peerConnection.current = setupPeerConnection();
                }

                const pc = peerConnection.current;

                // 3. Añadir tracks locales si existen
                if (!iceRestart && localStream) {
                    localStream.getTracks().forEach(track => {
                        // Evitar duplicados
                        const existingSender = pc.getSenders().find(s => s.track === track);
                        if (!existingSender) {
                            console.log(`[WebRTC] Añadiendo track local: ${track.kind}`);
                            pc.addTrack(track, localStream);
                        }
                    });
                }

                // 4. Establecer descripción remota
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                console.log('[WebRTC] Offer remota establecida');

                // 5. Manejar respuesta para ofertas nuevas (no reinicios)
                if (!iceRestart) {
                    console.log('[WebRTC] Creando answer');
                    const answer = await pc.createAnswer();

                    // Esperar ICE gathering (vital para estabilidad)
                    await new Promise<void>((resolve) => {
                        if (pc.iceGatheringState === 'complete') {
                            resolve();
                        } else {
                            const handler = () => {
                                if (pc.iceGatheringState === 'complete') {
                                    pc.removeEventListener('icegatheringstatechange', handler);
                                    resolve();
                                }
                            };
                            pc.addEventListener('icegatheringstatechange', handler);
                        }
                    });

                    // 6. Establecer y enviar respuesta
                    console.log('[WebRTC] Setting localDescription (answer)');
                    await pc.setLocalDescription(answer);
                    console.log('[WebRTC] Enviando answer');
                    socket?.emit('webrtc-answer', { to: from, answer });
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
    }, [socket, setupPeerConnection, endCall, localStream, callState, remoteUser?.id, restartIce, remoteUser]);

    const startCall = useCallback(async (userId: string, username: string) => {
        // Usar ref para mantener el userId durante la operación asíncrona
        const targetUserId = userId;
        const targetUsername = username;

        remoteUserRef.current = { id: userId, username };

        // 1. Limpieza inicial
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            setLocalStream(null);
        }

        // 2. Establecer estado INMEDIATAMENTE
        setRemoteUser({ id: targetUserId, username: targetUsername });
        setCallState('calling');

        // 3. Verificar acceso a micrófono
        const hasMic = await verifyMicrophoneAccess();
        if (!hasMic) {
            console.error('[Audio] No se detectaron micrófonos disponibles');
            endCall();
            return;
        }

        try {
            // 4. Obtener permisos de micrófono (dos pasos para Android)
            await navigator.mediaDevices.getUserMedia({ audio: true });

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

            // 5. Activar tracks explícitamente
            stream.getAudioTracks().forEach(t => t.enabled = true);
            setLocalStream(stream);

            // 6. Configurar peer connection
            const pc = setupPeerConnection();
            peerConnection.current = pc;

            // 7. Añadir tracks locales
            stream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, stream);
                console.log(`[WebRTC] Track local añadido: ${track.kind}`, sender);
            });

            // 8. Crear oferta explícita
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });

            // 9. Esperar ICE gathering (CRÍTICO para Android)
            await new Promise<void>((resolve, reject) => {
                if (pc.iceGatheringState === 'complete') {
                    resolve();
                } else {
                    const timeout = setTimeout(() => {
                        pc.removeEventListener('icegatheringstatechange', handler);
                        reject(new Error('Tiempo de espera para ICE gathering excedido'));
                    }, 10000); // 10 segundos timeout

                    const handler = () => {
                        if (pc.iceGatheringState === 'complete') {
                            clearTimeout(timeout);
                            pc.removeEventListener('icegatheringstatechange', handler);
                            resolve();
                        }
                    };

                    pc.addEventListener('icegatheringstatechange', handler);
                }
            });

            // 10. Establecer descripción local
            await pc.setLocalDescription(offer);
            console.log('[WebRTC] Oferta local creada:', offer.sdp);

            // 11. Enviar eventos
            socket?.emit('incoming-call', { to: targetUserId, username: targetUsername });
            socket?.emit('webrtc-offer', { to: targetUserId, offer });
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
