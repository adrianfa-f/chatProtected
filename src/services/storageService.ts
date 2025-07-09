import {
    saveItem,
    getItemsByIndex,
    getAllItems,
    deleteItem,
    ENCRYPTED_MESSAGES_STORE
} from '../utils/db';
import { encryptData, decryptData } from '../utils/cryptoUtils';
import type { Message } from '../types/types';

type StoredEncryptedMessage = {
    messageKey: string;
    chatId: string;
    data: string;
    iv: string;
    createdAt: string;
};

export class StorageService {
    private cryptoKey: CryptoKey;

    constructor(cryptoKey: CryptoKey) {
        this.cryptoKey = cryptoKey;
    }

    private makeMessageKey(chatId: string, messageId: string): string {
        return `${chatId}_${messageId}`;
    }

    async saveMessage(chatId: string, message: Message): Promise<void> {
        const payload = JSON.stringify({ ...message });
        const { iv, data } = await encryptData(this.cryptoKey, payload);
        const record: StoredEncryptedMessage = {
            messageKey: this.makeMessageKey(chatId, message.id),
            chatId,
            data,
            iv,
            createdAt: message.createdAt.toISOString()
        };
        await saveItem(ENCRYPTED_MESSAGES_STORE, record);
    }

    async saveMessages(chatId: string, messages: Message[]): Promise<void> {
        for (const msg of messages) {
            await this.saveMessage(chatId, msg);
        }
    }

    async loadMessages(chatId: string): Promise<Message[]> {
        const records = (await getItemsByIndex(
            ENCRYPTED_MESSAGES_STORE,
            'by_chat',
            chatId
        )) as StoredEncryptedMessage[];

        records.sort(
            (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const result: Message[] = [];
        for (const rec of records) {
            const json = await decryptData(this.cryptoKey, rec.data, rec.iv);
            const msg = JSON.parse(json) as Message;
            msg.createdAt = new Date(rec.createdAt);
            result.push(msg);
        }

        return result;
    }

    async getLastMessage(chatId: string): Promise<string | null> {
        const msgs = await this.loadMessages(chatId);
        const own = msgs.filter(m => m.plaintext);
        return own.length ? own[own.length - 1].plaintext! : null;
    }

    async cleanupOldMessages(days = 7): Promise<void> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const all = (await getAllItems(
            ENCRYPTED_MESSAGES_STORE
        )) as StoredEncryptedMessage[];

        for (const rec of all) {
            if (new Date(rec.createdAt) < cutoff) {
                await deleteItem(ENCRYPTED_MESSAGES_STORE, rec.messageKey);
            }
        }
    }
}
