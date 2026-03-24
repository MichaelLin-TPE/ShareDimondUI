import { defineStore } from 'pinia'
import type { Member } from '@/types/member.ts'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    // 這裡只需要給初始值 null 即可，套件會自動去 localStorage 幫你撈資料覆蓋上來
    authToken: null as string | null,
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
    },

    clearToken() {
      // 登出時只要把變數清空即可，套件會自動幫你把 localStorage 裡的資料也清掉
      this.authToken = null
      this.member = null
    },
  },

  // 🚀 魔法就在這行！開啟持久化設定
  persist: true,
})
