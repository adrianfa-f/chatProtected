import { useState, useEffect, useRef } from 'react';
import { FaMicrophone, FaStop, FaTrash, FaPaperPlane } from 'react-icons/fa';
import { useReactMediaRecorder } from 'react-media-recorder';

const AudioRecorder = ({ onSend, onCancel }: {
    onSend: (audioBlob: Blob) => void;
    onCancel: () => void;
}) => {
    const [recordingTime, setRecordingTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const {
        status,
        startRecording,
        stopRecording,
        mediaBlobUrl,
        clearBlobUrl
    } = useReactMediaRecorder({ // Nombre correcto
        audio: true,
        onStop: () => {
            if (timerRef.current) clearInterval(timerRef.current);
        }
    });

    const isRecording = status === 'recording';
    const hasRecording = !!mediaBlobUrl;

    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStart = () => {
        setRecordingTime(0);
        startRecording();
    };

    const handleSend = () => {
        if (!mediaBlobUrl) return;

        // Obtener el blob del audio
        fetch(mediaBlobUrl)
            .then(res => res.blob())
            .then(blob => {
                onSend(blob);
                clearBlobUrl();
                setRecordingTime(0);
            });
    };

    return (
        <div className="flex flex-col items-center p-4 bg-gray-100 rounded-lg">
            {hasRecording ? (
                <div className="flex flex-col items-center w-full">
                    <audio
                        ref={audioRef}
                        src={mediaBlobUrl}
                        controls
                        className="w-full mb-2"
                    />
                    <div className="flex space-x-2">
                        <button
                            onClick={clearBlobUrl}
                            className="p-2 bg-red-500 text-white rounded-full"
                        >
                            <FaTrash />
                        </button>
                        <button
                            onClick={handleSend}
                            className="p-2 bg-green-500 text-white rounded-full"
                        >
                            <FaPaperPlane />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center">
                    <button
                        onClick={isRecording ? stopRecording : handleStart}
                        className={`p-4 rounded-full ${isRecording
                                ? 'bg-red-500 text-white'
                                : 'bg-blue-500 text-white'
                            }`}
                    >
                        {isRecording ? <FaStop size={24} /> : <FaMicrophone size={24} />}
                    </button>

                    {isRecording && (
                        <div className="mt-2 text-center">
                            <p className="text-gray-700">Grabando: {formatTime(recordingTime)}</p>
                            <p className="text-sm text-gray-500">Máximo 2 minutos</p>
                        </div>
                    )}

                    <button
                        onClick={onCancel}
                        className="mt-4 text-gray-500 hover:text-gray-700"
                    >
                        Cancelar
                    </button>
                </div>
            )}
        </div>
    );
};

export default AudioRecorder;