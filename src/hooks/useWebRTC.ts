import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useCall } from '../contexts/CallContext';

export const useWebRTC = () => {
    const socket = useSocket();
    const { setRemoteUser, acceptCall } = useCall();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);

    // Configurar conexión WebRTC
    const setupPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket?.emit('webrtc-ice-candidate', {
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        return pc;
    }, [socket]);

    useEffect(() => {
        if (!socket) return;

        // Oferta recibida: preparar conexión y responder
        socket.on('webrtc-offer', async ({ from, offer }) => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setLocalStream(stream);

                const pc = setupPeerConnection();
                peerConnection.current = pc;

                stream.getTracks().forEach(track => pc.addTrack(track, stream));
                await pc.setRemoteDescription(new RTCSessionDescription(offer));

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('webrtc-answer', { to: from, answer });

                // ✅ Activar pantalla de llamada entrante
                setRemoteUser({ id: from, username: 'Desconocido' });
                acceptCall(); // Establece callState = 'in-progress'
            } catch (err) {
                console.error('[WebRTC] Error al recibir oferta:', err);
            }
        });

        // Respuesta recibida: completar conexión
        socket.on('webrtc-answer', async ({ answer }) => {
            try {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
                console.error('[WebRTC] Error al aplicar respuesta:', err);
            }
        });

        // ICE Candidate recibido
        socket.on('webrtc-ice-candidate', async ({ candidate }) => {
            try {
                await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error('[WebRTC] Error al agregar ICE candidate:', err);
            }
        });

        return () => {
            socket.off('webrtc-offer');
            socket.off('webrtc-answer');
            socket.off('webrtc-ice-candidate');
        };
    }, [socket, setupPeerConnection, acceptCall, setRemoteUser]);

    // Iniciar llamada
    const startCall = useCallback(async (remoteUserId: string) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);

            const pc = setupPeerConnection();
            peerConnection.current = pc;

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket?.emit('webrtc-offer', {
                to: remoteUserId,
                offer
            });
        } catch (error) {
            console.error('Error al iniciar llamada:', error);
        }
    }, [setupPeerConnection, socket]);

    // Finalizar llamada
    const endCall = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
    }, [localStream]);

    return { localStream, remoteStream, startCall, endCall };
};