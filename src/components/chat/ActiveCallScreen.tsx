// src/components/chat/ActiveCallScreen.tsx
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash } from 'react-icons/fa';

const ActiveCallScreen = () => {
    const { peerId, localStream, remoteStream, endCall } = useCall();

    return (
        <div className="fixed inset-0 bg-gray-800 flex flex-col items-center justify-center z-50 text-white">
            <p className="text-xl mb-4">
                En llamada con <span className="font-semibold">{peerId}</span>
            </p>

            {/* Audio remoto con la mecánica que funciona */}
            <audio
                ref={el => {
                    if (el && remoteStream) {
                        el.srcObject = remoteStream;
                        el.play().catch(console.warn);
                    }
                }}
                autoPlay
                className="hidden"
            />

            {/* Audio local (muteado) */}
            <audio
                ref={el => {
                    if (el && localStream) {
                        el.srcObject = localStream;
                    }
                }}
                muted
                className="hidden"
            />

            <button
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded flex items-center"
                onClick={endCall}
            >
                <FaPhoneSlash className="mr-2" /> Colgar
            </button>
        </div>
    );
};

export default ActiveCallScreen;