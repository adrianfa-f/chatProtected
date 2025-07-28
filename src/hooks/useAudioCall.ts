// src/hooks/useAudioCall.ts
import { useState, useRef, useEffect, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext'                       // retorna Socket | null
import { useAuth } from '../contexts/AuthContext'              // tu hook de auth
import { RTC_CONFIGURATION } from '../config/webrtc'               // fábrica de RTCPeerConnection

export function useAudioCall() {
    const socket = useSocket()                                  // Socket | null
    const { user } = useAuth()                                  // { id: string; … }

    const pcRef = useRef<RTCPeerConnection | null>(null)
    const peerIdRef = useRef<string | null>(null)
    const [isCalling, setIsCalling] = useState(false)
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)


    const startCall = useCallback(
        async (targetId: string) => {
            if (!socket || !user) throw new Error('Socket no inicializado')
            peerIdRef.current = targetId
            setIsCalling(true)

            // Capturar micrófono
            const local = await navigator.mediaDevices.getUserMedia({ audio: true })
            setLocalStream(local)
            local.getTracks().forEach(track => pcRef.current!.addTrack(track, local))

            // Crear y enviar oferta
            const offer = await pcRef.current!.createOffer()
            await pcRef.current!.setLocalDescription(offer)

            socket.emit('call-user', {
                from: user.id,
                to: targetId,
                sdp: offer.sdp,
            })
        },
        [socket, user]
    )

    const endCall = useCallback(() => {
        if (!socket || !user) return
        const target = peerIdRef.current
        socket.emit('end-call', { from: user.id, to: target })
        pcRef.current?.close()
        setIsCalling(false)
        setLocalStream(null)
        setRemoteStream(null)
    }, [socket, user])

    useEffect(() => {
        if (!socket || !user) return

        // 1) Crear PeerConnection
        const pc = new RTCPeerConnection(RTC_CONFIGURATION);
        pcRef.current = pc

        // 2) Enviar ICE candidates por socket
        const onIceCandidate = (evt: RTCPeerConnectionIceEvent) => {
            const candidate = evt.candidate
            const target = peerIdRef.current
            if (candidate && target) {
                socket.emit('ice-candidate', {
                    from: user.id,
                    to: target,
                    candidate,
                })
            }
        }
        pc.addEventListener('icecandidate', onIceCandidate)

        // 3) Recibir pistas remotas
        const remote = new MediaStream()
        setRemoteStream(remote)
        pc.addEventListener('track', ({ streams: [stream] }) => {
            stream.getTracks().forEach(track => remote.addTrack(track))
        })

        // 4) Listeners de socket
        const handleIncoming = async ({ from, sdp }: { from: string; sdp: string }) => {
            peerIdRef.current = from
            setIsCalling(true)

            // Captura micrófono
            const local = await navigator.mediaDevices.getUserMedia({ audio: true })
            setLocalStream(local)
            local.getTracks().forEach(track => pc.addTrack(track, local))

            // Responder oferta
            await pc.setRemoteDescription({ type: 'offer', sdp })
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            socket.emit('answer-call', {
                from: user.id,
                to: from,
                sdp: answer.sdp,
            })
        }

        const handleAnswer = async ({ sdp }: { sdp: string }) => {
            if (!pcRef.current) return
            await pcRef.current.setRemoteDescription({ type: 'answer', sdp })
        }

        const handleIce = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
            if (!pcRef.current || !candidate) return
            await pcRef.current.addIceCandidate(candidate)
        }

        const handleEnd = () => {
            endCall()
        }

        socket.on('incoming-call', handleIncoming)
        socket.on('call-answered', handleAnswer)
        socket.on('ice-candidate', handleIce)
        socket.on('call-ended', handleEnd)

        return () => {
            pc.close()
            socket.off('incoming-call', handleIncoming)
            socket.off('call-answered', handleAnswer)
            socket.off('ice-candidate', handleIce)
            socket.off('call-ended', handleEnd)
            setIsCalling(false)
            setLocalStream(null)
            setRemoteStream(null)
            peerIdRef.current = null
        }
    }, [socket, user, endCall])

    return {
        startCall,
        endCall,
        isCalling,
        localStream,
        remoteStream,
    }
}
