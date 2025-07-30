// src/components/chat/CallManager.tsx
import { useCall } from '../../contexts/CallContext';
import OutgoingCallScreen from './OutgoingCallScreen';
import IncomingCallScreen from './IncomingCallScreen';
import ActiveCallScreen from './ActiveCallScreen';

const CallManager = () => {
    const { isCalling, isRinging, inCall } = useCall();

    if (isRinging) {
        return <IncomingCallScreen />;
    }

    if (isCalling) {
        return <OutgoingCallScreen />;
    }

    if (inCall) {
        return <ActiveCallScreen />;
    }

    return null;
};

export default CallManager;