import { useState } from 'react';

const KeySetupPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSetup = () => {
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        // TODO: Guardar la clave privada cifrada con la contraseña
        // Redirigir al chat
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="bg-white p-8 rounded-lg shadow-md w-96">
                <h1 className="text-2xl font-bold text-center mb-6 text-whatsapp-500">
                    Configuración de Seguridad
                </h1>

                <p className="mb-4">
                    Por favor, establece una contraseña segura para proteger tu clave privada.
                </p>

                {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

                <div className="mb-4">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Contraseña
                    </label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2"
                        required
                    />
                </div>

                <div className="mb-4">
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirmar Contraseña
                    </label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2"
                        required
                    />
                </div>

                <button
                    onClick={handleSetup}
                    className="w-full bg-whatsapp-500 text-white py-2 px-4 rounded-md hover:bg-whatsapp-600"
                >
                    Guardar y Continuar
                </button>
            </div>
        </div>
    );
};

export default KeySetupPage;