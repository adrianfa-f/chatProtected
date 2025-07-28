import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { getLocalAudio } from '../utils/media'
import { RTC_CONFIGURATION } from '../config/webrtc'

type OfferPayload = { from: string; sdp: RTCSessionDescriptionInit }
type AnswerPayload = { from: string; sdp: RTCSessionDescriptionInit }
type IcePayload = { from: string; candidate: RTCIceCandidateInit }

export function useAudioCall() {
    const socket = useSocket()

    // Referencias mutables
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const localStreamRef = useRef<MediaStream | null>(null)

    // Estados de llamada
    const [inCall, setInCall] = useState(false)
    const [incomingCall, setIncomingCall] = useState(false)
    const [callerId, setCallerId] = useState<string | null>(null)
    const [offerSdp, setOfferSdp] = useState<RTCSessionDescriptionInit | null>(null)
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

    // Estado de silencio
    const [muted, setMuted] = useState(false)

    // Limpia todo el estado y las referencias
    const cleanup = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        setRemoteStream(null);
        setInCall(false);
        setIncomingCall(false);
        setCallerId(null);
        setOfferSdp(null);
        setMuted(false);
    }, []);

    // Manejo de offer entrante
    const handleOffer = useCallback(({ from, sdp }: OfferPayload) => {
        setCallerId(from)
        setOfferSdp(sdp)
        setIncomingCall(true)
    }, [])

    // Manejo de answer recibido
    const handleAnswer = useCallback(async ({ sdp }: AnswerPayload) => {
        if (pcRef.current && sdp) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp))
        }
    }, [])

    // Manejo de candidato ICE remoto
    const handleRemoteIce = useCallback(async ({ candidate }: IcePayload) => {
        if (pcRef.current && candidate) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
        }
    }, [])

    // Manejo de rechazo de llamada
    const handleReject = useCallback(() => {
        cleanup()
    }, [cleanup])

    // Manejo de colgado por parte del otro
    const handleHangUp = useCallback(() => {
        cleanup()
    }, [cleanup])

    // Registra y limpia listeners de señalización
    useEffect(() => {
        if (!socket) return

        socket.on('call:offer', handleOffer)
        socket.on('call:answer', handleAnswer)
        socket.on('call:ice-candidate', handleRemoteIce)
        socket.on('call:reject', handleReject)
        socket.on('call:hang-up', handleHangUp)

        return () => {
            socket.off('call:offer', handleOffer)
            socket.off('call:answer', handleAnswer)
            socket.off('call:ice-candidate', handleRemoteIce)
            socket.off('call:reject', handleReject)
            socket.off('call:hang-up', handleHangUp)
        }
    }, [socket, handleOffer, handleAnswer, handleRemoteIce, handleReject, handleHangUp])

    // Inicia la llamada (caller)
    const startCall = useCallback(async (remoteId: string) => {
        if (!socket) return;
        cleanup(); // Limpia cualquier llamada previa

        try {
            const localStream = await getLocalAudio();
            localStreamRef.current = localStream;

            const pc = new RTCPeerConnection(RTC_CONFIGURATION);
            pcRef.current = pc;

            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

            const inbound = new MediaStream();
            pc.ontrack = ({ track }) => {
                if (track.kind === 'audio') {
                    inbound.addTrack(track);
                    setRemoteStream(inbound);
                }
            };

            pc.onicecandidate = ({ candidate }) => {
                if (candidate && socket) {
                    socket.emit('call:ice-candidate', { to: remoteId, candidate });
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('call:offer', { to: remoteId, sdp: offer });

            setCallerId(remoteId); // Fijamos el callerId como el receptor
            setInCall(true);
        } catch (error) {
            console.error("Error al iniciar llamada:", error);
            cleanup();
        }
    }, [socket, cleanup]);

    // Acepta la llamada (callee)
    const acceptCall = useCallback(async () => {
        if (!socket || !callerId || !offerSdp) return

        const localStream = await getLocalAudio()
        localStreamRef.current = localStream

        const pc = new RTCPeerConnection(RTC_CONFIGURATION)
        pcRef.current = pc

        localStream.getTracks().forEach(track => pc.addTrack(track, localStream))

        const inbound = new MediaStream()
        pc.ontrack = ({ track }) => {
            inbound.addTrack(track)
            setRemoteStream(inbound)
        }

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                socket.emit('call:ice-candidate', { to: callerId, candidate })
            }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offerSdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('call:answer', { to: callerId, sdp: answer })

        setIncomingCall(false)
        setInCall(true)
    }, [socket, callerId, offerSdp])

    // Rechaza la llamada (callee)
    const rejectCall = useCallback(() => {
        if (socket && callerId) {
            socket.emit('call:reject', { to: callerId })
        }
        cleanup()
    }, [socket, callerId, cleanup])

    // Cuelga llamada desde cualquiera de los dos
    const endCall = useCallback(() => {
        if (socket && callerId) {
            socket.emit('call:hang-up', { to: callerId })
        }
        cleanup()
    }, [socket, callerId, cleanup])

    // Alterna silencio del micrófono
    const toggleMute = useCallback(() => {
        const stream = localStreamRef.current
        if (!stream) return

        stream.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled
            setMuted(!track.enabled)
        })
    }, [])

    return {
        inCall,
        incomingCall,
        callerId,
        remoteStream,
        muted,
        startCall,
        acceptCall,
        rejectCall,
        toggleMute,
        endCall
    }
}
