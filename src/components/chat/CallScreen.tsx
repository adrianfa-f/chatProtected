import { FaPhoneSlash, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { useCall } from '../../contexts/CallContext';
import { useEffect, useRef, useState } from 'react';

const CallScreen = () => {
    const {
        callState,
        remoteUser,
        endCall,
        acceptCall,
        localStream,
        remoteStream,
        isMuted,
        toggleMute
    } = useCall();

    const localRef = useRef<HTMLAudioElement>(null);
    const remoteRef = useRef<HTMLAudioElement>(null);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [remoteTracks, setRemoteTracks] = useState<string[]>([]);

    // Reproducir audio local
    useEffect(() => {
        if (localStream && localRef.current) {
            console.log('[CallScreen] Configurando stream local');
            localRef.current.srcObject = localStream;
            localRef.current.muted = true;

            // Verificación explícita de null
            localRef.current.play()
                .then(() => console.log('[Audio] Audio local reproducido'))
                .catch(e => {
                    console.error('[Audio] Error reproduciendo audio local:', e);
                    setAudioError('Error con audio local');
                });
        }
    }, [localStream]);

    // Reproducir audio remoto
    useEffect(() => {
        if (remoteStream && remoteRef.current) {
            console.log('[CallScreen] Configurando stream remoto');
            remoteRef.current.srcObject = remoteStream;

            // Guardar referencia en variable para evitar problemas de closure
            const audioElement = remoteRef.current;

            const playAudio = async () => {
                try {
                    // Verificación de null segura
                    await audioElement.play();
                    console.log('[Audio] Audio remoto reproducido con éxito');

                    setRemoteTracks(remoteStream.getTracks().map(t =>
                        `${t.kind}:${t.id} (${t.enabled ? 'activo' : 'inactivo'})`
                    ));
                } catch (err) {
                    console.error('[Audio] Error al reproducir audio remoto:', err);
                    setAudioError('Error reproduciendo audio remoto');

                    const forcePlay = () => {
                        if (audioElement) {
                            audioElement.play()
                                .catch(e => console.warn('[Audio] Error forzado:', e));
                        }
                        document.removeEventListener('click', forcePlay);
                    };

                    document.addEventListener('click', forcePlay);
                }
            };

            playAudio();
        }
    }, [remoteStream]);

    // Verificar estado de conexión periódicamente
    useEffect(() => {
        const interval = setInterval(() => {
            if (callState === 'in-progress') {
                console.log('[CallStatus] Estado actual de llamada:', callState);

                // Verificación segura con optional chaining
                if (remoteRef.current) {
                    console.log('[Audio] Estado audio remoto:',
                        remoteRef.current.paused ? 'pausado' : 'reproduciendo',
                        '| Volumen:', remoteRef.current.volume,
                        '| Muted:', remoteRef.current.muted
                    );
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [callState]);

    if (callState === 'idle') return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center">
            <div className="text-center text-white">
                <h2 className="text-2xl font-bold">
                    {callState === 'calling' && 'Llamando a'}
                    {callState === 'ringing' && 'Llamada entrante de'}
                    {callState === 'in-progress' && 'En llamada con'}
                </h2>
                <p className="text-xl mt-2">{remoteUser?.username}</p>

                {audioError && (
                    <div className="mt-4 p-2 bg-red-600 rounded-md">
                        <p className="font-semibold">Error de audio:</p>
                        <p>{audioError}</p>
                        <p className="text-sm mt-1">Haz click en cualquier lugar para intentar reproducir</p>
                    </div>
                )}

                {/* Información de depuración */}
                {callState === 'in-progress' && remoteTracks.length > 0 && (
                    <div className="mt-4 text-sm bg-gray-800 p-2 rounded-md">
                        <p>Tracks remotos recibidos:</p>
                        <ul className="mt-1">
                            {remoteTracks.map((track, i) => (
                                <li key={i}>{track}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Controles para llamada activa */}
                {callState === 'in-progress' && (
                    <div className="mt-12 flex justify-center space-x-8">
                        <button
                            onClick={toggleMute}
                            className={`p-4 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700'}`}
                        >
                            {isMuted ? <FaMicrophoneSlash size={24} /> : <FaMicrophone size={24} />}
                        </button>

                        <button
                            onClick={endCall}
                            className="p-4 bg-red-500 rounded-full"
                        >
                            <FaPhoneSlash size={24} />
                        </button>
                    </div>
                )}

                {/* Botones para llamada entrante */}
                {callState === 'ringing' && (
                    <div className="mt-12 flex justify-center space-x-8">
                        <button
                            onClick={acceptCall}
                            className="p-4 bg-green-500 text-white rounded-full font-semibold"
                        >
                            Aceptar
                        </button>
                        <button
                            onClick={endCall}
                            className="p-4 bg-red-500 text-white rounded-full font-semibold"
                        >
                            Rechazar
                        </button>
                    </div>
                )}
            </div>

            {/* Elementos de audio ocultos */}
            <audio ref={localRef} autoPlay muted style={{ display: 'none' }} />
            <audio ref={remoteRef} autoPlay style={{ display: 'none' }} />
        </div>
    );
};

export default CallScreen;