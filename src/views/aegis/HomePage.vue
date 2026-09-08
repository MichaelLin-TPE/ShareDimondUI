<script setup lang="ts">
// 首頁:Dune hero(滿版影片、內容貼底、兩行標題、hairline、兩欄說明列)+ 數字帶 + 最新消息 + 特色 + 進場 CTA。
import { onMounted, onUnmounted, ref } from 'vue'
import { AG_SITE } from './nav'
import { AG_NEWS } from '@/data/aegis/news'
import { AG_FEATURES } from '@/data/aegis/features'
import FocusText from './ui/FocusText.vue'

// ?v= 是快取版本號:換影片檔就 +1,否則回訪的瀏覽器會一直用舊檔
const videoSrc = `${import.meta.env.BASE_URL}aegis/hero.mp4?v=4`.replace('//aegis', '/aegis')
const rootEl = ref<HTMLElement | null>(null)
const latest = AG_NEWS.slice(0, 3)
const feats = AG_FEATURES.slice(0, 4)
const artBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/aegis/art`

// 數字帶:進視窗才跳數
const stats = [
  { n: 100, suffix: '', cap: '等級上限' },
  { n: 3, suffix: '', cap: '同 IP 多開' },
  { n: 5, suffix: '', cap: '職業' },
  { n: 13, suffix: '', cap: '收藏品 · 永久加屬性' },
]
const shown = ref(stats.map(() => 0))
let io: IntersectionObserver | null = null
let counted = false

function runCount() {
  if (counted) return
  counted = true
  const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (rm) { shown.value = stats.map((s) => s.n); return }
  const t0 = performance.now(), dur = 1100
  const tick = (t: number) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3)
    shown.value = stats.map((s) => Math.round(s.n * e))
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

onMounted(() => {
  const root = rootEl.value
  const els = root ? Array.from(root.querySelectorAll('.ag-reveal')) : []
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); runCount(); return }
  io = new IntersectionObserver((en) => {
    en.forEach((x) => {
      if (!x.isIntersecting) return
      x.target.classList.add('in')
      if (x.target.classList.contains('stats')) runCount()
      if (io) io.unobserve(x.target)
    })
  }, { threshold: 0.15 })
  els.forEach((e) => io!.observe(e))
})
onUnmounted(() => { if (io) io.disconnect() })
</script>

<template>
  <div ref="rootEl">
    <section class="hero">
      <video class="vid" :src="videoSrc" autoplay muted loop playsinline></video>
      <div class="ov a"></div>
      <div class="ov b"></div>
      <div class="ov c"></div>
      <div class="ov d"></div>

      <div class="hero-body">
        <h1 class="ag-h ag-anim" style="--d: 0.15s; --y: 30px">
          <span class="l1"><FocusText :words="['踏進來,', '重新開始', '你的', '天堂。']" /></span>
          <span class="thin">{{ AG_SITE.name }} {{ AG_SITE.latin }} · {{ AG_SITE.tagline }}</span>
        </h1>
        <div class="ag-line ag-anim grow hr" style="--d: 0.4s"></div>
        <div class="ag-row2 ag-anim" style="--d: 0.5s">
          <p class="ag-cap l">經典 3.81 · 衝裝機率公開 · 每日 00:00 重置<br />老玩家的天堂,該有的都在。</p>
          <div class="r">
            <p class="ag-body">釣魚釣到變強、衝裝機率攤開給你看、王族光環、媽祖祝福,想玩的都幫你準備好了。</p>
            <p class="ag-body">練到 100 等、一台電腦開三隻、每天午夜準時重置。倍率、機率全部公開,不用私訊問。</p>
            <div class="cta">
              <RouterLink class="ag-btn primary" to="/aegis/play">點我玩遊戲 <span class="arr">→</span></RouterLink>
              <RouterLink class="ag-btn" to="/aegis/features">遊戲特色</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="ag-section stats ag-reveal">
      <div class="ag-wrap">
        <div class="stat-grid">
          <div v-for="(s, i) in stats" :key="s.cap" class="stat">
            <div class="n">{{ shown[i] }}<span v-if="s.suffix" class="u">{{ s.suffix }}</span></div>
            <div class="ag-cap">{{ s.cap }}</div>
          </div>
          <div class="stat">
            <div class="n">00:00</div>
            <div class="ag-cap">每日重置</div>
          </div>
        </div>
      </div>
    </section>

    <section class="ag-section ag-reveal">
      <div class="ag-wrap">
        <div class="ag-sec-head">
          <div><div class="idx">01 // NEWS</div><h2>最新消息</h2></div>
          <RouterLink to="/aegis/news" class="ag-cap more">全部消息 →</RouterLink>
        </div>
        <div class="news-list">
          <RouterLink v-for="n in latest" :key="n.id" :to="`/aegis/news#${n.id}`" class="news">
            <span class="d">{{ n.date }}</span>
            <span class="t">{{ n.tag }}</span>
            <span class="ti">{{ n.title }}</span>
            <span class="arr">→</span>
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="ag-section ag-reveal">
      <div class="ag-wrap">
        <div class="ag-sec-head">
          <div><div class="idx">02 // FEATURES</div><h2>遊戲特色</h2></div>
          <RouterLink to="/aegis/features" class="ag-cap more">看全部 →</RouterLink>
        </div>
        <div class="ag-grid" :class="feats.length >= 4 ? 'c4' : feats.length >= 2 ? 'c2' : 'c1'">
          <RouterLink v-for="f in feats" :key="f.id" :to="`/aegis/features#${f.id}`" class="ag-card" :class="{ wide: feats.length <= 2 }">
            <div class="ci">// {{ f.idx }}</div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.short }}</p>
            <p v-if="feats.length <= 2" class="more-pts">{{ f.points[0] }}</p>
            <img v-if="feats.length <= 2 && f.art" class="card-art" :src="`${artBase}/${f.art}`" :alt="f.title" />
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="ag-section ag-reveal enter">
      <div class="ag-wrap">
        <div class="ag-line"></div>
        <div class="ag-row2 en">
          <div class="l">
            <div class="ag-cap ember">03 // ENTER</div>
            <h2 class="ag-h">門開著。<span class="thin">下載 AEGIS,三步驟進場。</span></h2>
          </div>
          <div class="r">
            <p class="ag-body">下載登入器、解壓、點兩下,更新自己跑完就能進遊戲。沒有客戶端?找客服拿。</p>
            <div class="cta">
              <RouterLink class="ag-btn primary" to="/aegis/play">點我玩遊戲 <span class="arr">→</span></RouterLink>
              <RouterLink class="ag-btn" to="/aegis/contact">聯絡客服</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero { position: relative; width: 100%; height: 100svh; min-height: 560px; overflow: hidden; }
.vid { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* Dune 的三層覆蓋:整體 13% 暗、上下漸層、頂部一點暖光 */
.ov { position: absolute; pointer-events: none; }
.ov.a { inset: 0; background: rgba(0, 0, 0, 0.05); }
.ov.b { inset: 0; background: linear-gradient(to bottom, rgba(0, 0, 0, 0.17) 0%, transparent 22%, transparent 48%, rgba(0, 0, 0, 0.42) 72%, rgba(0, 0, 0, 0.72) 100%); }
/* 內容區再壓一層暗幕,字才站得住(Dune 原版底部只有 25%,中文細字看不清) */
.ov.d { left: 0; right: 0; bottom: 0; height: 42%; background: linear-gradient(to top, rgba(0, 0, 0, 0.48), rgba(0, 0, 0, 0)); }
.ov.c { top: -14%; left: 50%; transform: translateX(-50%); width: 1000px; height: 720px; background: radial-gradient(ellipse at 50% 30%, rgba(180, 83, 9, 0.05) 0%, transparent 68%); }

.hero-body { position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; padding: 0 var(--ag-gutter) 48px; display: flex; flex-direction: column; }
.hero-body h1 { text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6), 0 2px 40px rgba(0, 0, 0, 0.7); }
.hero-body h1 .thin { color: rgba(255, 255, 255, 0.78); }
.hero-body .l1 { display: block; white-space: nowrap; }
.hero-body .thin { white-space: nowrap; }
.hero-body .hr { margin: 28px 0 22px; }
.hero-body .ag-cap, .hero-body .ag-body { text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65), 0 1px 16px rgba(0, 0, 0, 0.6); }
.hero-body .ag-cap { color: rgba(255, 255, 255, 0.8); }
.hero-body .ag-body { color: rgba(255, 255, 255, 0.9); font-weight: 400; }
.hero-body .ag-line { background: rgba(255, 255, 255, 0.34); }
.cta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }

.stats { padding: 0; }
.stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); border-bottom: 1px solid var(--ag-line-soft); }
.stat { padding: 30px 20px 26px; border-left: 1px solid var(--ag-line-soft); }
.stat:first-child { border-left: 0; padding-left: 0; }
.stat .n { font-size: clamp(1.8rem, 3.4vw, 2.6rem); font-weight: 200; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin-bottom: 10px; }
.stat .n .u { font-size: 0.5em; color: var(--ag-ember); }

.ag-card.wide { padding: 34px 32px; min-height: 260px; }
.ag-card.wide .card-art { position: absolute; right: 0; top: 0; height: 100%; width: 52%; object-fit: cover; object-position: 62% 50%;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 30%); mask-image: linear-gradient(90deg, transparent 0%, #000 30%); pointer-events: none; }
.ag-card.wide .ci, .ag-card.wide h3, .ag-card.wide p { position: relative; z-index: 1; max-width: 50%; }
/* 兩張並排時卡片較窄:圖收窄一點、文字多留一點 */
.ag-grid.c2 .ag-card.wide .card-art { width: 46%; object-position: 55% 50%; }
.ag-grid.c2 .ag-card.wide .ci, .ag-grid.c2 .ag-card.wide h3, .ag-grid.c2 .ag-card.wide p { max-width: 58%; }
.ag-grid.c2 .ag-card.wide h3 { font-size: 1.3rem; }
@media (max-width: 800px) { .ag-card.wide .card-art { display: none; } .ag-card.wide .ci, .ag-card.wide h3, .ag-card.wide p { max-width: none; } }
.ag-card.wide h3 { font-size: 1.5rem; font-family: var(--ag-font); }
.ag-card.wide p { font-size: 15px; max-width: 60ch; }
.ag-card.wide .more-pts { margin-top: 12px; color: var(--ag-ink-50); font-size: 13px; }
.more { color: var(--ag-ink-50); }
.more:hover { color: var(--ag-ink); }
.news-list { border-top: 1px solid var(--ag-line); }
.news { display: grid; grid-template-columns: 110px 60px 1fr 30px; align-items: baseline; gap: 18px; padding: 18px 0; border-bottom: 1px solid var(--ag-line-soft); transition: padding-left 0.25s; }
.news:hover { padding-left: 8px; }
.news .d { font-size: 11px; letter-spacing: 0.1em; color: var(--ag-ink-50); font-variant-numeric: tabular-nums; }
.news .t { font-size: 10px; letter-spacing: 0.16em; color: var(--ag-ember); }
.news .ti { font-size: 14px; font-weight: 300; color: var(--ag-ink); }
.news .arr { color: var(--ag-ink-35); text-align: right; }
.news:hover .arr { color: var(--ag-ember); }

.enter .en { padding: 40px 0 10px; }
.enter .ag-h { margin-top: 12px; }

@media (max-width: 960px) {
  .stat-grid { grid-template-columns: repeat(3, 1fr); }
  .stat:nth-child(4) { border-left: 0; padding-left: 0; }
  .news { grid-template-columns: 96px 1fr 24px; }
  .news .t { display: none; }
}
@media (max-width: 600px) {
  .hero-body { padding-bottom: 32px; }
  .hero-body .l1, .hero-body .thin { white-space: normal; }
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .stat:nth-child(odd) { border-left: 0; padding-left: 0; }
  .stat:nth-child(4) { border-left: 1px solid var(--ag-line-soft); padding-left: 20px; }
}
</style>
