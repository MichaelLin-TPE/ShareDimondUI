import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeName = 'gold' | 'indigo' | 'razer'

export const THEME_STORAGE_KEY = 'app_theme_v1'
export const DEFAULT_THEME: ThemeName = 'indigo'
const VALID_THEMES: readonly ThemeName[] = ['gold', 'indigo', 'razer']

export const THEMES: Array<{
  key: ThemeName
  label: string
  desc: string
  emoji: string
  preview: { light: string; deep: string }
}> = [
  {
    key: 'indigo',
    label: '深藍紫',
    desc: '低調有質感',
    emoji: '🌌',
    preview: { light: '#818cf8', deep: '#4f46e5' },
  },
  {
    key: 'gold',
    label: '經典金',
    desc: '原版鑽石風格',
    emoji: '💎',
    preview: { light: '#ffd166', deep: '#f59e0b' },
  },
  {
    key: 'razer',
    label: '雷蛇綠',
    desc: '電競高識別',
    emoji: '🟢',
    preview: { light: '#44d62c', deep: '#16a34a' },
  },
]

function readSaved(): ThemeName {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v && (VALID_THEMES as readonly string[]).includes(v)) return v as ThemeName
  } catch {}
  return DEFAULT_THEME
}

function applyToDom(t: ThemeName) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', t)
}

export const useThemeStore = defineStore('theme', () => {
  const current = ref<ThemeName>(readSaved())
  applyToDom(current.value)

  function setTheme(t: ThemeName) {
    if (!(VALID_THEMES as readonly string[]).includes(t)) return
    current.value = t
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t)
    } catch {}
    applyToDom(t)
  }

  return { current, setTheme }
})
