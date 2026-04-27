// Registra il service worker per le notifiche push
export async function registerPushNotifications() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker non supportato')
    return null
  }
  if (!('PushManager' in window)) {
    console.warn('Push non supportato su questo browser')
    return null
  }

  try {
    // Registra il service worker
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    // Chiedi permesso notifiche
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('Permesso notifiche negato')
      return null
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey || vapidKey === 'placeholder') {
      console.warn('VAPID key non configurata')
      return null
    }

    // Controlla se già sottoscritto
    const existing = await reg.pushManager.getSubscription()
    if (existing) return existing

    // Nuova sottoscrizione
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    })
    return subscription
  } catch (err) {
    console.error('Errore registrazione push:', err)
    return null
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}

// Mostra notifica locale immediata (utile per conferme)
export function showLocalNotification(title, body) {
  if (!('serviceWorker' in navigator)) return
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200]
      })
    })
  }
}
