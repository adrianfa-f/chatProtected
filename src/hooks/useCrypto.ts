import { useState, useEffect } from 'react';
import {
    encryptMessage as encrypt,
    decryptMessage as decrypt
} from '../services/cryptoService';

export const useCrypto = () => {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Inicialización simple
        setIsReady(true);
    }, []);

    return {
        isReady,
        encryptMessage: encrypt,
        decryptMessage: decrypt
    };
};