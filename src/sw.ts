/// <reference lib="webworker" />
import libsodium from 'libsodium-wrappers';
import { CRYPTO_KEYS_STORE, DEVICE_KEY_STORE, ENCRYPTED_DERIVED_KEY_STORE, getItem, SESSION_STORE } from './utils/db';
import { base64ToBuffer } from './utils/encodingUtils';

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
                let payload: PushNotificationPayload;

                if (event.data) {
                    try {
                        payload = await event.data.json() as PushNotificationPayload;
                    } catch (parseError) {
                        console.error('[SW] Error parseando payload:', parseError);
                        payload = {
                            title: 'Nuevo mensaje',
                            body: 'Tienes un nuevo mensaje',
                            icon: '/icon-192x192.png'
                        };
                    }
                } else {
                    console.warn('[SW] Evento push sin datos');
                    payload = {
                        title: 'Nuevo mensaje',
                        body: 'Tienes un nuevo mensaje',
                        icon: '/icon-192x192.png'
                    };
                }

                let decryptedBody = "Tienes un nuevo puto mensaje";

                try {
                    // 1. Recuperar sesión del usuario
                    const session = await getItem(SESSION_STORE, 'current_user');

                    console.log("session: ", session)

                    if (session && session.username) {
                        const username = session.username;

                        // 2. Obtener clave de dispositivo
                        const deviceKeyItem = await getItem(DEVICE_KEY_STORE, 'deviceKey');

                        console.log("deviceKeyItem: ", deviceKeyItem)

                        if (deviceKeyItem) {
                            // 3. Obtener clave derivada cifrada
                            const encryptedKeyItem = await getItem(
                                ENCRYPTED_DERIVED_KEY_STORE,
                                `derivedKey_${username}`
                            );

                            console.log("encryptedKeyItem: ", encryptedKeyItem)

                            if (encryptedKeyItem) {
                                // Importar clave de dispositivo
                                const deviceCryptoKey = await crypto.subtle.importKey(
                                    "raw",
                                    base64ToBuffer(deviceKeyItem.rawKey),
                                    { name: "AES-GCM" },
                                    false,
                                    ["decrypt"]
                                );

                                console.log("deviceCryptoKey: ", deviceCryptoKey)

                                // Descifrar clave derivada
                                const decryptedDerivedKey = await crypto.subtle.decrypt(
                                    {
                                        name: "AES-GCM",
                                        iv: base64ToBuffer(encryptedKeyItem.iv)
                                    },
                                    deviceCryptoKey,
                                    base64ToBuffer(encryptedKeyItem.encryptedData)
                                );

                                console.log("decryptedDerivedKey: ", decryptedDerivedKey)

                                // Importar clave derivada
                                const derivedCryptoKey = await crypto.subtle.importKey(
                                    "raw",
                                    decryptedDerivedKey,
                                    { name: "AES-GCM" },
                                    false,
                                    ["decrypt"]
                                );

                                console.log("derivedCryptoKey: ", derivedCryptoKey)

                                // 4. Descifrar clave privada
                                const keyMeta = await getItem(
                                    CRYPTO_KEYS_STORE,
                                    `privateKey_${username}`
                                );

                                console.log("keyMeta: ", keyMeta)

                                if (keyMeta) {
                                    const decryptedPrivateKey = await crypto.subtle.decrypt(
                                        {
                                            name: "AES-GCM",
                                            iv: base64ToBuffer(keyMeta.iv)
                                        },
                                        derivedCryptoKey,
                                        base64ToBuffer(keyMeta.encryptedKey)
                                    );

                                    const privateKey = new TextDecoder().decode(decryptedPrivateKey);

                                    // 5. Descifrar el mensaje usando libsodium
                                    await libsodium.ready;
                                    const ctBytes = libsodium.from_base64(payload.body);
                                    console.log("ctBytes: ", ctBytes)
                                    const pkBytes = libsodium.from_base64(privateKey);
                                    console.log("pkBytes: ", pkBytes)
                                    const pubBytes = libsodium.crypto_scalarmult_base(pkBytes);
                                    console.log("pubBytes: ", pubBytes)
                                    const opened = libsodium.crypto_box_seal_open(ctBytes, pubBytes, pkBytes);
                                    console.log("opened: ", opened)

                                    decryptedBody = libsodium.to_string(opened);
                                    console.log("decryptedBody: ", decryptedBody)
                                }
                            }
                        }
                    }
                } catch {
                    console.log('[SW] No se encontró sesión de usuario');
                }

                console.log("decryptedBody: ", decryptedBody)
                console.log("payload.data: ", payload.data)

                // Mostrar notificación con mensaje descifrado
                const notificationOptions: NotificationOptions = {
                    body: decryptedBody,
                    icon: payload.icon || '/icon-192x192.png',
                    data: payload.data || {},
                };

                await self.registration.showNotification(payload.title, notificationOptions);
                console.log('[SW] Notificación mostrada con mensaje descifrado');
            } catch (error) {
                console.error('[SW] Error crítico en evento push:', error);
                // Mostrar notificación genérica en caso de error
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