// public/firebase-messaging-sw.js

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

// 4. 設定背景收到訊息時的處理行為
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 收到背景推播訊息 ', payload)
  const notificationTitle = payload.notification.title
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico', // 通知上的小圖示
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})
