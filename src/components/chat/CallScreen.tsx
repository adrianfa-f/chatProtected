// src/components/CallScreen.tsx
import { useCall } from '../../contexts/CallContext'

const CallScreen = () => {
    const {
        status,
        peerId,
        cancelCall,
        declineCall,
        acceptCall,
        endCall
    } = useCall()

    if (status === 'calling') {
        return (
            <div className="call-screen">
                <p>Llamando a {peerId}…</p>
                <button onClick={cancelCall}>Colgar</button>
            </div>
        )
    }

    if (status === 'ringing') {
        return (
            <div className="call-screen">
                <p>Llamada entrante de {peerId}</p>
                <button onClick={acceptCall}>Aceptar</button>
                <button onClick={declineCall}>Rechazar</button>
            </div>
        )
    }

    if (status === 'inCall') {
        return (
            <div className="call-screen">
                <p>En llamada con {peerId}</p>
                <button onClick={endCall}>Colgar</button>
            </div>
        )
    }

    return null
}

export default CallScreen
