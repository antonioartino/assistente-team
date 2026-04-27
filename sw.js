// Service Worker per notifiche push - Assistente Team
const CACHE_NAME = 'assistente-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Gestisci notifiche push in arrivo
self.addEventListener('push', (event) => {
  let data = { title: '🔔 Promemoria', body: 'Hai un promemoria!' }
  try {
    if (event.data) data = JSON.parse(event.data.text())
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      tag: 'assistente-reminder'
    })
  )
})

// Click sulla notifica → apre l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
