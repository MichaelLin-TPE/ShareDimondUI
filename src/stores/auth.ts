import { defineStore } from 'pinia'
import type { Member } from '@/types/member.ts'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    authToken: localStorage.getItem('authToken') as string | null,
    member: null as Member | null,
  }),

  getters: {
    isLogin: (state) => !!state.authToken,
  },

  actions: {
    setMember(member: Member) {
      this.member = member
    },
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
