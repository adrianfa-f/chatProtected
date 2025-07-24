import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

export const useWebRTC = () => {
    const socket = useSocket();
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

        // 1️⃣ Escuchar oferta de WebRTC
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
            } catch (err) {
                console.error('[WebRTC] Error al recibir oferta:', err);
            }
        });

        // 2️⃣ Escuchar respuesta
        socket.on('webrtc-answer', async ({ answer }) => {
            try {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
                console.error('[WebRTC] Error al aplicar respuesta:', err);
            }
        });

        // 3️⃣ Escuchar ICE candidates
        socket.on('webrtc-ice-candidate', async ({ candidate }) => {
            try {
                await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error('[WebRTC] Error al agregar ICE candidate:', err);
            }
        });

        // Limpieza de listeners al desmontar
        return () => {
            socket.off('webrtc-offer');
            socket.off('webrtc-answer');
            socket.off('webrtc-ice-candidate');
        };
    }, [socket, setupPeerConnection]);

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