import ChatRequestItem from './ChatRequestItem';
import type { ChatRequest, User } from '../../types/types';

interface ChatRequestListProps {
    requests: ChatRequest[];
    user: User | null;
}

const ChatRequestList = ({
    requests,
    user
}: ChatRequestListProps) => {
    // Filtrar solicitudes relevantes para el usuario actual con verificación segura
    const relevantRequests = requests.filter(request =>
        request?.toUser?.id === user?.id || request?.fromUser?.id === user?.id
    );

    if (!relevantRequests || relevantRequests.length === 0) {
        return (
            <div className="p-6 text-center text-gray-500">
                No tienes solicitudes de chat pendientes
            </div>
        );
    }

    return (
        <div className="divide-y divide-gray-200">
            {relevantRequests.map(request => (
                <ChatRequestItem
                    key={request.id}
                    request={request}
                    currentUserId={user?.id}
                />
            ))}
        </div>
    );
};

export default ChatRequestList;