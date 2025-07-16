/// <reference lib="webworker" />

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

self.addEventListener('push', event => {
    console.log('[SW] Evento push recibido');

    try {
        // 3. Manejar payload con tipo definido
        let payload: PushNotificationPayload;

        if (event.data) {
            try {
                payload = event.data.json() as PushNotificationPayload;
                console.log('[SW] Payload parseado:', payload);
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

        // 4. Mostrar notificación con opciones tipadas
        const notificationOptions: NotificationOptions = {
            body: payload.body,
            icon: payload.icon || '/icon-192x192.png',
            data: payload.data || {}
        };

        event.waitUntil(
            self.registration.showNotification(payload.title, notificationOptions)
                .then(() => console.log('[SW] Notificación mostrada con éxito'))
                .catch(error => console.error('[SW] Error mostrando notificación:', error))
        );

    } catch (error) {
        console.error('[SW] Error crítico en evento push:', error);
    }
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