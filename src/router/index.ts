import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
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
