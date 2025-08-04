let audioContext: AudioContext | null = null;
let sourceNode: AudioBufferSourceNode | null = null;

export async function playRingtone(url: string) {
    stopRingtone(); // Por si hay uno sonando

    audioContext = new AudioContext();

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = true;
    sourceNode.connect(audioContext.destination);
    sourceNode.start(0);
}

export function stopRingtone() {
    if (sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
        sourceNode = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}
