import React, { useState } from 'react';
import type { User } from '../../types/types';

interface KeyVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    contact: User;
}

const KeyVerificationModal: React.FC<KeyVerificationModalProps> = ({
    isOpen,
    onClose,
    contact
}) => {
    const [verificationCode, setVerificationCode] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
                <h2 className="text-xl font-bold mb-4">Verificar Clave de {contact.username}</h2>
                <p className="mb-4">
                    Compara este código con el de tu contacto para verificar que la conversación es segura.
                </p>
                <div className="bg-gray-100 p-4 rounded mb-4">
                    <code className="text-sm break-all">{contact.publicKey.substring(0, 20)}...</code>
                </div>
                <div className="mb-4">
                    <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
                        Código de Verificación (pídele a tu contacto que lo ingrese también)
                    </label>
                    <input
                        type="text"
                        id="verificationCode"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2"
                        placeholder="Ej: 5A3F9B"
                    />
                </div>
                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            // TODO: Marcar como verificado
                            onClose();
                        }}
                        className="bg-whatsapp-500 text-white px-4 py-2 rounded"
                    >
                        Verificar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KeyVerificationModal;