// public/firebase-messaging-sw.js

// --- 加上這段控制生命週期的代碼 ---
self.addEventListener('install', (event) => {
  self.skipWaiting(); // 強制跳過等待狀態，立即安裝新版本
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // 立即接管所有開啟中的分頁
});
// ----------------------------

// 1. 載入 Firebase 核心與推播腳本
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

// 2. 這裡填入你的 Firebase 設定
const firebaseConfig = {
  apiKey: 'AIzaSyA2Rfhj_njEQ4U7NpaMs7848El-cC8l6mc',
  authDomain: 'diamond-core-6890c.firebaseapp.com',
  projectId: 'diamond-core-6890c',
  storageBucket: 'diamond-core-6890c.firebasestorage.app',
  messagingSenderId: '1097331343811',
  appId: '1:1097331343811:web:faa1aeeeacc21f2d943d76',
}

// 3. 初始化背景的 Firebase
firebase.initializeApp(firebaseConfig)
const messaging = firebase.messaging()


// 4. 處理「後台」收到的 Data Message
messaging.onBackgroundMessage(function (payload) {
  console.log('[Service Worker] 收到背景推播: ', payload)

  // 從 data 取值
  const title = payload.data?.title || '系統通知'
  const options = {
    body: payload.data?.body || '您有一則新通知',
    icon: '/share_diamond_logo.png',
    badge: '/share_diamond_logo.png',
    // 把點擊要跳轉的 URL 與型別塞到 data，notificationclick 事件會用到
    data: {
      url: payload.data?.url || '/',
      type: payload.data?.type || '',
    },
  }

  // 手動觸發原生系統通知
  return self.registration.showNotification(title, options)
})

// 5. 監聽通知點擊：自動聚焦既有分頁，或開新視窗
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // 後端可在 data 裡指定 url；沒指定就回到首頁
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // 嘗試聚焦既有同源分頁
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url)
          if (clientUrl.origin === self.location.origin) {
            // 若該分頁不在目標頁，先導向目標頁再聚焦
            if ('navigate' in client && targetUrl && targetUrl !== '/') {
              try {
                await client.navigate(targetUrl)
              } catch (e) {
                // navigate 在某些瀏覽器/狀態下可能失敗，忽略後直接 focus
              }
            }
            return client.focus()
          }
        } catch (e) {
          // URL 解析失敗就跳過該 client
        }
      }

      // 沒有任何分頁開著就開新分頁
      return clients.openWindow(targetUrl)
    })()
  )
})
