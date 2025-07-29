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
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                <p className="text-xl mb-4">Llamando a <span className="font-semibold">{peerId}</span>…</p>
                <button
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                    onClick={cancelCall}
                >
                    Colgar
                </button>
            </div>
        )
    }

    if (status === 'ringing') {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                <p className="text-xl mb-4">Llamada entrante de <span className="font-semibold">{peerId}</span></p>
                <div className="flex space-x-4">
                    <button
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
                        onClick={acceptCall}
                    >
                        Aceptar
                    </button>
                    <button
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                        onClick={declineCall}
                    >
                        Rechazar
                    </button>
                </div>
            </div>
        )
    }

    if (status === 'inCall') {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-800 text-white">
                <p className="text-xl mb-4">En llamada con <span className="font-semibold">{peerId}</span></p>
                <button
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                    onClick={endCall}
                >
                    Colgar
                </button>
            </div>
        )
    }

    return null
}

export default CallScreen
