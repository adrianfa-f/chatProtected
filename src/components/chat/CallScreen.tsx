import { FaPhoneSlash } from 'react-icons/fa';
import { useCall } from '../../contexts/CallContext';

const CallScreen = () => {
    const {
        status,
        peerId,
        cancelCall,
        declineCall,
        acceptCall
    } = useCall();

    return (
        <>
            {status === 'calling' && (
                <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50 text-white">
                    <p className="text-xl mb-4">
                        Llamando a <span className="font-semibold">{peerId}</span>...
                    </p>
                    <button
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                        onClick={cancelCall}
                    >
                        <FaPhoneSlash className="inline mr-2" /> Colgar
                    </button>
                </div>
            )}

            {status === 'ringing' && (
                <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50 text-white">
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
        </>
    );
};

export default CallScreen;