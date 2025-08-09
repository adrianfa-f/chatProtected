// src/components/CallList.tsx
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaPhone, FaPhoneSlash, FaClock, FaUser } from 'react-icons/fa';
import type { Call } from '../../types/types';
import { useCall } from '../../contexts/CallContext';

interface CallListProps {
    calls: Call[];
    currentUserId: string;
}

const CallList = ({ calls, currentUserId }: CallListProps) => {
    const getCallDetails = (call: Call) => {
        const isOutgoing = call.fromUser.id === currentUserId;
        const otherUser = isOutgoing ? call.toUser : call.fromUser;
        const duration = call.endedAt
            ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
            : 0;


        return {
            username: otherUser.username,
            status: call.status,
            isOutgoing,
            duration,
            date: new Date(call.createdAt)
        };
    };

    const { setMissedCount, markAsSeen } = useCall()
    setMissedCount(0)
    markAsSeen()

    const statusIcons = {
        answered: <FaPhone className="text-green-500" />,
        rejected: <FaPhoneSlash className="text-red-500" />,
        missed: <FaPhoneSlash className="text-yellow-500" />
    };

    return (
        <div className="divide-y">
            {calls.map(call => {
                const details = getCallDetails(call);

                return (
                    <div key={call.id} className="py-3 px-4 hover:bg-gray-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="mr-3">
                                    {statusIcons[details.status]}
                                </div>
                                <div>
                                    <p className="font-medium flex items-center">
                                        <FaUser className="mr-2 text-gray-500" />
                                        {details.username}
                                    </p>
                                    <p className="text-sm text-gray-500 flex items-center mt-1">
                                        <FaClock className="mr-2" />
                                        {format(details.date, 'dd/MM/yy HH:mm')}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className={`text-sm ${details.status === 'answered' ? 'text-green-600' :
                                    details.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                                    }`}>
                                    {details.status === 'answered'
                                        ? `${details.duration}s`
                                        : details.status === 'rejected' ? 'Rechazada' : 'Perdida'
                                    }
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {formatDistanceToNow(details.date, { locale: es, addSuffix: true })}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CallList;