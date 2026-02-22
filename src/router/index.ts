import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import ForgotPassword from '@/views/ForgotPassword.vue'
import ResetPassowrd from '@/views/ResetPassowrd.vue'
import DashBoard from '@/views/DashBoard.vue'
import ClanLayout from '@/layouts/ClanLayout.vue'
import ShareHistory from '@/views/ShareHistory.vue'
import HistoryBoard from '@/views/HistoryBoard.vue'
import TransferPage from '@/views/TransferPage.vue'
import WithdrawPage from '@/views/WithdrawPage.vue'
import MemberRolePage from '@/views/MemberRolePage.vue'
import VerifyWithdrawPage from '@/views/VerifyWithdrawPage.vue'
import CreateGuild from '@/views/CreateGuild.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
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
      path: '/create-guild',
      name: 'CreateGuild',
      component: CreateGuild,
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
          component: ShareHistory,
        },
        {
          path: 'history',
          component: HistoryBoard,
        },
        {
          path: 'transfer',
          component: TransferPage,
        },
        {
          path: 'withdraw',
          component: WithdrawPage,
        },
        {
          path: 'memberRole',
          component: MemberRolePage,
        },
        {
          path: 'verifyWithdraw',
          component: VerifyWithdrawPage,
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
