import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    authToken: localStorage.getItem('authToken') as string | null,
  }),

  getters: {
    isLogin: (state) => !!state.authToken,
  },

  actions: {
    setToken(token: string) {
      this.authToken = token
      localStorage.setItem('authToken', token)
    },

    clearToken() {
      this.authToken = null
      localStorage.removeItem('authToken')
    },
  },
})
