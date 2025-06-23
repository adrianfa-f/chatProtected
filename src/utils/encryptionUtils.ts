import { SodiumPlus } from 'sodium-plus';

let sodium: SodiumPlus;

export const initSodium = async () => {
    if (!sodium) sodium = await SodiumPlus.auto();
    return sodium;
};

// Funciones de utilidad adicionales para cifrado pueden ir aquí