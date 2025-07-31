// src/hooks/useAudioCall.ts
import { useState, useRef, useEffect, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext'    // retorna Socket | null
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'        // { id: string; … }
import { RTC_CONFIGURATION } from '../config/webrtc'     // TURN/STUN config

export function useAudioCall() {
    const socket = useSocket()
    const { user } = useAuth()
    const { activeChat } = useChat()

    // refs para PeerConnection, peer remoto y estado de llamada
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const peerIdRef = useRef<string | null>(null)
    const isCallingRef = useRef(false)

    // estado Reactivo
    const [collingUserName, setCollingUserName] = useState<string | null>(null);
    const [isCalling, setIsCalling] = useState(false)
    const [isRinging, setIsRinging] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

    // sincronizar ref con estado
    useEffect(() => {
        isCallingRef.current = isCalling
    }, [isCalling])

    // crea y configura un nuevo RTCPeerConnection por llamada
    const initPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(RTC_CONFIGURATION)
        pcRef.current = pc

        // preparar MediaStream para pistas remotas
        const remote = new MediaStream()
        setRemoteStream(remote)

        // al recibir pista remota, añadirla al stream
        pc.addEventListener('track', ({ streams: [stream] }) => {
            stream.getTracks().forEach(track => remote.addTrack(track))
        })

        // al generar ICE candidate, enviarlo al remoto
        pc.addEventListener('icecandidate', ({ candidate }) => {
            if (candidate && peerIdRef.current && socket && user) {
                socket.emit('ice-candidate', {
                    from: user.id,
                    to: peerIdRef.current,
                    candidate
                })
            }
        })

        return pc
    }, [socket, user])

    // limpia todo al colgar: detiene micrófono, cierra PC y resetea estados
    const cleanupCall = useCallback(() => {
        // detener micrófono
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop())
        }

        // detener pistas remotas
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop())
        }

        // cerrar PeerConnection
        if (pcRef.current) {
            pcRef.current.close()
            pcRef.current = null
        }

        // resetear refs y estados
        peerIdRef.current = null
        setLocalStream(null)
        setRemoteStream(null)
        setIsCalling(false)
        setIsRinging(false)
        setInCall(false)
    }, [localStream, remoteStream])

    const requestCall = useCallback((peerId: string) => {
        if (!socket || !user || !activeChat) return
        socket.emit("call-request", {
            from: user.id,
            to: peerId,
            userName: user.username,
            chatId: activeChat.id
        })
        peerIdRef.current = peerId
        setIsCalling(true)
    }, [socket, user, activeChat])


    // 1️⃣ startCall: quien inicia la llamada
    const startCall = useCallback(
        async (targetId: string) => {
            console.log("Comenzamos la llamada con: ", targetId)
            if (!socket || !user) throw new Error('Socket no inicializado')
            peerIdRef.current = targetId
            setIsRinging(false)
            setInCall(true)

            // crear nueva conexión
            const pc = initPeerConnection()

            // activar micrófono
            const local = await navigator.mediaDevices.getUserMedia({ audio: true })
            setLocalStream(local)
            local.getTracks().forEach(track => pc.addTrack(track, local))

            // oferta SDP
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            socket.emit('call-user', {
                from: user.id,
                to: targetId,
                sdp: offer.sdp
            })
        },
        [initPeerConnection, socket, user]
    )

    const cancelCall = useCallback(() => {
        if (!socket) return
        socket.emit('cancel-call', { to: peerIdRef.current })

        setIsCalling(false)
    }, [socket])

    const declineCall = useCallback(() => {
        if (!socket) return
        socket?.emit("decline-call", { to: peerIdRef.current })

        setIsRinging(false)
    }, [socket])

    // 2️⃣ endCall: cuelga la llamada
    const endCall = useCallback(() => {
        if (!socket || !user) return
        const target = peerIdRef.current
        console.log("PeerId al cerrar call: ", target)
        socket.emit('end-call', { from: user.id, to: target })
        cleanupCall()
    }, [socket, user, cleanupCall])

    // 3️⃣ Listeners de señalización (registrados una vez)
    useEffect(() => {
        if (!socket || !user) return

        const handleRequest = ({ from, userName }: { from: string, userName: string }) => {
            peerIdRef.current = from;
            setCollingUserName(userName)
            setIsRinging(true)
        }

        const handleIncoming = async ({ from, sdp }: { from: string; sdp: string }) => {
            peerIdRef.current = from
            setIsCalling(false)
            setInCall(true)
            console.log("IsCalling: ", isCalling)
            console.log("InCall: ", inCall)

            const pc = initPeerConnection()
            const local = await navigator.mediaDevices.getUserMedia({ audio: true })
            setLocalStream(local)
            local.getTracks().forEach(track => pc.addTrack(track, local))

            await pc.setRemoteDescription({ type: 'offer', sdp })
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            socket.emit('answer-call', {
                from: user.id,
                to: from,
                sdp: answer.sdp
            })
        }

        const handleAnswer = async ({ from, sdp }: { from: string; sdp: string }) => {
            if (peerIdRef.current !== from || !pcRef.current) return
            await pcRef.current.setRemoteDescription({ type: 'answer', sdp })
        }

        const handleIce = async ({
            from,
            candidate
        }: {
            from: string
            candidate: RTCIceCandidateInit
        }) => {
            if (peerIdRef.current !== from || !pcRef.current) return
            await pcRef.current.addIceCandidate(candidate)
        }

        const handleEnd = ({ from }: { from: string }) => {
            console.log("peerIdRef.current: ", peerIdRef.current)
            console.log("from: ", from)
            console.log("peerIdRef.current = from :", peerIdRef.current === from)
            if (peerIdRef.current !== from) return
            cleanupCall()
        }

        const handleDeclined = () => {
            console.log("Declined call")
            cleanupCall()
        }

        const handleCanceled = () => {
            console.log("Canceled call")
            cleanupCall()
        }

        socket.on('canceled-call', handleCanceled)
        socket.on('declined-call', handleDeclined)
        socket.on('call-request', handleRequest)
        socket.on('incoming-call', handleIncoming)
        socket.on('call-answered', handleAnswer)
        socket.on('ice-candidate', handleIce)
        socket.on('call-ended', handleEnd)

        return () => {
            socket.off('canceled-call', handleCanceled)
            socket.off('declined-call', handleDeclined)
            socket.off('call-request', handleRequest)
            socket.off('incoming-call', handleIncoming)
            socket.off('call-answered', handleAnswer)
            socket.off('ice-candidate', handleIce)
            socket.off('call-ended', handleEnd)
        }
    }, [socket, user, initPeerConnection, cleanupCall, inCall, isCalling])

    useEffect(() => {
        const handleServiceWorkerMessage = (event: MessageEvent) => {
            if (event.data.type === 'CALL_ACTION' && event.data.action === 'accept') {
                console.log('Aceptar llamada desde notificación');

                // 1. Establecer peerId del llamante
                peerIdRef.current = event.data.from;

                // 2. Actualizar estado para mostrar pantalla de llamada entrante
                setCollingUserName(event.data.username || 'Usuario');
                setIsRinging(true);

                // 3. (Opcional) Si ya tenemos el stream local, preparar llamada
                if (!localStream) {
                    navigator.mediaDevices.getUserMedia({ audio: true })
                        .then(stream => {
                            setLocalStream(stream);
                        })
                        .catch(console.error);
                }
            }
        };

        navigator.serviceWorker?.addEventListener(
            'message',
            handleServiceWorkerMessage
        );

        return () => {
            navigator.serviceWorker?.removeEventListener(
                'message',
                handleServiceWorkerMessage
            );
        };
    }, [setCollingUserName, setIsRinging, localStream]);

    return {
        peerIdRef,
        requestCall,
        startCall,
        endCall,
        isCalling,
        isRinging,
        inCall,
        declineCall,
        cancelCall,
        localStream,
        remoteStream,
        collingUserName
    }
}