// src/context/callReducer.ts

export type CallStateType = 'idle' | 'calling' | 'ringing' | 'inCall';

export interface CallState {
    callState: CallStateType;
    callId: string | null;
    peerId: string | null;
    error: string | null;
}

export type CallAction =
    | { type: 'REQUEST'; payload: { callId: string; peerId: string } }
    | { type: 'RECEIVE'; payload: { callId: string; from: string } }
    | { type: 'ACCEPT' }
    | { type: 'DECLINE' }
    | { type: 'CANCEL' }
    | { type: 'END' }
    | { type: 'TIMEOUT' }
    | { type: 'ERROR'; payload: { message: string } };

export const initialCallState: CallState = {
    callState: 'idle',
    callId: null,
    peerId: null,
    error: null,
};

export function callReducer(
    state: CallState,
    action: CallAction
): CallState {
    switch (action.type) {
        case 'REQUEST':
            return {
                callState: 'calling',
                callId: action.payload.callId,
                peerId: action.payload.peerId,
                error: null,
            };
        case 'RECEIVE':
            return {
                callState: 'ringing',
                callId: action.payload.callId,
                peerId: action.payload.from,
                error: null,
            };
        case 'ACCEPT':
            if (state.callState !== 'ringing') return state;
            return { ...state, callState: 'inCall', error: null };
        case 'DECLINE':
        case 'CANCEL':
        case 'END':
        case 'TIMEOUT':
            return initialCallState;
        case 'ERROR':
            return { ...initialCallState, error: action.payload.message };
        default:
            return state;
    }
}
