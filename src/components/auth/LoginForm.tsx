import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(username, password);
            navigate('/chat');
        } catch (error) {
            setError('Error al iniciar sesión. Verifica tus credenciales.');
            console.log("Tuvimos un problema en el login: ", error)
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Nombre de Usuario
                </label>
                <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 text-gray-900 rounded-md shadow-sm p-2"
                    required
                />
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Contraseña
                </label>
                <input
                    id="password"
                    autoComplete="current-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 text-gray-900 rounded-md shadow-sm p-2"
                    required
                />
            </div>
            <button
                type="submit"
                className="w-full bg-gray-700 text-white py-2 px-4 rounded-md hover:bg-whatsapp-600"
            >
                Iniciar Sesión
            </button>
        </form>
    );
};

export default LoginForm;