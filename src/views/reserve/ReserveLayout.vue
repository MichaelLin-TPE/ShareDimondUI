<script setup lang="ts">
// 神盾天堂「事前預約」獨立站外框:自己的頂欄與頁尾,跟官網分開。樣式變數沿用官網的 aegis.css(.ag-root)。
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { restoreSession, session } from '@/views/aegis/prereg/api'
import '@/views/aegis/aegis.css'

const route = useRoute()
const isHome = computed(() => route.path === '/reserve' || route.path === '/reserve/')
const scrolled = ref(false)
const stillSrc = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/aegis/hero-still.jpg?v=4`

/** 頂欄右邊的主按鈕:沒預約 → 立即預約;有帳號沒角色 → 繼續創角;預約好了 → 我的角色 */
const cta = computed(() => (session.character ? '我的角色' : session.token ? '繼續創角' : '立即預約'))

// 全站 main.css 讓 body 自己滾(不是 window),兩個都要看
function scrollTop() {
  return Math.max(window.scrollY, document.body.scrollTop, document.scrollingElement?.scrollTop ?? 0)
}
const onScroll = () => (scrolled.value = scrollTop() > 40)

watch(
  () => route.path,
  () => {
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
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap'
    document.head.appendChild(l)
  }
  document.title = '神盾天堂 事前預約｜長期經營的經典天堂私服 開服前搶先創角'
  window.addEventListener('scroll', onScroll, { passive: true })
  document.body.addEventListener('scroll', onScroll, { passive: true })
  restoreSession().catch(() => {})
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  document.body.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="ag-root rv-root">
    <!-- 子頁(創角、塔防)頂部一段壓暗的雙塔當底圖,往下溶進黑 -->
    <div v-if="!isHome" class="rv-bg" aria-hidden="true">
      <img :src="stillSrc" alt="" />
      <div class="veil"></div>
    </div>

    <nav class="rv-bar" :class="{ solid: scrolled || !isHome }">
      <RouterLink to="/reserve" class="brand" aria-label="神盾天堂 事前預約">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="11" stroke="#fff" stroke-width="1" opacity="0.5" />
          <rect x="8.1" y="6" width="2.3" height="12" rx="1.15" fill="#fff" />
          <rect x="13.6" y="6" width="2.3" height="12" rx="1.15" fill="#fff" />
        </svg>
        <span class="nm">神盾天堂</span>
        <span class="tag">事前預約</span>
      </RouterLink>

      <div class="links">
        <RouterLink :to="{ path: '/reserve', hash: '#rewards' }">預約獎勵</RouterLink>
        <RouterLink :to="{ path: '/reserve', hash: '#features' }">遊戲特色</RouterLink>
        <RouterLink :to="{ path: '/reserve', hash: '#classes' }">職業</RouterLink>
        <RouterLink to="/reserve/td" :class="{ on: route.path === '/reserve/td' }">天堂塔防</RouterLink>
        <a href="/#/aegis" class="site">遊戲官網 <span aria-hidden="true">↗</span></a>
      </div>

      <RouterLink to="/reserve/create" class="go" :class="{ on: route.path === '/reserve/create' }">{{ cta }}</RouterLink>
    </nav>

    <RouterView />

    <footer class="rv-foot">
      <div class="ag-wrap">
        <div class="ag-line soft"></div>
        <div class="row">
          <div>
            <div class="fb">神盾天堂 <span>AEGIS</span></div>
            <p class="ag-cap">長期經營的經典天堂 · 事前預約</p>
          </div>
          <div class="fl">
            <a href="/#/aegis">想看遊戲內容?前往遊戲官網 →</a>
            <a href="/#/aegis/contact">聯絡客服</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.rv-root { position: relative; }
.rv-root > :not(.rv-bg):not(.rv-bar) { position: relative; z-index: 1; }

.rv-bg { position: absolute; top: 0; left: 0; right: 0; height: 60vh; min-height: 440px; z-index: 0; overflow: hidden; pointer-events: none; }
.rv-bg img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 38%; filter: brightness(0.5) saturate(0.85); }
.rv-bg .veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.45) 35%, #000 100%); }

.rv-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50; height: 68px; padding: 0 32px;
  display: flex; align-items: center; gap: 28px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
  transition: background 0.3s, border-color 0.3s; border-bottom: 1px solid transparent;
}
.rv-bar.solid { background: rgba(6, 6, 6, 0.86); backdrop-filter: blur(10px); border-bottom-color: var(--ag-line-soft); }
.brand { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.brand .nm { font-size: 15px; font-weight: 500; letter-spacing: 0.12em; }
.brand .tag { font-size: 11px; letter-spacing: 0.16em; padding: 3px 8px; border: 1px solid var(--ag-ember); color: var(--ag-ember); }
.links { flex: 1; display: flex; justify-content: flex-end; align-items: center; gap: 30px; }
.links a { font-size: 13.5px; letter-spacing: 0.08em; color: var(--ag-ink-72); white-space: nowrap; }
.links a:hover, .links a.on { color: var(--ag-ink); }
.links .site { color: var(--ag-ink-50); }
.go {
  flex-shrink: 0; height: 40px; padding: 0 22px; display: inline-flex; align-items: center;
  font-size: 13.5px; font-weight: 600; letter-spacing: 0.14em; color: #140900; background: var(--ag-ember);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  transition: box-shadow 0.2s, filter 0.2s;
}
.go:hover { box-shadow: 0 0 26px var(--ag-ember-glow); filter: brightness(1.08); color: #140900; }

.rv-foot { padding: 30px 0 40px; }
.rv-foot .row { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; padding-top: 24px; }
.rv-foot .fb { font-size: 14px; font-weight: 500; letter-spacing: 0.06em; margin-bottom: 6px; }
.rv-foot .fb span { color: var(--ag-ink-50); font-weight: 300; margin-left: 6px; letter-spacing: 0.2em; }
.rv-foot .fl { display: flex; gap: 24px; flex-wrap: wrap; font-size: 14px; }
.rv-foot .fl a { color: var(--ag-ink-72); }
.rv-foot .fl a:first-child { color: var(--ag-ember); }
.rv-foot .fl a:hover { color: var(--ag-ink); }

@media (max-width: 860px) {
  .rv-bar { padding: 0 16px; gap: 12px; height: 60px; }
  .links a:not(.site) { display: none; }
  .links { gap: 0; }
  .brand .nm { font-size: 14px; }
  .go { height: 36px; padding: 0 14px; font-size: 13px; letter-spacing: 0.08em; }
}
@media (max-width: 420px) {
  .brand .tag { display: none; }
  .links .site { font-size: 12.5px; }
}
</style>
