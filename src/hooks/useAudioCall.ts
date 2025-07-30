// src/hooks/useAudioCall.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { RTC_CONFIGURATION } from '../config/webrtc';

export function useAudioCall() {
    const socket = useSocket();
    const { user } = useAuth();

    // Estados
    const [isCalling, setIsCalling] = useState(false);
    const [isRinging, setIsRinging] = useState(false);
    const [peerId, setPeerId] = useState<string | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    // Referencias
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const peerIdRef = useRef<string | null>(null);

    // Crear PeerConnection
    const initPeerConnection = useCallback((): RTCPeerConnection => {
        const pc = new RTCPeerConnection(RTC_CONFIGURATION);
        pcRef.current = pc;

        // Preparar stream remoto
        const remote = new MediaStream();
        setRemoteStream(remote);

        // Manejar tracks entrantes
        pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach(track => remote.addTrack(track));
        };

        // Manejar candidatos ICE
        pc.onicecandidate = (event) => {
            if (event.candidate && peerIdRef.current && socket && user) {
                socket.emit('ice-candidate', {
                    from: user.id,
                    to: peerIdRef.current,
                    candidate: event.candidate.toJSON()
                });
            }
        };

        return pc;
    }, [socket, user]);

    const requestCall = useCallback((targetId: string) => {
        if (!socket || !user) return;

        setIsCalling(true);
        setPeerId(targetId);
        peerIdRef.current = targetId;

        // Solo envía la solicitud, sin iniciar WebRTC aún
        socket.emit('call-request', {
            from: user.id,
            to: targetId
        });
    }, [socket, user]);

    // Limpiar llamada
    const cleanupCall = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
        }
        if (pcRef.current) {
            pcRef.current.close();
        }
        setLocalStream(null);
        setRemoteStream(null);
        setPeerId(null);
        setIsCalling(false);
        setIsRinging(false);
        peerIdRef.current = null;
    }, [localStream, remoteStream]);

    // Iniciar llamada
    const startCall = useCallback(async () => {
        if (!socket || !user || !peerIdRef.current) return;

        try {
            const pc = initPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket.emit('call-start', {
                from: user.id,
                to: peerIdRef.current,
                sdp: offer.sdp
            });
        } catch (err) {
            console.error('Error al iniciar llamada:', err);
            cleanupCall();
        }
    }, [socket, user, initPeerConnection, cleanupCall]);


    // Finalizar llamada
    const endCall = useCallback(() => {
        if (!socket || !user || !peerIdRef.current) return;

        socket.emit('end-call', {
            from: user.id,
            to: peerIdRef.current
        });
        cleanupCall();
    }, [socket, user, cleanupCall]);

    // Aceptar llamada entrante
    const acceptCall = useCallback(async () => {
        if (!pcRef.current || !peerIdRef.current || !socket || !user) return;

        try {
            setIsRinging(false);
            setIsCalling(true);

            // Crear stream local
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            stream.getTracks().forEach(track => pcRef.current?.addTrack(track, stream));

            // Crear y enviar respuesta
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);

            socket.emit('answer-call', {
                from: user.id,
                to: peerIdRef.current,
                sdp: answer.sdp
            });
        } catch (err) {
            console.error('Error al aceptar llamada:', err);
            cleanupCall();
        }
    }, [socket, user, cleanupCall]);

    // Rechazar llamada
    const declineCall = useCallback(() => {
        if (!socket || !user || !peerIdRef.current) return;

        socket.emit('decline-call', {
            from: user.id,
            to: peerIdRef.current
        });
        cleanupCall();
    }, [socket, user, cleanupCall]);

    // Escuchar eventos de socket
    useEffect(() => {
        if (!socket || !user) return;

        const handleIncomingCall = (data: { from: string }) => {
            if (isCalling) return;

            setIsRinging(true);
            setPeerId(data.from);
            peerIdRef.current = data.from;
        };

        const handleStartCall = async (data: { from: string; sdp: string }) => {
            if (isCalling) return;

            try {
                setIsCalling(true);
                setIsRinging(false);

                const pc = initPeerConnection();
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setLocalStream(stream);
                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('call-answer', {
                    from: user.id,
                    to: data.from,
                    sdp: answer.sdp
                });
            } catch (err) {
                console.error('Error al recibir llamada:', err);
                cleanupCall();
            }
        };

        const handleAnsweredCall = (data: { from: string; sdp: string }) => {
            if (pcRef.current && peerIdRef.current === data.from) {
                pcRef.current.setRemoteDescription({ type: 'answer', sdp: data.sdp });
            }
        };

        const handleIceCandidate = (data: { from: string; candidate: RTCIceCandidateInit }) => {
            if (pcRef.current && peerIdRef.current === data.from) {
                const candidate = new RTCIceCandidate(data.candidate);
                pcRef.current.addIceCandidate(candidate);
            }
        };

        const handleEndCall = () => {
            cleanupCall();
        };

        const handleDeclinedCall = () => {
            cleanupCall();
        };

        socket.on('call-request', handleIncomingCall);
        socket.on('call-start', handleStartCall);
        socket.on('call-answered', handleAnsweredCall);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('call-ended', handleEndCall);
        socket.on('call-declined', handleDeclinedCall);

        return () => {
            socket.off('incoming-call', handleIncomingCall);
            socket.off('call-start', handleStartCall);
            socket.off('call-answered', handleAnsweredCall);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('call-ended', handleEndCall);
            socket.off('call-declined', handleDeclinedCall);
        };
    }, [socket, user, isCalling, initPeerConnection, cleanupCall]);

    return {
        isCalling,
        isRinging,
        peerId,
        localStream,
        remoteStream,
        requestCall,
        startCall,
        endCall,
        acceptCall,
        declineCall
    };
}