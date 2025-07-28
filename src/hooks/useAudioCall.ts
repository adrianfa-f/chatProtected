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
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [inCall, setInCall] = useState(false);

    useEffect(() => {
        if (!socket) return;

        const pc = new RTCPeerConnection(RTC_CONFIGURATION);
        pcRef.current = pc;

        pc.ontrack = ({ streams }) => {
            console.log('[useAudioCall] ontrack → setRemoteStream');
            setRemoteStream(streams[0]);
        };

        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;
            console.log('[useAudioCall] Emitting ICE candidate', candidate);
            socket.emit('call:ice-candidate', {
                to: candidate.sdpMid, // realmente pondrás el ID de peer aquí
                candidate: candidate.toJSON()
            });
        };

        // Cuando llega la oferta
        const handleOffer = async ({ from, sdp }: OfferPayload) => {
            console.log('[useAudioCall] Received OFFER from', from);
            if (!pcRef.current) return;

            await pcRef.current.setRemoteDescription(sdp);
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);

            console.log('[useAudioCall] Sending ANSWER to', from);
            socket.emit('call:answer', { to: from, sdp: answer });

            setInCall(true);
        };

        // Cuando llega la respuesta
        const handleAnswer = async ({ from, sdp }: AnswerPayload) => {
            console.log('[useAudioCall] Received ANSWER from', from);
            if (!pcRef.current) return;
            await pcRef.current.setRemoteDescription(sdp);
            setInCall(true);
        };

        // Cuando llega un ICE candidate
        const handleIce = async ({ from, candidate }: IcePayload) => {
            console.log('[useAudioCall] Received ICE from', from, candidate);
            if (!pcRef.current) return;
            try {
                await pcRef.current.addIceCandidate(candidate);
            } catch (e) {
                console.warn('Error adding ICE candidate', e);
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
    }, [socket]);

    const startCall = useCallback(
        async (remoteId: string) => {
            if (!socket || !pcRef.current) {
                console.warn('Socket o PeerConnection no listos');
                return;
            }

            console.log('[useAudioCall] startCall → grabbing mic');
            const localStream = await getLocalAudio();
            localStream.getTracks().forEach(track =>
                pcRef.current!.addTrack(track, localStream)
            );

            console.log('[useAudioCall] Creating OFFER');
            const offer = await pcRef.current!.createOffer();
            await pcRef.current!.setLocalDescription(offer);

            console.log('[useAudioCall] Emitting OFFER to', remoteId);
            socket.emit('call:offer', { to: remoteId, sdp: offer });
        },
        [socket]
    );

    const endCall = useCallback(() => {
        console.log('[useAudioCall] endCall');
        pcRef.current?.close();
        setInCall(false);
        setRemoteStream(null);
    }, []);

    return { startCall, endCall, inCall, remoteStream };
}
