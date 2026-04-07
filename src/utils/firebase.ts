// src/utils/firebase.js
import { initializeApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging' // 👈 新增推播模組

// 你的 Firebase 設定檔
const firebaseConfig = {
  apiKey: 'AIzaSyA2Rfhj_njEQ4U7NpaMs7848El-cC8l6mc',
  authDomain: 'diamond-core-6890c.firebaseapp.com',
  projectId: 'diamond-core-6890c',
  storageBucket: 'diamond-core-6890c.firebasestorage.app',
  messagingSenderId: '1097331343811',
  appId: '1:1097331343811:web:faa1aeeeacc21f2d943d76',
  measurementId: 'G-HS4P85GCB5',
}

// 初始化 Firebase
const app = initializeApp(firebaseConfig)

// 初始化推播服務 (Messaging)
const messaging = getMessaging(app)

// 導出 messaging，讓其他 Vue 元件可以拿它來要 Token 或接收訊息
export { messaging }
