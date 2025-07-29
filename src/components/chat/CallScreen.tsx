import { useRef, useEffect } from 'react'
import { useCall } from '../../contexts/CallContext'

const CallScreen = () => {
    const {
        status,
        peerId,
        localStream,
        remoteStream,
        cancelCall,
        declineCall,
        acceptCall,
        endCall
    } = useCall()

    const localAudioRef = useRef<HTMLAudioElement>(null)
    const remoteAudioRef = useRef<HTMLAudioElement>(null)

    useEffect(() => {
        if (localAudioRef.current && localStream) {
            localAudioRef.current.srcObject = localStream
        }
    }, [localStream])

    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream
        }
    }, [remoteStream])

    return (
        <>
            {/* Elementos de audio ocultos para reproducir los streams */}
            <audio ref={localAudioRef} autoPlay muted className="hidden" />
            <audio ref={remoteAudioRef} autoPlay className="hidden" />

            {status === 'calling' && (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                    <p className="text-xl mb-4">
                        Llamando a <span className="font-semibold">{peerId}</span>…
                    </p>
                    <button
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                        onClick={cancelCall}
                    >
                        Colgar
                    </button>
                </div>
            )}

            {status === 'ringing' && (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                    <p className="text-xl mb-4">
                        Llamada entrante de <span className="font-semibold">{peerId}</span>
                    </p>
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
            )}

            {status === 'inCall' && (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-800 text-white">
                    <p className="text-xl mb-4">
                        En llamada con <span className="font-semibold">{peerId}</span>
                    </p>
                    <button
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                        onClick={endCall}
                    >
                        Colgar
                    </button>
                </div>
            )}
        </>
    )
}

export default CallScreen
