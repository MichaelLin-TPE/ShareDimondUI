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


// 2. 處理「後台」收到的 Data Message
messaging.onBackgroundMessage(function (payload) {
  console.log('[Service Worker] 收到背景推播: ', payload)

  // 因為後端改成放 data 裡面了，所以我們從 data 取值
  const title = payload.data?.title || '系統通知'
  const options = {
    body: payload.data.body || '您有一則新通知',
    data: {
      type: payload.data.type,
    },
  }

  // 手動觸發原生系統通知
  return self.registration.showNotification(title, options)
})
