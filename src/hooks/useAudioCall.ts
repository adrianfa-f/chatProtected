// src/hooks/useAudioCall.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { getLocalAudio } from '../utils/media';
import { RTC_CONFIGURATION } from '../config/webrtc';

/** Lo que recibo del socket cuando alguien me llama / responde / envía candidate */
type ReceiveOffer = { from: string; sdp: RTCSessionDescriptionInit };
type ReceiveAnswer = { from: string; sdp: RTCSessionDescriptionInit };
type ReceiveIce = { from: string; candidate: RTCIceCandidateInit };

/** Lo que envío por socket: siempre ‘to’ y nunca ‘from’ */
type EmitOffer = { to: string; sdp: RTCSessionDescriptionInit };
type EmitAnswer = { to: string; sdp: RTCSessionDescriptionInit };
type EmitIce = { to: string; candidate: RTCIceCandidateInit };

export function useAudioCall(remoteId: string) {
    const { user } = useAuth();
    const socket = useSocket();
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [inCall, setInCall] = useState(false);

    useEffect(() => {
        if (!socket || !user?.id) return;
        const pc = new RTCPeerConnection(RTC_CONFIGURATION);
        pcRef.current = pc;

        // 1) Captura el stream remoto
        pc.ontrack = ({ streams }) => setRemoteStream(streams[0]);

        // 2) Emite ICE candidates
        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;
            const payload: EmitIce = {
                to: remoteId,
                candidate: candidate.toJSON()
            };
            console.log('[useAudioCall] Emitting ICE candidate', candidate);
            socket.emit('call:ice-candidate', payload);
        };

        // 3) Manejadores de eventos entrantes
        const handleOffer = async ({ from, sdp }: ReceiveOffer) => {
            if (from !== remoteId) return;

            console.log('[useAudioCall] Received offer from', from);

            await pc.setRemoteDescription(sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            const payload: EmitAnswer = { to: from, sdp: answer };
            socket.emit('call:answer', payload);
            setInCall(true);
        };

        const handleAnswer = async ({ from, sdp }: ReceiveAnswer) => {
            if (from !== remoteId) return;

            console.log('[useAudioCall] Received answer from', from);

            await pc.setRemoteDescription(sdp);
            setInCall(true);
        };

        const handleIce = async ({ from, candidate }: ReceiveIce) => {
            if (from !== remoteId) return;

            console.log('[useAudioCall] Received ICE candidate from', from, candidate);

            try {
                await pc.addIceCandidate(candidate);
            } catch (e) {
                console.warn('Error añadiendo ICE candidate', e);
            }
        };

        socket.on('call:offer', handleOffer);
        socket.on('call:answer', handleAnswer);
        socket.on('call:ice-candidate', handleIce);

        return () => {
            pc.close();
            socket.off('call:offer', handleOffer);
            socket.off('call:answer', handleAnswer);
            socket.off('call:ice-candidate', handleIce);
        };
    }, [socket, user?.id, remoteId]);

    // Inicia la llamada
    const startCall = useCallback(async () => {
        if (!socket || !pcRef.current) return;
        const localStream = await getLocalAudio();
        localStream.getTracks().forEach(track =>
            pcRef.current!.addTrack(track, localStream)
        );
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);

        const payload: EmitOffer = { to: remoteId, sdp: offer };
        socket.emit('call:offer', payload);
    }, [socket, remoteId]);

    // Termina la llamada
    const endCall = useCallback(() => {
        pcRef.current?.close();
        setInCall(false);
        setRemoteStream(null);
    }, []);

    return { startCall, endCall, inCall, remoteStream };
}
