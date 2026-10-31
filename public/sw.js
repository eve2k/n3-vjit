/* Push-only service worker. It intentionally does not cache app resources. */
const BUILD_VERSION = '__BUILD_VERSION__'
void BUILD_VERSION
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    const fallback = {
      title: 'Đã đến giờ học tiếng Nhật N3',
      body: 'Dành một chút thời gian ôn tập hôm nay nhé!',
      icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'n3vjit-reminder',
      data: { url: '/?from=push' },
    }
    let options = fallback
    try {
      const data = event.data?.json()
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('invalid_push_payload')
      let target
      try { target = new URL(typeof data.url === 'string' ? data.url : '/', self.location.origin) }
      catch { target = new URL('/', self.location.origin) }
      const safeUrl = target.origin === self.location.origin
        ? `${target.pathname}${target.search}${target.hash}` : '/'
      options = {
        title: typeof data.title === 'string' && data.title.trim() ? data.title.slice(0, 120) : fallback.title,
        body: typeof data.body === 'string' && data.body.trim() ? data.body.slice(0, 500) : fallback.body,
        icon: fallback.icon, badge: fallback.badge,
        tag: typeof data.tag === 'string' && data.tag.trim() ? data.tag.slice(0, 120) : fallback.tag,
        data: { url: safeUrl },
      }
    } catch {
      try {
        const text = event.data?.text()
        if (typeof text === 'string' && text.trim()) options = { ...fallback, body: text.slice(0, 500) }
      } catch { options = fallback }
    }
    try { await self.registration.showNotification(options.title, options) }
    catch { await self.registration.showNotification(fallback.title, fallback) }
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const requested = new URL(event.notification.data?.url || '/', self.location.origin)
  const path = requested.origin === self.location.origin ? requested : new URL('/', self.location.origin)
  path.searchParams.set('from', 'push')
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) return client.navigate(path.href).then(() => client.focus())
    }
    return self.clients.openWindow(path.href)
  })())
})

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const registration = event.newSubscription || await self.registration.pushManager.getSubscription()
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', oldEndpoint: event.oldSubscription?.endpoint, subscription: registration?.toJSON() || null })
  })())
})
