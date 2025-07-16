/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event) => {
    const payload = event.data?.json() || {
        title: 'Nuevo mensaje',
        body: 'Tienes un nuevo mensaje',
        icon: '/icon-192x192.png'
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon,
            data: payload.data
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            const chatClient = clients.find(client =>
                client.url.includes('/chat') && 'focus' in client
            );

            if (chatClient) {
                return chatClient.focus();
            }

            if (self.clients.openWindow && event.notification.data?.url) {
                return self.clients.openWindow(event.notification.data.url);
            }
        })
    );
});