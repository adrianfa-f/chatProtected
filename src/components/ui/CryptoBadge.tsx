import { FaLock } from 'react-icons/fa';

const CryptoBadge = () => {
    return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
            <FaLock className="mr-1" /> Cifrado
        </span>
    );
};

export default CryptoBadge;