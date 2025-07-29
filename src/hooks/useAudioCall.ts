import {
    useReducer,
    useState,
    useEffect,
    useRef,
    useCallback
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { RTC_CONFIGURATION } from '../config/webrtc';
import { getLocalAudio, stopLocalAudio } from '../utils/media';
import {
    callReducer,
    initialCallState,
    type CallState,
} from '../contexts/callReducer';

export interface CallApi {
    status: CallState['callState'];
    callId: string | null;
    peerId: string | null;
    error: string | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    requestCall: (peerId: string) => void;
    cancelCall: () => void;
    declineCall: () => void;
    acceptCall: () => void;
    endCall: () => void;
}

export function useAudioCall(): CallApi {
    const socket = useSocket();         // Socket | null
    const { user } = useAuth();         // { id: string; … }

    // —–– Máquina de estados de llamada
    const [callData, dispatchCall] = useReducer(
        callReducer,
        initialCallState
    );
    const { callState: status, callId, peerId, error } = callData;

    // —–– RTCPeerConnection y Streams
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    // Fábrica de PeerConnection (igual que antes)
    const initPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(RTC_CONFIGURATION);
        pcRef.current = pc;

        // prepara stream remoto
        const remote = new MediaStream();
        setRemoteStream(remote);
        pc.ontrack = ({ streams: [stream] }) => {
            stream.getTracks().forEach(track => remote.addTrack(track));
        };

        // emite ICE candidates
        pc.onicecandidate = ({ candidate }) => {
            if (candidate && callId) {
                socket?.emit('ice-candidate', { callId, candidate });
            }
        };

        return pc;
    }, [socket, callId]);

    // Lógica WebRTC de oferta
    const startRtcCall = useCallback(
        async (targetId: string) => {
            const pc = initPeerConnection();
            const stream = await getLocalAudio();
            setLocalStream(stream);
            stream.getTracks().forEach(t => pc.addTrack(t, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket?.emit('call-sdp', {
                callId,
                sdp: offer.sdp,
                to: targetId
            });
        },
        [initPeerConnection, socket, callId]
    );

    // Lógica WebRTC de respuesta
    const answerRtcCall = useCallback(
        async (fromId: string, sdp: string) => {
            const pc = initPeerConnection();
            const stream = await getLocalAudio();
            setLocalStream(stream);
            stream.getTracks().forEach(t => pc.addTrack(t, stream));

            await pc.setRemoteDescription({ type: 'offer', sdp });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket?.emit('call-sdp', {
                callId,
                sdp: answer.sdp,
                to: fromId
            });
        },
        [initPeerConnection, socket, callId]
    );

    // Limpieza de llamada (cierra PC y apaga micrófono)
    const cleanupRtcCall = useCallback(() => {
        if (localStream) stopLocalAudio(localStream);
        pcRef.current?.close();
        pcRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
    }, [localStream]);

    // —–– 1) Escucha todos los eventos socket de la señalización
    useEffect(() => {
        if (!socket || !user) return;

        const onRequest = ({
            callId: incomingId,
            from,
            to
        }: {
            callId: string;
            from: string;
            to: string;
        }) => {
            // sólo si soy destinatario
            if (to !== user.id) return;
            dispatchCall({ type: 'RECEIVE', payload: { callId: incomingId, from } });
        };

        const onCancel = ({ callId: id }: { callId: string }) => {
            if (id !== callId) return;
            dispatchCall({ type: 'CANCEL' });
        };

        const onDecline = ({ callId: id }: { callId: string }) => {
            if (id !== callId) return;
            dispatchCall({ type: 'DECLINE' });
        };

        const onAccept = ({ callId: id }: { callId: string }) => {
            if (id !== callId) return;
            dispatchCall({ type: 'ACCEPT' });
        };

        const onEnd = ({ callId: id }: { callId: string }) => {
            if (id !== callId) return;
            dispatchCall({ type: 'END' });
        };

        const onSdp = ({
            callId: id,
            sdp,
            type
        }: {
            callId: string;
            sdp: string;
            type: 'offer' | 'answer';
        }) => {
            if (id !== callId) return;
            if (type === 'offer') {
                // soy callee
                answerRtcCall(peerId!, sdp);
            } else {
                // soy caller, recibo respuesta
                pcRef.current?.setRemoteDescription({ type, sdp });
            }
        };

        socket.on('call-request', onRequest);
        socket.on('call-cancel', onCancel);
        socket.on('call-decline', onDecline);
        socket.on('call-accept', onAccept);
        socket.on('call-end', onEnd);
        socket.on('call-sdp', onSdp);

        return () => {
            socket.off('call-request', onRequest);
            socket.off('call-cancel', onCancel);
            socket.off('call-decline', onDecline);
            socket.off('call-accept', onAccept);
            socket.off('call-end', onEnd);
            socket.off('call-sdp', onSdp);
        };
    }, [socket, user, callId, peerId, answerRtcCall]);

    // —–– 2) Cuando `status` cambia, disparar WebRTC o limpieza
    useEffect(() => {
        if (status === 'inCall' && peerId) {
            // Si yo lancé la llamada (status pasó de calling→inCall)
            if (callData.callState === 'inCall') {
                startRtcCall(peerId);
            }
        }
        if (status === 'idle') {
            cleanupRtcCall();
        }
    }, [status, peerId, startRtcCall, cleanupRtcCall, callData.callState]);

    // —–– 3) Funciones de control de llamada
    const requestCall = useCallback(
        (targetId: string) => {
            if (!socket || !user) return;
            const id = uuidv4();
            dispatchCall({ type: 'REQUEST', payload: { callId: id, peerId: targetId } });
            socket.emit('call-request', { callId: id, from: user.id, to: targetId });

            // timeout automático en 30s
            setTimeout(() => {
                if (status === 'calling' && callId === id) {
                    dispatchCall({ type: 'TIMEOUT' });
                    socket.emit('call-cancel', { callId: id });
                }
            }, 30_000);
        },
        [socket, user, status, callId]
    );

    const cancelCall = useCallback(() => {
        if (!socket || status !== 'calling') return;
        socket.emit('call-cancel', { callId });
        dispatchCall({ type: 'CANCEL' });
    }, [socket, status, callId]);

    const declineCall = useCallback(() => {
        if (!socket || status !== 'ringing' || !user) return;
        socket.emit('call-decline', { callId, from: user.id, to: peerId! });
        dispatchCall({ type: 'DECLINE' });
    }, [socket, status, callId, peerId, user]);

    const acceptCall = useCallback(() => {
        if (!socket || status !== 'ringing' || !user) return;
        socket.emit('call-accept', { callId, from: user.id, to: peerId! });
        dispatchCall({ type: 'ACCEPT' });
    }, [socket, status, callId, peerId, user]);

    const endCall = useCallback(() => {
        if (!socket || status !== 'inCall') return;
        socket.emit('call-end', { callId });
        dispatchCall({ type: 'END' });
    }, [socket, status, callId]);

    return {
        status,
        callId,
        peerId,
        error,
        localStream,
        remoteStream,
        requestCall,
        cancelCall,
        declineCall,
        acceptCall,
        endCall
    };
}
