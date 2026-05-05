import { defineStore } from 'pinia'

export type ErrorMode = 'none' | 'timeout' | 'maintenance' | 'crash'

export const useErrorOverlayStore = defineStore('errorOverlay', {
  state: () => ({
    mode: 'none' as ErrorMode,
    message: '' as string,
  }),
  actions: {
    triggerTimeout() {
      // 如果已經顯示其他錯誤,先讓使用者看完一個再說
      if (this.mode !== 'none') return
      this.mode = 'timeout'
      this.message = ''
    },
    triggerMaintenance(message?: string) {
      if (this.mode !== 'none') return
      this.mode = 'maintenance'
      this.message = message ?? ''
    },
    /** 全域 Vue 錯誤 (component setup throw / render throw 等) — 顯示重新整理 fallback */
    triggerCrash(message?: string) {
      if (this.mode !== 'none') return
      this.mode = 'crash'
      this.message = message ?? ''
    },
    dismiss() {
      this.mode = 'none'
      this.message = ''
    },
  },
})
