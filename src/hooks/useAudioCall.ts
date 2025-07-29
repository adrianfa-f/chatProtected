// src/hooks/useAudioCall.ts
import {
    useReducer,
    useState,
    useRef,
    useEffect,
    useCallback
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Socket } from 'socket.io-client'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { RTC_CONFIGURATION } from '../config/webrtc'
import { getLocalAudio, stopLocalAudio } from '../utils/media'

// 1) Estado y acciones
type CallStateType = 'idle' | 'calling' | 'ringing' | 'inCall'

interface CallState {
    callState: CallStateType
    callId: string | null
    peerId: string | null
    isCaller: boolean
    error: string | null
}

type CallAction =
    | { type: 'REQUEST'; payload: { callId: string; peerId: string } }
    | { type: 'RECEIVE'; payload: { callId: string; from: string } }
    | { type: 'ACCEPT' }
    | { type: 'DECLINE' }
    | { type: 'CANCEL' }
    | { type: 'END' }
    | { type: 'TIMEOUT' }
    | { type: 'ERROR'; payload: { message: string } }

const initialCallState: CallState = {
    callState: 'idle',
    callId: null,
    peerId: null,
    isCaller: false,
    error: null
}

function callReducer(state: CallState, action: CallAction): CallState {
    switch (action.type) {
        case 'REQUEST':
            return {
                callState: 'calling',
                callId: action.payload.callId,
                peerId: action.payload.peerId,
                isCaller: true,
                error: null
            }
        case 'RECEIVE':
            return {
                callState: 'ringing',
                callId: action.payload.callId,
                peerId: action.payload.from,
                isCaller: false,
                error: null
            }
        case 'ACCEPT':
            if (state.callState !== 'ringing') return state
            return { ...state, callState: 'inCall', error: null }
        case 'DECLINE':
        case 'CANCEL':
        case 'END':
        case 'TIMEOUT':
            return initialCallState
        case 'ERROR':
            return { ...initialCallState, error: action.payload.message }
        default:
            return state
    }
}

// 2) Payloads de socket
interface CallRequestPayload { callId: string; from: string; to: string }
interface CallSignalPayload { callId: string; from: string; to: string; type: 'call-cancel' | 'call-decline' | 'call-end' }
interface CallSdpPayload { callId: string; sdp: string; type: 'offer' | 'answer'; from: string; to: string }
interface IceCandidatePayload { callId: string; candidate: RTCIceCandidateInit; from: string; to: string }

// 3) la API que expone el hook
export interface UseAudioCallApi {
    status: CallStateType
    callId: string | null
    peerId: string | null
    error: string | null
    localStream: MediaStream | null
    remoteStream: MediaStream | null
    requestCall: (peerId: string) => void
    cancelCall: () => void
    acceptCall: () => void
    declineCall: () => void
    endCall: () => void
}

export function useAudioCall(): UseAudioCallApi {
    const socket = useSocket() as Socket
    const { user } = useAuth()
    const [state, dispatch] = useReducer(callReducer, initialCallState)
    const { callState: status, callId, peerId, isCaller } = state

    const pcRef = useRef<RTCPeerConnection | null>(null)
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

    // Cola de candidatos antes de setRemoteDescription
    const pendingIce = useRef<RTCIceCandidateInit[]>([])

    // Fabrica la RTCPeerConnection
    const initPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(RTC_CONFIGURATION)
        pcRef.current = pc

        // remote stream
        const remote = new MediaStream()
        setRemoteStream(remote)
        pc.ontrack = (evt: RTCTrackEvent) => {
            const [s] = evt.streams
            s.getTracks().forEach(t => remote.addTrack(t))
        }

        // candidates locales
        pc.onicecandidate = (evt: RTCPeerConnectionIceEvent) => {
            const cand = evt.candidate?.toJSON()
            if (cand && callId && peerId && user) {
                socket.emit('ice-candidate', {
                    callId,
                    candidate: cand,
                    from: user.id,
                    to: peerId
                } as IceCandidatePayload)
            }
        }

        return pc
    }, [socket, callId, peerId, user])

    // Limpieza al colgar o cancelar
    const cleanup = useCallback(() => {
        if (localStream) stopLocalAudio(localStream)
        pcRef.current?.close()
        pcRef.current = null
        setLocalStream(null)
        setRemoteStream(null)
        pendingIce.current = []
    }, [localStream])

    // 4) Manejadores de socket (montaje único)
    useEffect(() => {
        if (!socket || !user) return

        // A. Request
        const onRequest = (p: CallRequestPayload) => {
            if (p.to !== user.id) return
            dispatch({ type: 'RECEIVE', payload: { callId: p.callId, from: p.from } })
        }

        // B. Cancel / Decline / End
        const onSignal = (p: CallSignalPayload) => {
            if (p.callId !== callId) return
            dispatch({
                type: p.type === 'call-cancel' ? 'CANCEL' :
                    p.type === 'call-decline' ? 'DECLINE' :
                        p.type === 'call-end' ? 'END' : 'CANCEL'
            })
            if (!isCaller) cleanup()  // si soy callee, apago el mic
        }

        // C. SDP
        const onSdp = async (p: CallSdpPayload) => {
            if (p.callId !== callId) return

            if (p.type === 'offer') {
                // SOLO el callee responde
                const pc = initPeerConnection()
                const local = await getLocalAudio()
                setLocalStream(local)
                local.getTracks().forEach(t => pc.addTrack(t, local))

                await pc.setRemoteDescription({ type: 'offer', sdp: p.sdp })
                pendingIce.current.forEach(c => pc.addIceCandidate(c))
                pendingIce.current = []

                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)

                socket.emit('call-sdp', {
                    callId: p.callId,
                    sdp: answer.sdp!,
                    type: 'answer',
                    from: user.id,
                    to: p.from
                } as CallSdpPayload)

            } else {
                // SOLO el caller atiende el answer
                await pcRef.current?.setRemoteDescription({ type: 'answer', sdp: p.sdp })
                pendingIce.current.forEach(c => pcRef.current?.addIceCandidate(c))
                pendingIce.current = []
            }
        }

        // D. ICE
        const onIce = (p: IceCandidatePayload) => {
            if (p.callId !== callId) return
            const c = new RTCIceCandidate(p.candidate)
            if (pcRef.current?.remoteDescription) {
                pcRef.current.addIceCandidate(c)
            } else {
                pendingIce.current.push(p.candidate)
            }
        }

        socket.on('call-request', onRequest)
        socket.on('call-cancel', onSignal)
        socket.on('call-decline', onSignal)
        socket.on('call-end', onSignal)
        socket.on('call-sdp', onSdp)
        socket.on('ice-candidate', onIce)

        return () => {
            socket.off('call-request', onRequest)
            socket.off('call-cancel', onSignal)
            socket.off('call-decline', onSignal)
            socket.off('call-end', onSignal)
            socket.off('call-sdp', onSdp)
            socket.off('ice-candidate', onIce)
        }
    }, [socket, user, callId, initPeerConnection, cleanup, isCaller])

    // 5) Funciones UI ↔ señalización

    // Caller dispara la offer inmediatamente al pedir la llamada
    const requestCall = useCallback((targetId: string) => {
        if (!socket || !user) return
        const id = uuidv4()
        dispatch({ type: 'REQUEST', payload: { callId: id, peerId: targetId } })

        // notificar a callee
        socket.emit('call-request', { callId: id, from: user.id, to: targetId } as CallRequestPayload)

        // generar la offer SDP
        const pc = initPeerConnection()
        getLocalAudio().then(stream => {
            setLocalStream(stream)
            stream.getTracks().forEach(t => pc.addTrack(t, stream))
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer).then(() => {
                    socket.emit('call-sdp', {
                        callId: id,
                        sdp: offer.sdp!,
                        type: 'offer',
                        from: user.id,
                        to: targetId
                    } as CallSdpPayload)
                })
            })
        })

        // timeout 30s
        setTimeout(() => {
            if (state.callState === 'calling' && state.callId === id) {
                dispatch({ type: 'TIMEOUT' })
                socket.emit('call-cancel', { callId: id, from: user.id, to: targetId } as CallSignalPayload)
            }
        }, 30_000)
    }, [socket, user, initPeerConnection, state])

    const acceptCall = useCallback(() => {
        if (!socket || status !== 'ringing' || !peerId) return
        dispatch({ type: 'ACCEPT' })
        // no generamos offer aquí
        // el answer se enviará al llegar el offer en onSdp
    }, [socket, status, peerId])

    const declineCall = useCallback(() => {
        if (!socket || status !== 'ringing' || !peerId || !user) return
        socket.emit('call-decline', { callId, from: user.id, to: peerId } as CallSignalPayload)
        dispatch({ type: 'DECLINE' })
    }, [socket, status, callId, peerId, user])

    const cancelCall = useCallback(() => {
        if (!socket || status !== 'calling' || !peerId || !user) return
        socket.emit('call-cancel', { callId, from: user.id, to: peerId } as CallSignalPayload)
        dispatch({ type: 'CANCEL' })
    }, [socket, status, callId, peerId, user])

    const endCall = useCallback(() => {
        if (!socket || status !== 'inCall' || !peerId || !user) return
        socket.emit('call-end', { callId, from: user.id, to: peerId } as CallSignalPayload)
        dispatch({ type: 'END' })
    }, [socket, status, callId, peerId, user])

    return {
        status,
        callId,
        peerId,
        error: state.error,
        localStream,
        remoteStream,
        requestCall,
        acceptCall,
        declineCall,
        cancelCall,
        endCall
    }
}
