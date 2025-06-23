import { useState } from 'react';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { FaSignInAlt, FaUserPlus } from 'react-icons/fa';

const AuthPage = () => {
    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center w-full p-4">
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold text-center mb-6 text-gray-600">
                    WhatsApp Cifrado
                </h1>

                <div className="flex mb-6 border-b">
                    <button
                        className={`flex-1 py-2 font-medium ${activeTab === 'login'
                            ? 'text-gray-700 border-b-2 border-whatsapp-500'
                            : 'text-gray-500'
                            }`}
                        onClick={() => setActiveTab('login')}
                    >
                        <FaSignInAlt className="inline mr-2" /> Iniciar Sesión
                    </button>
                    <button
                        className={`flex-1 py-2 font-medium ${activeTab === 'register'
                            ? 'text-gray-700 border-b-2 border-whatsapp-500'
                            : 'text-gray-500'
                            }`}
                        onClick={() => setActiveTab('register')}
                    >
                        <FaUserPlus className="inline mr-2" /> Registrarse
                    </button>
                </div>

                {activeTab === 'login' ? <LoginForm /> : <RegisterForm />}
            </div>
        </div>
    );
};

export default AuthPage;