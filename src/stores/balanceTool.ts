import type { Balance } from '@/types/balance.ts'

import { defineStore } from 'pinia'

export const useBalanceStore = defineStore('balance', {
  // 建議 store 名稱與 ID 一致
  state: () => ({
    // 直接定義為 Balance 陣列，初始值給空陣列 []
    balanceList: [] as Balance[],
  }),

  actions: {
    // 傳入參數直接使用陣列類型
    setBalanceList(balances: Balance[]) {
      this.balanceList = balances
    },
  },
})
