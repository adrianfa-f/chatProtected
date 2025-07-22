/// <reference lib="webworker" />
import libsodium from 'libsodium-wrappers';

declare const self: ServiceWorkerGlobalScope;

// 1. Definir interfaces para el tipado
interface PushNotificationPayload {
    title: string;
    body: string;
    icon?: string;
    data?: {
        url?: string;
        [key: string]: unknown;
    };
}

function base64ToBufferSW(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

async function getItemSw<T>(storeName: string, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        const openReq = indexedDB.open('SecureChatDB');
        openReq.onerror = () => reject(openReq.error);
        openReq.onsuccess = () => {
            const db = openReq.result;
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const getReq = store.get(key);
            getReq.onerror = () => reject(getReq.error);
            getReq.onsuccess = () => resolve(getReq.result as T);
        };
    });
}

// 2. Log de inicio
console.log('[SW] Service Worker iniciado');

self.addEventListener('install', event => {
    console.log('[SW] Evento install');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    console.log('[SW] Evento activate');
    event.waitUntil(self.clients.claim());
});

// Reemplazar todo el bloque del evento 'push'
self.addEventListener('push', event => {
    console.log('[SW] Evento push recibido');

    event.waitUntil(
        (async () => {
            try {
                // 1) Parsear payload original
                let payload: PushNotificationPayload;
                if (event.data) {
                    try {
                        payload = (await event.data.json()) as PushNotificationPayload;
                    } catch {
                        payload = {
                            title: 'Nuevo mensaje',
                            body: 'Tienes un nuevo mensaje',
                            icon: '/icon-192x192.png'
                        };
                    }
                } else {
                    payload = {
                        title: 'Nuevo mensaje',
                        body: 'Tienes un nuevo mensaje',
                        icon: '/icon-192x192.png'
                    };
                }

                // 2) Intentar desencriptar payload.body
                let decryptedBody = payload.body;
                try {
                    // 2.1) Sesión usuario
                    const session = await getItemSw<{ username: string }>(
                        "session_data",
                        'current_user'
                    );
                    const username = session?.username;
                    if (!username) throw new Error('Sin sesión activa');

                    // 2.2) Clave de dispositivo
                    const deviceKeyItem = await getItemSw<{ rawKey: string }>(
                        "deviceKey",
                        'deviceKey'
                    );
                    if (!deviceKeyItem) throw new Error('Sin deviceKey');

                    const deviceCryptoKey = await crypto.subtle.importKey(
                        'raw',
                        base64ToBufferSW(deviceKeyItem.rawKey),
                        { name: 'AES-GCM' },
                        false,
                        ['decrypt']
                    );

                    // 2.3) Clave derivada cifrada
                    const derivedMeta = await getItemSw<{
                        encryptedData: string;
                        iv: string;
                    }>(
                        "encryptedDerivedKey",
                        `derivedKey_${username}`
                    );
                    if (!derivedMeta) throw new Error('Sin derivedKey meta');

                    const derivedRaw = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: base64ToBufferSW(derivedMeta.iv) },
                        deviceCryptoKey,
                        base64ToBufferSW(derivedMeta.encryptedData)
                    );
                    const derivedKey = await crypto.subtle.importKey(
                        'raw',
                        derivedRaw,
                        { name: 'AES-GCM' },
                        false,
                        ['decrypt']
                    );

                    // 2.4) Clave privada cifrada
                    const pkMeta = await getItemSw<{
                        encryptedKey: string;
                        iv: string;
                    }>(
                        "crypto_keys",
                        `privateKey_${username}`
                    );
                    if (!pkMeta) throw new Error('Sin privateKey meta');

                    const pkRaw = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: base64ToBufferSW(pkMeta.iv) },
                        derivedKey,
                        base64ToBufferSW(pkMeta.encryptedKey)
                    );
                    const privateKeyBase64 = new TextDecoder().decode(pkRaw);

                    // 2.5) Desencriptar usando libsodium
                    await libsodium.ready;
                    const ctBytes = libsodium.from_base64(payload.body);
                    const pkBytes = libsodium.from_base64(privateKeyBase64);
                    const pubBytes = libsodium.crypto_scalarmult_base(pkBytes);
                    const opened = libsodium.crypto_box_seal_open(
                        ctBytes,
                        pubBytes,
                        pkBytes
                    );
                    decryptedBody = libsodium.to_string(opened);
                } catch (err) {
                    console.error('[SW] Error desencriptando notificación:', err);
                }

                // 3) Mostrar notificación con body (desencriptado o original)
                const notificationOptions: NotificationOptions = {
                    body: decryptedBody,
                    icon: payload.icon || '/icon-192x192.png',
                    data: payload.data || {}
                };
                await self.registration.showNotification(
                    payload.title,
                    notificationOptions
                );
                console.log('[SW] Notificación mostrada');
            } catch (error) {
                console.error('[SW] Error crítico en evento push:', error);
                await self.registration.showNotification('Nuevo mensaje', {
                    body: 'Tienes un nuevo mensaje',
                    icon: '/icon-192x192.png'
                });
            }
        })()
    );
});

self.addEventListener('notificationclick', event => {
    console.log('[SW] Evento notificationclick recibido');
    event.notification.close();

    // 5. Usar tipo para los datos de la notificación
    const notificationData = event.notification.data as { url?: string } || {};
    console.log('[SW] Datos de notificación:', notificationData);

    const url = notificationData.url || '/';
    console.log('[SW] URL objetivo:', url);

    event.waitUntil(
        (async () => {
            try {
                console.log('[SW] Buscando clientes existentes...');
                const clients = await self.clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });

                console.log(`[SW] ${clients.length} clientes encontrados`);

                // 6. Buscar cliente con tipo Client
                const targetClient = clients.find(client => {
                    try {
                        const clientUrl = new URL(client.url);
                        return clientUrl.pathname.includes(url);
                    } catch {
                        return false;
                    }
                });

                if (targetClient) {
                    console.log('[SW] Cliente encontrado, enfocando...');
                    await targetClient.focus();
                    console.log('[SW] Cliente enfocado');

                    if ('postMessage' in targetClient) {
                        targetClient.postMessage({
                            type: 'NAVIGATE',
                            url: url
                        });
                        console.log('[SW] Mensaje de navegación enviado');
                    }
                } else {
                    console.log('[SW] No se encontró cliente, abriendo nueva ventana...');
                    if (self.clients.openWindow) {
                        const newWindow = await self.clients.openWindow(url);
                        if (!newWindow) {
                            console.error('[SW] Error abriendo nueva ventana');
                        }
                    }
                }
            } catch (error) {
                console.error('[SW] Error en notificationclick:', error);
            }
        })()
    );
});

// 7. Definir tipo para mensajes desde la app
interface ClientMessage {
    type: string;
    [key: string]: unknown;
}

self.addEventListener('message', event => {
    const data = event.data as ClientMessage;
    console.log('[SW] Mensaje recibido desde la app:', data);
});