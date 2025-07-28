// src/hooks/useAudioCall.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { getLocalAudio } from '../utils/media';
import { RTC_CONFIGURATION } from '../config/webrtc';

type OfferPayload = { from: string; sdp: RTCSessionDescriptionInit };
type AnswerPayload = { from: string; sdp: RTCSessionDescriptionInit };
type IcePayload = { from: string; candidate: RTCIceCandidateInit };

export function useAudioCall() {
    const socket = useSocket();
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const remoteIdRef = useRef<string | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [inCall, setInCall] = useState(false);

    const createPeerConnection = useCallback(() => {
        // Cierra y limpia la instancia previa
        if (pcRef.current) {
            pcRef.current.getSenders().forEach(sender => sender.track?.stop());
            pcRef.current.close();
        }

        // Crea una nueva RTCPeerConnection
        const pc = new RTCPeerConnection(RTC_CONFIGURATION);
        pcRef.current = pc;

        // Manejo de tracks entrantes
        pc.ontrack = ({ streams }) => {
            console.log('[useAudioCall] ontrack → setRemoteStream');
            setRemoteStream(streams[0]);
        };

        // Envío de ICE candidates al peer correcto
        pc.onicecandidate = ({ candidate }) => {
            if (candidate && remoteIdRef.current) {
                console.log('[useAudioCall] Emitting ICE candidate', candidate);
                if (!socket) return;
                socket.emit('call:ice-candidate', {
                    to: remoteIdRef.current,
                    candidate: candidate.toJSON(),
                });
            }
        };

        // Debug de estado ICE
        pc.oniceconnectionstatechange = () => {
            console.log('[useAudioCall] ICE state:', pc.iceConnectionState);
        };

        return pc;
    }, [socket]);

    useEffect(() => {
        if (!socket) return;

        const handleOffer = async ({ from, sdp }: OfferPayload) => {
            console.log('[useAudioCall] Received OFFER from', from);
            remoteIdRef.current = from;

            // Asegura una PC activa
            const pc =
                !pcRef.current || pcRef.current.signalingState === 'closed'
                    ? createPeerConnection()
                    : pcRef.current;

            // Captura el stream de audio del receptor
            const localStream = await getLocalAudio();
            localStream.getTracks().forEach(track =>
                pc.addTrack(track, localStream)
            );

            // Responde la oferta
            await pc.setRemoteDescription(sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log('[useAudioCall] Sending ANSWER to', from);
            socket.emit('call:answer', { to: from, sdp: answer });
            setInCall(true);
        };

        const handleAnswer = async ({ from, sdp }: AnswerPayload) => {
            console.log('[useAudioCall] Received ANSWER from', from);
            if (!pcRef.current || pcRef.current.signalingState === 'closed') return;
            await pcRef.current.setRemoteDescription(sdp);
            setInCall(true);
        };

        const handleIce = async ({ from, candidate }: IcePayload) => {
            console.log('[useAudioCall] Received ICE from', from, candidate);
            if (!pcRef.current || pcRef.current.signalingState === 'closed') return;
            try {
                await pcRef.current.addIceCandidate(candidate);
            } catch (e) {
                console.warn('[useAudioCall] Error adding ICE candidate', e);
            }
        };

        socket.on('call:offer', handleOffer);
        socket.on('call:answer', handleAnswer);
        socket.on('call:ice-candidate', handleIce);

        return () => {
            pcRef.current?.close();
            socket.off('call:offer', handleOffer);
            socket.off('call:answer', handleAnswer);
            socket.off('call:ice-candidate', handleIce);
        };
    }, [socket, createPeerConnection]);

    const startCall = useCallback(
        async (remoteId: string) => {
            if (!socket) {
                console.warn('[useAudioCall] Socket not ready');
                return;
            }
            remoteIdRef.current = remoteId;
            const pc = createPeerConnection();

            console.log('[useAudioCall] startCall → grabbing mic');
            const localStream = await getLocalAudio();
            localStream.getTracks().forEach(track =>
                pc.addTrack(track, localStream)
            );

            console.log('[useAudioCall] Creating OFFER');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            console.log('[useAudioCall] Emitting OFFER to', remoteId);
            socket.emit('call:offer', { to: remoteId, sdp: offer });
        },
        [socket, createPeerConnection]
    );

    const endCall = useCallback(() => {
        console.log('[useAudioCall] endCall');
        if (pcRef.current) {
            pcRef.current.getSenders().forEach(sender => sender.track?.stop());
            pcRef.current.close();
            pcRef.current = null;
        }
        remoteIdRef.current = null;
        setInCall(false);
        setRemoteStream(null);
    }, []);

    return { startCall, endCall, inCall, remoteStream };
}
