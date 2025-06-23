declare module 'libsodium-wrappers' {
    interface KeyPair {
        publicKey: Uint8Array;
        privateKey: Uint8Array;
    }

    export interface Sodium {
        ready: Promise<void>;
        crypto_box_NONCEBYTES: number;
        crypto_box_PUBLICKEYBYTES: number;
        crypto_box_SECRETKEYBYTES: number;

        from_base64(input: string): Uint8Array;
        to_base64(input: Uint8Array): string;

        from_string(input: string): Uint8Array;
        to_string(input: Uint8Array): string;

        randombytes_buf(length: number): Uint8Array;

        crypto_box_keypair(): KeyPair;
        crypto_box_seed_keypair(seed: Uint8Array): KeyPair;
        crypto_box_seal(message: Uint8Array, publicKey: Uint8Array): Uint8Array;
        crypto_box_seal_open(
            ciphertext: Uint8Array,
            publicKey: Uint8Array,
            secretKey: Uint8Array
        ): Uint8Array;

        // Funciones adicionales necesarias
        crypto_scalarmult_base(privateKey: Uint8Array): Uint8Array;
    }

    const sodium: Sodium;
    export default sodium;
}