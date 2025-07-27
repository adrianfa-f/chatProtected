// media.js
export async function getLocalAudio(): Promise<MediaStream> {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return stream;
    } catch (err: unknown) {
        // Narrowing: si es instancia de Error, mantenemos su mensaje
        const error = err instanceof Error
            ? err
            : new Error('Error desconocido al acceder al micrófono');

        console.error('Error accediendo al micrófono:', error);
        throw error;
    }
}

export function stopLocalAudio(stream: MediaStream): void {
    stream.getTracks().forEach(track => track.stop());
}