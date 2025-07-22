/// <reference lib="webworker" />
importScripts('sw-crypto-db.js', 'sw-crypto-utils.js', 'libsodium-wrappers.js');
import libsodium from 'libsodium-wrappers';
import { base64ToBuffer } from './utils/encodingUtils';
import { getItem } from './utils/db';

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

    event.waitUntil((async () => {
        // --- 1) Parsear payload existente ---
        let payload: PushNotificationPayload;
        if (event.data) {
            try {
                payload = await event.data.json() as PushNotificationPayload;
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

        console.log("1 payload.body :", payload.body)

        // --- 2) Desencriptar payload.body ---
        try {
            // 2.1 Leer sesión para obtener username
            const session = await getItem('sessions', 'current_user');
            const username = session?.username as string;
            if (!username) throw new Error('Sin usuario en sesión');

            // 2.2 Obtener clave de dispositivo y derivada
            const deviceItem = await getItem('device_keys', 'deviceKey');
            const deviceKey = await crypto.subtle.importKey(
                'raw',
                base64ToBuffer(deviceItem.rawKey),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            const derivedMeta = await getItem('crypto_keys', `derivedKey_${username}`);
            const derivedRaw = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: base64ToBuffer(derivedMeta.iv) },
                deviceKey,
                base64ToBuffer(derivedMeta.encryptedData)
            );
            const derivedKey = await crypto.subtle.importKey(
                'raw',
                derivedRaw,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            // 2.3 Obtener y descifrar clave privada
            const pkMeta = await getItem('crypto_keys', `privateKey_${username}`);
            const pkRaw = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: base64ToBuffer(pkMeta.iv) },
                derivedKey,
                base64ToBuffer(pkMeta.encryptedKey)
            );
            const privateKeyBase64 = new TextDecoder().decode(pkRaw);

            // 2.4 Desencriptar mensaje con libsodium
            await libsodium.ready;
            const pkBytes = libsodium.from_base64(privateKeyBase64);
            const pubBytes = libsodium.crypto_scalarmult_base(pkBytes);
            const cipherBytes = libsodium.from_base64(payload.body);
            const clearBytes = libsodium.crypto_box_seal_open(cipherBytes, pubBytes, pkBytes);
            payload.body = libsodium.to_string(clearBytes);
            console.log("2 Payload.body :", payload.body)

        } catch (decryptionError) {
            console.warn('[SW] No se pudo desencriptar mensaje:', decryptionError);
            // payload.body queda como ciphertext
        }

        // --- 3) Mostrar notificación con body desencriptado (o ciphertext si falló) ---
        await self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/icon-192x192.png',
            data: payload.data
        });
        console.log('[SW] Notificación mostrada');

    })());
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