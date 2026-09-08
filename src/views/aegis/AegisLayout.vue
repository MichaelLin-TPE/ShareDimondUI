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

// 子頁背景:沿用首屏影片(壓暗+微模糊)讓整站同一個世界;手機/減少動態改用靜態畫格,省流量也省電
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
// ?v= 是快取版本號,換檔就 +1(首頁 HomePage 那支也要同步)
const stillSrc = `${base}/aegis/hero-still.jpg?v=4`
const videoSrc = `${base}/aegis/hero.mp4?v=4`
const bgVideo = ref(false)

// 餘燼粒子:固定在整頁背後,從畫面下方慢慢往上飄,讓黑色區域有呼吸感(reduced-motion 不畫)
const emberEl = ref<HTMLCanvasElement | null>(null)
let emberStop: (() => void) | null = null

function startEmbers(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  let w = 0, h = 0, raf = 0, last = performance.now()
  type P = { x: number; y: number; r: number; vy: number; sway: number; ph: number; a: number; life: number; max: number }
  let ps: P[] = []
  const count = () => (w < 700 ? 34 : 80)
  const spawn = (fromBottom: boolean): P => ({
    x: Math.random() * w, y: fromBottom ? h + 10 : Math.random() * h,
    r: 1 + Math.random() * 2.4, vy: 12 + Math.random() * 26,
    sway: 6 + Math.random() * 14, ph: Math.random() * Math.PI * 2,
    a: 0.6 + Math.random() * 0.4, life: 0, max: 9 + Math.random() * 10,
  })
  const resize = () => {
    w = window.innerWidth; h = window.innerHeight
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr)
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ps = Array.from({ length: count() }, () => spawn(false))
  }
  const tick = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]!
      p.life += dt; p.y -= p.vy * dt; p.x += Math.sin(t / 1000 + p.ph) * p.sway * dt
      const k = p.life / p.max, fade = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1
      if (p.y < -10 || k >= 1) { ps[i] = spawn(true); continue }
      const a = p.a * Math.max(0, fade)
      // 光暈(柔)
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5)
      g.addColorStop(0, `rgba(255, 170, 80, ${a * 0.55})`)
      g.addColorStop(0.45, `rgba(232, 132, 42, ${a * 0.25})`)
      g.addColorStop(1, 'rgba(232, 132, 42, 0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); ctx.fill()
      // 亮核心(清晰的一點)
      ctx.fillStyle = `rgba(255, 226, 170, ${a})`
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
    }
    raf = requestAnimationFrame(tick)
  }
  const onVis = () => {
    if (document.hidden) cancelAnimationFrame(raf)
    else { last = performance.now(); raf = requestAnimationFrame(tick) }
  }
  resize()
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', onVis)
  raf = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVis)
  }
}

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
  const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const wide = window.matchMedia && window.matchMedia('(min-width: 960px)').matches
  bgVideo.value = !rm && wide
  if (!rm && emberEl.value) emberStop = startEmbers(emberEl.value)
})
onUnmounted(() => {
  document.body.style.overflow = ''
  if (emberStop) emberStop()
})
watch(menuOpen, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <div class="ag-root">
    <!-- 整頁氛圍層(固定):餘燼粒子 + 極淡格線暗角 -->
    <div class="ag-amb" aria-hidden="true">
      <div class="grid"></div>
      <canvas ref="emberEl" class="embers"></canvas>
    </div>
    <!-- 頁尾底圖:山林從黑裡溶出來收尾 -->
    <div class="ag-bg-foot" aria-hidden="true">
      <img :src="stillSrc" alt="" />
      <div class="veil"></div>
    </div>

    <div v-if="!isHome" class="ag-bg" aria-hidden="true">
      <img class="still" :src="stillSrc" alt="" />
      <video v-if="bgVideo" class="vid" :src="videoSrc" autoplay muted loop playsinline></video>
      <div class="veil"></div>
      <div class="grain"></div>
    </div>

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
/* 子頁背景:頂部一段清晰壓暗的雙塔畫面當標題底圖,往下溶進黑;內容區維持乾淨的黑 */
.ag-root { position: relative; }
.ag-bg { position: absolute; top: 0; left: 0; right: 0; height: 72vh; min-height: 520px; z-index: 0; overflow: hidden; pointer-events: none; }
.ag-bg .still, .ag-bg .vid {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 38%;
  filter: brightness(0.62) saturate(0.9);
}
.ag-bg .vid { opacity: 0; animation: ag-bg-in 1.4s ease-out 0.2s forwards; }
@keyframes ag-bg-in { to { opacity: 1; } }
.ag-bg .veil { position: absolute; inset: 0; background:
  linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.3) 28%, rgba(0, 0, 0, 0.62) 58%, #000 100%); }
.ag-bg .grain { position: absolute; inset: 0; opacity: 0.09; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
/* 整頁氛圍層:固定在最底;格線用暗角遮罩只露中間一點點 */
.ag-amb { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.ag-amb .grid { position: absolute; inset: 0; opacity: 0.9;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.11) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.11) 1px, transparent 1px),
    linear-gradient(rgba(232, 132, 42, 0.16) 1px, transparent 1px),
    linear-gradient(90deg, rgba(232, 132, 42, 0.16) 1px, transparent 1px);
  background-size: 96px 96px, 96px 96px, 480px 480px, 480px 480px;
  -webkit-mask-image: radial-gradient(90% 85% at 50% 55%, #000 0%, rgba(0, 0, 0, 0.6) 55%, transparent 100%);
  mask-image: radial-gradient(90% 85% at 50% 55%, #000 0%, rgba(0, 0, 0, 0.6) 55%, transparent 100%); }
.ag-amb .embers { position: absolute; inset: 0; display: block; }
/* 頁尾底圖:貼在頁面最底,從黑溶出山林 */
.ag-bg-foot { position: absolute; left: 0; right: 0; bottom: 0; height: 60vh; min-height: 420px; z-index: 0; overflow: hidden; pointer-events: none; }
.ag-bg-foot img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 100%; filter: brightness(0.5) saturate(0.85); }
.ag-bg-foot .veil { position: absolute; inset: 0; background: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.82) 40%, rgba(0, 0, 0, 0.55) 100%); }
/* 內容浮在背景層之上(導覽列/選單本身是 fixed,不碰) */
.ag-root > :not(.ag-bg):not(.ag-amb):not(.ag-bg-foot):not(.ag-nav):not(.ag-menu) { position: relative; z-index: 1; }

.ag-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center; gap: 44px;
  padding: 30px 40px;
  transition: background 0.3s;
}
/* 首頁壓在亮影片上,導覽列先鋪一層由上往下的暗幕;子頁純黑再加深 */
.ag-nav { background: linear-gradient(180deg, rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.28) 60%, rgba(0, 0, 0, 0)); }
.ag-nav.solid { background: linear-gradient(180deg, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0)); }
.side { display: flex; align-items: center; gap: 44px; }
.lnk {
  font-size: 13px; font-weight: 400; letter-spacing: 0.08em; white-space: nowrap;
  color: rgba(255, 255, 255, 0.92); position: relative; padding-bottom: 2px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7), 0 1px 12px rgba(0, 0, 0, 0.6);
}
.lnk:hover { color: var(--ag-ink); }
.lnk.on { color: var(--ag-ink); }
.lnk.on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 1px; background: var(--ag-ember); }
.lnk.strong { color: var(--ag-ink); font-weight: 500; }
.lnk.strong::before { content: ''; display: inline-block; width: 5px; height: 5px; background: var(--ag-ember); margin-right: 8px; vertical-align: 1px; box-shadow: 0 0 8px var(--ag-ember-glow); }
.logo { display: flex; align-items: center; flex-shrink: 0; opacity: 0.95; transition: opacity 0.2s; }
.logo:hover { opacity: 1; }
.burger { display: none; font-size: 12px; font-weight: 500; letter-spacing: 0.18em; color: var(--ag-ink); text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7); }

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
  .lnk { font-size: 12px; letter-spacing: 0.04em; }
}
@media (max-width: 960px) {
  .ag-nav { justify-content: space-between; }
  .side { display: none; }
  .burger { display: block; order: 3; }
  .logo { order: 2; position: absolute; left: 50%; transform: translateX(-50%); }
  .ag-nav::before { content: ''; order: 1; width: 40px; }
}
</style>
