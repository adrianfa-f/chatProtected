// src/hooks/useAudioCall.ts
import { useReducer, useState, useRef, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Socket } from 'socket.io-client'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { RTC_CONFIGURATION } from '../config/webrtc'
import { getLocalAudio, stopLocalAudio } from '../utils/media'

// —— 1. Define tipos de estado y acciones —————————————————————
type CallStateType = 'idle' | 'calling' | 'ringing' | 'inCall'

interface CallState {
    callState: CallStateType
    callId: string | null
    peerId: string | null
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
    error: null
}

function callReducer(state: CallState, action: CallAction): CallState {
    switch (action.type) {
        case 'REQUEST':
            return {
                callState: 'calling',
                callId: action.payload.callId,
                peerId: action.payload.peerId,
                error: null
            }
        case 'RECEIVE':
            return {
                callState: 'ringing',
                callId: action.payload.callId,
                peerId: action.payload.from,
                error: null
            }
        case 'ACCEPT':
            return state.callState === 'ringing'
                ? { ...state, callState: 'inCall', error: null }
                : state
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

// —— 2. Payloads de socket ——————————————————————————————————
interface CallRequestPayload { callId: string; from: string; to: string }
interface CallSignalPayload { callId: string; from: string; to: string }
interface CallSdpPayload { callId: string; sdp: string; type: 'offer' | 'answer'; from: string; to: string }
interface IceCandidatePayload { callId: string; candidate: RTCIceCandidateInit; from: string; to: string }

// —— 3. API del hook ———————————————————————————————————————
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
    const { callState: status, callId, peerId, error } = state

    const pcRef = useRef<RTCPeerConnection | null>(null)
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

    // Inicializa conexión WebRTC
    const initPeerConnection = useCallback((): RTCPeerConnection => {
        const pc = new RTCPeerConnection(RTC_CONFIGURATION)
        pcRef.current = pc

        const remote = new MediaStream()
        setRemoteStream(remote)

        pc.ontrack = (event: RTCTrackEvent) => {
            const [stream] = event.streams
            stream.getTracks().forEach(track => remote.addTrack(track))
        }

        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            const candidate = event.candidate?.toJSON()
            if (candidate && callId && peerId) {
                socket.emit('ice-candidate', {
                    callId,
                    candidate,
                    from: user!.id,
                    to: peerId
                } as IceCandidatePayload)
            }
        }

        return pc
    }, [socket, callId, peerId, user])

    // Limpia recursos al colgar
    const cleanup = useCallback(() => {
        if (localStream) stopLocalAudio(localStream)
        pcRef.current?.close()
        pcRef.current = null
        setLocalStream(null)
        setRemoteStream(null)
    }, [localStream])

    // — Señalización por socket —————————————————————————————
    useEffect(() => {
        if (!socket || !user) return

        const onRequest = (p: CallRequestPayload) => {
            if (p.to !== user.id) return
            dispatch({ type: 'RECEIVE', payload: { callId: p.callId, from: p.from } })
        }
        const onCancel = (p: CallSignalPayload) => { if (p.callId === callId) dispatch({ type: 'CANCEL' }) }
        const onDecline = (p: CallSignalPayload) => { if (p.callId === callId) dispatch({ type: 'DECLINE' }) }
        const onAccept = (p: CallSignalPayload) => { if (p.callId === callId) dispatch({ type: 'ACCEPT' }) }
        const onEnd = (p: CallSignalPayload) => { if (p.callId === callId) dispatch({ type: 'END' }) }

        const onSdp = async (p: CallSdpPayload) => {
            if (p.callId !== callId) return

            if (p.type === 'offer') {
                const pc = initPeerConnection()
                const local = await getLocalAudio()
                setLocalStream(local)
                local.getTracks().forEach(t => pc.addTrack(t, local))

                await pc.setRemoteDescription({ type: 'offer', sdp: p.sdp })
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
                await pcRef.current?.setRemoteDescription({ type: 'answer', sdp: p.sdp })
            }
        }

        const onIce = async (p: IceCandidatePayload) => {
            if (p.callId !== callId) return
            await pcRef.current?.addIceCandidate(p.candidate)
        }

        socket.on('call-request', onRequest)
        socket.on('call-cancel', onCancel)
        socket.on('call-decline', onDecline)
        socket.on('call-accept', onAccept)
        socket.on('call-end', onEnd)
        socket.on('call-sdp', onSdp)
        socket.on('ice-candidate', onIce)

        return () => {
            socket.off('call-request', onRequest)
            socket.off('call-cancel', onCancel)
            socket.off('call-decline', onDecline)
            socket.off('call-accept', onAccept)
            socket.off('call-end', onEnd)
            socket.off('call-sdp', onSdp)
            socket.off('ice-candidate', onIce)
        }
    }, [socket, user, callId, initPeerConnection])

    // — Manejo de estado de llamada —————————————————————————————
    useEffect(() => {
        if (status === 'inCall' && peerId) {
            // yo inicié la llamada: genero offer
            const pc = initPeerConnection()
            getLocalAudio().then(stream => {
                setLocalStream(stream)
                stream.getTracks().forEach(t => pc.addTrack(t, stream))
                pc.createOffer().then(offer => {
                    pc.setLocalDescription(offer).then(() => {
                        socket.emit('call-sdp', {
                            callId,
                            sdp: offer.sdp!,
                            type: 'offer',
                            from: user!.id,
                            to: peerId
                        } as CallSdpPayload)
                    })
                })
            })
        }
        if (status === 'idle') {
            cleanup()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    // — Funciones de control de llamada —————————————————————————
    const requestCall = useCallback((targetId: string) => {
        if (!socket || !user) return
        const id = uuidv4()
        dispatch({ type: 'REQUEST', payload: { callId: id, peerId: targetId } })
        socket.emit('call-request', {
            callId: id,
            from: user.id,
            to: targetId
        } as CallRequestPayload)

        setTimeout(() => {
            if (status === 'calling' && callId === id) {
                dispatch({ type: 'TIMEOUT' })
                socket.emit('call-cancel', {
                    callId: id,
                    from: user.id,
                    to: targetId
                } as CallSignalPayload)
            }
        }, 30_000)
    }, [socket, user, status, callId])

    const cancelCall = useCallback(() => {
        if (!socket || status !== 'calling' || !peerId || !user) return
        socket.emit('call-cancel', { callId, from: user.id, to: peerId } as CallSignalPayload)
        dispatch({ type: 'CANCEL' })
    }, [socket, status, callId, peerId, user])

    const declineCall = useCallback(() => {
        if (!socket || status !== 'ringing' || !peerId || !user) return
        socket.emit('call-decline', { callId, from: user.id, to: peerId } as CallSignalPayload)
        dispatch({ type: 'DECLINE' })
    }, [socket, status, callId, peerId, user])

    const acceptCall = useCallback(() => {
        if (!socket || status !== 'ringing' || !peerId || !user) return
        socket.emit('call-accept', { callId, from: user.id, to: peerId } as CallSignalPayload)
        dispatch({ type: 'ACCEPT' })
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
        error,
        localStream,
        remoteStream,
        requestCall,
        cancelCall,
        acceptCall,
        declineCall,
        endCall
    }
}
