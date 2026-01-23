import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import ForgotPassword from '@/views/ForgotPassword.vue'
import ResetPassowrd from '@/views/ResetPassowrd.vue'
import DashBoard from '@/views/DashBoard.vue'
import ClanLayout from '@/layouts/ClanLayout.vue'
import Treasure from '@/views/Treasure.vue'
import HistoryBoard from '@/views/HistoryBoard.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/forgot-password',
      name: 'ForgotPassword',
      component: ForgotPassword,
      meta: {
        fullscreen: true,
      },
    },
    {
      path: '/reset-password',
      name: 'ResetPassword',
      component: ResetPassowrd,
      meta: {
        fullscreen: true,
      },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: {
        fullscreen: false,
      },
    },
    // 🔥 重點：血盟主區
    {
      path: '/clan',
      component: ClanLayout, // ← 側邊欄在這
      meta: {
        fullscreen: true,
      },
      children: [
        {
          path: '',
          redirect: '/clan/dashboard', // 預設進首頁
        },
        {
          path: 'dashboard',
          component: DashBoard,
        },
        {
          path: 'treasures',
          component: Treasure,
        },
        {
          path: 'history',
          component: HistoryBoard,
        },
      ],
    },
    // 之後登入成功再打開
    // {
    //   path: '/home',
    //   name: 'home',
    //   component: () => import('../views/HomeView.vue'),
    // },
  ],
})

export default router
