const DB_NAME = 'SecureChatDB';
const DB_VERSION = 2;

export const CRYPTO_KEYS_STORE = 'crypto_keys';
export const ENCRYPTED_MESSAGES_STORE = 'encrypted_messages';

export const initDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(CRYPTO_KEYS_STORE)) {
                db.createObjectStore(CRYPTO_KEYS_STORE, { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains(ENCRYPTED_MESSAGES_STORE)) {
                const store = db.createObjectStore(ENCRYPTED_MESSAGES_STORE, {
                    keyPath: 'messageKey'
                });
                store.createIndex('by_chat', 'chatId', { unique: false });
                store.createIndex('by_createdAt', 'createdAt', { unique: false });
            }
        };
    });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const saveItem = (storeName: string, item: any): Promise<void> =>
    initDB().then(db =>
        new Promise((res, rej) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(item);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        })
    );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getItem = (storeName: string, key: string): Promise<any> =>
    initDB().then(db =>
        new Promise((res, rej) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        })
    );

export const getItemsByIndex = (
    storeName: string,
    indexName: string,
    value: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> =>
    initDB().then(db =>
        new Promise((res, rej) => {
            try {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                if (!store.indexNames.contains(indexName)) {
                    console.error(`Índice "${indexName}" no existe en "${storeName}"`);
                    return res([]);
                }
                const idx = store.index(indexName);
                const req = idx.getAll(value);
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => rej(req.error);
            } catch (err) {
                console.error(err);
                res([]);
            }
        })
    );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getAllItems = (storeName: string): Promise<any[]> =>
    initDB().then(db =>
        new Promise((res, rej) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => res(req.result || []);
            req.onerror = () => rej(req.error);
        })
    );

export const deleteItem = (storeName: string, key: string): Promise<void> =>
    initDB().then(db =>
        new Promise((res, rej) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        })
    );
