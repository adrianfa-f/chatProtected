import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const RegisterForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        try {
            await register(username, password);
            navigate('/chat');
        } catch {
            setError('Error al registrarse. Inténtalo de nuevo.');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
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
            <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirmar Contraseña
                </label>
                <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 text-gray-900 rounded-md shadow-sm p-2"
                    required
                />
            </div>
            <button
                type="submit"
                className="w-full bg-gray-700 text-white py-2 px-4 rounded-md hover:bg-purple-600"
            >
                Registrarse
            </button>
        </form>
    );
};

export default RegisterForm;