import axios from 'axios';

// Configuración básica de Axios - actualiza la URL con tu backend local
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL, // URL de tu backend
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Añade esta línea para enviar cookies
});

// Mantenemos el manejo centralizado de errores
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            console.error('API Error:', error.response.data);
        } else {
            console.error('API Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default api;