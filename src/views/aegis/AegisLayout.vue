<script setup lang="ts">
// 神盾天堂官網 layout:Dune 式透明導覽列(左右連結 + 中央 gateway logo,無 CTA 按鈕)+ 頁尾 + 子頁出口。
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AG_NAV, AG_SITE } from './nav'
import './aegis.css'

const route = useRoute()
const left = AG_NAV.filter((n) => n.side === 'left')
const right = AG_NAV.filter((n) => n.side === 'right')
const menuOpen = ref(false)
const isHome = computed(() => route.path === '/aegis' || route.path === '/aegis/')

function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    // 全站 main.css 讓 body 自己滾(不是 window),兩個都重設才保險
    window.scrollTo({ top: 0, behavior: 'auto' })
    document.body.scrollTop = 0
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0
  },
)

onMounted(() => {
  const FID = 'ag-fonts'
  if (!document.getElementById(FID)) {
    const l = document.createElement('link')
    l.id = FID
    l.rel = 'stylesheet'
    l.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap'
    document.head.appendChild(l)
  }
  document.title = `${AG_SITE.name} ${AG_SITE.latin}`
})
onUnmounted(() => {
  document.body.style.overflow = ''
})
watch(menuOpen, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <div class="ag-root">
    <nav class="ag-nav ag-anim" :class="{ solid: !isHome }" style="--y: -12px">
      <div class="side l">
        <RouterLink v-for="n in left" :key="n.to" :to="n.to" class="lnk" :class="{ on: isActive(n.to), strong: n.strong }">{{ n.label }}</RouterLink>
      </div>

      <RouterLink to="/aegis" class="logo" :aria-label="AG_SITE.name">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11" stroke="#fff" stroke-width="1" opacity="0.5" fill="none" />
          <rect x="8.1" y="6" width="2.3" height="12" rx="1.15" fill="#fff" />
          <rect x="13.6" y="6" width="2.3" height="12" rx="1.15" fill="#fff" />
        </svg>
      </RouterLink>

      <div class="side r">
        <RouterLink v-for="n in right" :key="n.to" :to="n.to" class="lnk" :class="{ on: isActive(n.to), strong: n.strong }">{{ n.label }}</RouterLink>
      </div>

      <button class="burger" type="button" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">{{ menuOpen ? 'CLOSE' : 'MENU' }}</button>
    </nav>

    <div v-if="menuOpen" class="ag-menu">
      <div class="ag-menu-list">
        <RouterLink v-for="(n, i) in AG_NAV" :key="n.to" :to="n.to" class="mlnk" :class="{ on: isActive(n.to), strong: n.strong }" :style="{ '--d': i * 0.04 + 's' }">
          <span class="i">{{ String(i + 1).padStart(2, '0') }}</span>{{ n.label }}
        </RouterLink>
      </div>
    </div>

    <RouterView />

    <footer class="ag-foot">
      <div class="ag-wrap">
        <div class="ag-line soft"></div>
        <div class="ag-row2 fr">
          <div class="l">
            <div class="brand">{{ AG_SITE.name }} <span>{{ AG_SITE.latin }}</span></div>
            <p class="ag-cap">{{ AG_SITE.tagline }} · 由 <a href="https://gameshare-system.com" target="_blank" rel="noopener">分寶 GameShare</a> 提供</p>
          </div>
          <div class="r links">
            <RouterLink v-for="n in AG_NAV" :key="n.to" :to="n.to" class="ag-cap">{{ n.label }}</RouterLink>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.ag-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center; gap: 44px;
  padding: 30px 40px;
  transition: background 0.3s;
}
/* 子頁背景是純黑,導覽列加一層淡漸層保持可讀 */
.ag-nav.solid { background: linear-gradient(180deg, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0)); }
.side { display: flex; align-items: center; gap: 44px; }
.lnk {
  font-size: 12px; font-weight: 300; letter-spacing: 0.08em; white-space: nowrap;
  color: var(--ag-ink-72); position: relative; padding-bottom: 2px;
}
.lnk:hover { color: var(--ag-ink); }
.lnk.on { color: var(--ag-ink); }
.lnk.on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 1px; background: var(--ag-ember); }
.lnk.strong { color: var(--ag-ink); font-weight: 500; }
.lnk.strong::before { content: ''; display: inline-block; width: 5px; height: 5px; background: var(--ag-ember); margin-right: 8px; vertical-align: 1px; box-shadow: 0 0 8px var(--ag-ember-glow); }
.logo { display: flex; align-items: center; flex-shrink: 0; opacity: 0.95; transition: opacity 0.2s; }
.logo:hover { opacity: 1; }
.burger { display: none; font-size: 11px; letter-spacing: 0.18em; color: var(--ag-ink); }

.ag-menu { position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, 0.94); backdrop-filter: blur(8px); display: flex; align-items: center; padding: 90px 24px 40px; overflow-y: auto; }
.ag-menu-list { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.mlnk { display: flex; align-items: baseline; gap: 16px; padding: 12px 0; font-size: 22px; font-weight: 300; letter-spacing: 0.02em; color: var(--ag-ink-72); border-bottom: 1px solid var(--ag-line-soft); opacity: 0; animation: ag-up 0.5s ease-out forwards; animation-delay: var(--d); }
.mlnk .i { font-size: 10px; letter-spacing: 0.18em; color: var(--ag-ember); }
.mlnk.on { color: var(--ag-ink); }
.mlnk.strong { color: var(--ag-ink); font-weight: 400; }

.ag-foot { padding: 40px 0 36px; }
.ag-foot .fr { padding-top: 26px; }
.ag-foot .brand { font-size: 14px; font-weight: 500; letter-spacing: 0.06em; margin-bottom: 8px; }
.ag-foot .brand span { color: var(--ag-ink-50); font-weight: 300; margin-left: 6px; letter-spacing: 0.2em; }
.ag-foot .ag-cap a { color: var(--ag-ink); }
.ag-foot .links { flex-direction: row; flex-wrap: wrap; gap: 8px 22px; max-width: 520px; }
.ag-foot .links a:hover { color: var(--ag-ink); }

@media (max-width: 1100px) {
  .ag-nav { gap: 28px; padding: 24px 24px; }
  .side { gap: 24px; }
  .lnk { font-size: 11px; letter-spacing: 0.04em; }
}
@media (max-width: 960px) {
  .ag-nav { justify-content: space-between; }
  .side { display: none; }
  .burger { display: block; order: 3; }
  .logo { order: 2; position: absolute; left: 50%; transform: translateX(-50%); }
  .ag-nav::before { content: ''; order: 1; width: 40px; }
}
</style>
