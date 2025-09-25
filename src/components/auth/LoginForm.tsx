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
            {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre de Usuario
                </label>
                <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md shadow-sm p-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                />
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contraseña
                </label>
                <input
                    id="password"
                    autoComplete="current-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md shadow-sm p-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                />
            </div>
            <button
                type="submit"
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
            >
                Iniciar Sesión
            </button>
        </form>
    );
};

export default LoginForm;