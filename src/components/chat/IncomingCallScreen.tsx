// src/components/chat/IncomingCallScreen.tsx
import { FaPhone, FaTimes } from 'react-icons/fa';
import { useCall } from '../../contexts/CallContext';

const IncomingCallScreen = () => {
    const { peerIdRef, startCall, declineCall } = useCall();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                <div className="flex flex-col items-center">
                    <div className="mb-4">
                        <div className="bg-gray-200 border-2 border-dashed rounded-full w-24 h-24" />
                    </div>
                    <h2 className="text-xl font-bold text-center mb-2">
                        Llamada de <span className="text-purple-600">{peerIdRef.current}</span>
                    </h2>
                    <p className="text-gray-600 mb-6">¿Deseas responder?</p>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => startCall(peerIdRef.current!)} // Ejecuta startCall al aceptar
                            className="bg-green-500 text-white p-4 rounded-full hover:bg-green-600 transition"
                        >
                            <FaPhone className="text-xl" />
                        </button>
                        <button
                            onClick={declineCall}
                            className="bg-red-500 text-white p-4 rounded-full hover:bg-red-600 transition"
                        >
                            <FaTimes className="text-xl" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallScreen;