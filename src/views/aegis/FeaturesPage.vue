<script setup lang="ts">
// 遊戲特色:跟職業介紹同一套 3D 弧形卡片輪播(中間那張聚焦、跟著滑鼠傾斜),下方索引列一眼看完全部特色,
// 再下面顯示選中那項的重點與「詳細規則」彈窗。特色越加越多頁面也不會變長(2026-09-12 使用者:捲動範圍太大)。
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AgPage from './ui/AgPage.vue'
import { AG_FEATURES, type AgFeature } from '@/data/aegis/features'

const route = useRoute()
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const artOf = (file: string) => `${base}/aegis/art/${file}`

const n = AG_FEATURES.length
const total = String(n).padStart(2, '0')
const active = ref(0)
const cur = computed(() => AG_FEATURES[active.value]!)
let userNav = false   // 使用者自己點/滑才用平滑捲動;帶 #id 進來的第一次直接跳到位(背景分頁的平滑捲動不會跑完)
const go = (i: number) => { userNav = true; active.value = ((i % n) + n) % n }
const next = () => go(active.value + 1)
const prev = () => go(active.value - 1)

// 首頁卡片連過來會帶 #特色id:直接轉到那張
const syncHash = () => {
  const i = AG_FEATURES.findIndex((f) => f.id === (route.hash || '').replace('#', ''))
  if (i >= 0) active.value = i
}

// 聚焦卡的滑鼠傾斜(度)與視差(-1~1)
const tilt = ref({ rx: 0, ry: 0, px: 0, py: 0, on: false })
const onMove = (e: PointerEvent) => {
  const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('.card.on')
  if (!el) return
  const r = el.getBoundingClientRect()
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
    if (tilt.value.on) tilt.value = { rx: 0, ry: 0, px: 0, py: 0, on: false }
    return
  }
  const px = ((e.clientX - r.left) / r.width) * 2 - 1
  const py = ((e.clientY - r.top) / r.height) * 2 - 1
  tilt.value = { rx: -py * 7, ry: px * 10, px, py, on: true }
}
const onLeaveRing = () => { tilt.value = { rx: 0, ry: 0, px: 0, py: 0, on: false } }

// 每張卡相對中央的位移:平移 + 繞 Y 軸轉 + 縮小 + 變暗;聚焦卡再疊上滑鼠傾斜
const cardStyle = (i: number) => {
  let off = i - active.value
  if (off > n / 2) off -= n          // 頭尾接起來:最後一張在第一張左邊
  if (off < -n / 2) off += n
  const a = Math.abs(off)
  const t = off === 0 ? tilt.value : null
  const extra = t && t.on ? ` rotateX(${t.rx.toFixed(2)}deg) rotateY(${t.ry.toFixed(2)}deg)` : ''
  return {
    transform: `translateX(${off * 62}%) translateZ(${-a * 160}px) rotateY(${off * -24}deg) scale(${1 - a * 0.1})${extra}`,
    zIndex: String(10 - a),
    opacity: String(a > 2 ? 0 : 1 - a * 0.22),
    filter: `brightness(${1 - a * 0.3})`,
    pointerEvents: a > 2 ? 'none' : 'auto',
    '--px': t ? String(t.px) : '0',
    '--py': t ? String(t.py) : '0',
    '--mx': t ? `${((t.px + 1) / 2) * 100}%` : '50%',
    '--my': t ? `${((t.py + 1) / 2) * 100}%` : '50%',
  } as Record<string, string>
}

// 滑動切換只給手機(觸控);PC 用點的或方向鍵
let sx = 0, dragging = false
const onDown = (e: PointerEvent) => { if (e.pointerType !== 'touch') return; sx = e.clientX; dragging = true }
const onUp = (e: PointerEvent) => {
  if (!dragging) return
  dragging = false
  const dx = e.clientX - sx
  if (dx < -40) next()
  else if (dx > 40) prev()
}

// 索引列(手機是一排可左右滑):選中的那顆自動捲到中間
const indexEl = ref<HTMLElement | null>(null)
const centerTab = (i: number, smooth: boolean) => {
  const c = indexEl.value
  const t = c?.children[i] as HTMLElement | undefined
  if (!c || !t || c.scrollWidth <= c.clientWidth) return
  const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect()
  c.scrollTo({ left: c.scrollLeft + (tr.left - cr.left) - c.clientWidth / 2 + tr.width / 2, behavior: smooth ? 'smooth' : 'auto' })
}
// 索引列排好/換寬度(字型載入、轉直橫)時再對一次;剛載入那一刻還量不到寬度
let indexRo: ResizeObserver | null = null
watch(active, async (i) => {
  await nextTick()
  centerTab(i, userNav)
})

// 詳細規則:彈窗(畫面暗掉、規則自己一個可捲動面板;Esc / 點外面 / 關閉鈕都能關)
const modal = ref<AgFeature | null>(null)
const closing = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null
const openModal = (f: AgFeature) => {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
  closing.value = false
  modal.value = f
}
// 關閉:先加 closing 類別跑淡出動畫,200ms 後才真的移除(用 timer 不靠 transitionend,穩)
const closeModal = () => {
  if (!modal.value || closing.value) return
  closing.value = true
  closeTimer = setTimeout(() => { modal.value = null; closing.value = false; closeTimer = null }, 200)
}
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeModal()
  else if (!modal.value && e.key === 'ArrowRight') next()
  else if (!modal.value && e.key === 'ArrowLeft') prev()
}
watch(modal, (m) => {
  // 全站 body 自己滾:開窗時鎖住 body,關窗還原
  document.body.style.overflow = m ? 'hidden' : ''
})
watch(() => route.hash, syncHash)

onMounted(() => {
  window.addEventListener('keydown', onKey)
  syncHash()
  if (indexEl.value && typeof ResizeObserver !== 'undefined') {
    indexRo = new ResizeObserver(() => centerTab(active.value, false))
    indexRo.observe(indexEl.value)
  }
})
onUnmounted(() => {
  indexRo?.disconnect()
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <AgPage eyebrow="FEATURES // 遊戲特色" title="這裡才有的玩法。" :sub="`共 ${n} 項特色,點哪張就看哪個。`">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="stage" @pointerdown="onDown" @pointerup="onUp" @pointercancel="dragging = false" @pointerleave="dragging = false">
          <div class="ring" @pointermove="onMove" @pointerleave="onLeaveRing">
            <button
              v-for="(f, i) in AG_FEATURES" :key="f.id" type="button" class="card"
              :class="{ on: i === active, tilt: i === active && tilt.on }" :style="cardStyle(i)"
              :aria-pressed="i === active" :aria-label="`${f.idx} ${f.title}`"
              @click="go(i)"
            >
              <span class="clip">
                <span class="art">
                  <img v-if="f.art" :src="artOf(f.art)" alt="" draggable="false" />
                  <span v-else class="noart ag-cap">{{ f.shot }}</span>
                </span>
                <span class="sheen"></span>
                <span class="shine"></span>
              </span>
              <span class="cap">
                <em class="ag-cap ember">// {{ f.idx }}</em>
                <b>{{ f.title }}</b>
                <i>{{ f.short }}</i>
              </span>
            </button>
          </div>
        </div>

        <!-- 放在 .stage 外面:stage 的觸控左右滑是換卡,索引列自己左右滑不能被當成換卡 -->
        <div ref="indexEl" class="index" role="tablist" aria-label="全部特色">
          <button
            v-for="(f, i) in AG_FEATURES" :key="f.id" type="button" role="tab" class="tab"
            :class="{ on: i === active }" :aria-selected="i === active" @click="go(i)"
          >
            <span class="ti">{{ f.idx }}</span>{{ f.title }}
          </button>
        </div>

        <div :key="cur.id" class="info">
          <div class="ihead">
            <div class="ag-cap ember">// {{ cur.idx }} / {{ total }}</div>
            <h2 class="ag-h">{{ cur.title }}<span class="thin">{{ cur.short }}</span></h2>
            <button v-if="cur.details" type="button" class="ag-btn dbtn" @click="openModal(cur)">
              詳細規則 <span class="arr">→</span>
            </button>
          </div>
          <ul class="points">
            <li v-for="p in cur.points" :key="p" class="ag-body">{{ p }}</li>
          </ul>
          <div v-if="cur.strip && cur.strip.length" class="strip">
            <figure v-for="s in cur.strip" :key="s.file">
              <img :src="artOf(s.file)" :alt="s.cap" loading="lazy" />
              <figcaption class="ag-cap">{{ s.cap }}</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>

    <Teleport to="body">
        <div v-if="modal" class="mw" :class="{ closing }" role="dialog" aria-modal="true" :aria-label="`${modal.title} 詳細規則`" @click.self="closeModal">
          <div class="mw-panel">
            <div class="mw-head">
              <div>
                <div class="ag-cap ember">// {{ modal.idx }} · 詳細規則</div>
                <h2>{{ modal.title }}</h2>
              </div>
              <button type="button" class="mw-close" aria-label="關閉" @click="closeModal">✕</button>
            </div>
            <div class="mw-body">
              <div v-for="(d, i) in modal.details" :key="d.h" class="dsec">
                <div class="dh"><span class="ag-cap ember">{{ String(i + 1).padStart(2, '0') }}</span><h3>{{ d.h }}</h3></div>
                <ul v-if="d.items">
                  <li v-for="it in d.items" :key="it" class="ag-body">{{ it }}</li>
                </ul>
                <div v-if="d.table" class="ag-table-wrap">
                  <table class="ag-table">
                    <thead><tr><th v-for="h in d.table.head" :key="h">{{ h }}</th></tr></thead>
                    <tbody>
                      <tr v-for="(r, ri) in d.table.rows" :key="ri">
                        <td v-for="(c, ci) in r" :key="ci" :class="{ name: ci === 0 }">{{ c }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="mw-foot">
              <button type="button" class="mw-btn" @click="closeModal">看完了,關閉 <span>✕</span></button>
            </div>
          </div>
        </div>
    </Teleport>
  </AgPage>
</template>

<style scoped>
.stage { position: relative; user-select: none; touch-action: pan-y; }
.ring { position: relative; height: 470px; perspective: 1300px; perspective-origin: 50% 38%; overflow: visible; }  /* ⚠️ 不能 preserve-3d:旁邊的卡 translateZ 為負會落到容器平面後方,點擊會被容器接走 */
.card {
  all: unset; cursor: pointer; box-sizing: border-box; position: absolute; left: 50%; top: 24px; width: 420px; height: 410px; margin-left: -210px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(22, 22, 26, 0.92), rgba(6, 6, 8, 0.96));
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s, filter 0.6s, box-shadow 0.3s;
  box-shadow: 1px 1px 0 #2a2a30, 2px 2px 0 #242429, 3px 3px 0 #1e1e23, 4px 4px 0 #18181c, 5px 5px 0 #121215, 6px 6px 0 #0c0c0e,
    0 34px 60px -26px rgba(0, 0, 0, 0.95);
}
.card::before { content: ''; position: absolute; inset: 0; border-radius: 18px; transform: translateZ(-18px); background: linear-gradient(180deg, #1c1c21, #0a0a0c); }
.card.tilt { transition: transform 0.14s ease-out, opacity 0.6s, filter 0.6s, box-shadow 0.3s; }
.card.on {
  background: linear-gradient(180deg, rgba(30, 30, 36, 0.94), rgba(8, 8, 10, 0.97));
  box-shadow: 1px 1px 0 #34343b, 2px 2px 0 #2c2c33, 3px 3px 0 #24242a, 4px 4px 0 #1c1c21, 5px 5px 0 #141418, 6px 6px 0 #0d0d10,
    0 44px 80px -28px rgba(0, 0, 0, 1), 0 0 60px -14px var(--ag-ember-glow);
}
.card:focus-visible { outline: 2px solid var(--ag-ember); outline-offset: 4px; }

/* 卡身平面層:上面是插圖(16:9 不裁),下面是名牌 */
.clip { position: absolute; inset: 0; overflow: hidden; border-radius: 18px; transform: translateZ(1px); }
.art { position: absolute; left: 0; right: 0; top: 0; aspect-ratio: 16 / 9; background: #050810; overflow: hidden; }
.art img { display: block; width: 100%; height: 100%; object-fit: cover; transform: scale(1.04) translateX(calc(var(--px, 0) * -6px)) translateY(calc(var(--py, 0) * -4px)); transition: transform 0.14s ease-out; }
.art::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(8, 8, 10, 0.92)); }
.noart { position: absolute; inset: 0; display: grid; place-items: center; color: var(--ag-ink-50); }
.sheen { position: absolute; left: -60%; top: 0; width: 50%; height: 100%; pointer-events: none; opacity: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.10) 50%, transparent 60%); }
.card.on .sheen { animation: sheen 1.1s ease-out 0.2s 1 forwards; }
@keyframes sheen { 0% { left: -60%; opacity: 1; } 100% { left: 110%; opacity: 0; } }
.shine { position: absolute; inset: 0; opacity: 0; transition: opacity 0.3s; pointer-events: none;
  background: radial-gradient(60% 45% at var(--mx, 50%) var(--my, 50%), rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03) 40%, transparent 70%); }
.card.tilt .shine { opacity: 1; }

/* 名牌:浮出卡面 */
.cap { position: absolute; left: 0; right: 0; bottom: 0; top: calc(420px * 9 / 16 - 18px); padding: 0 22px 20px; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; pointer-events: none;
  transform: translateX(calc(var(--px, 0) * 4px)) translateZ(40px); transition: transform 0.14s ease-out; }
.cap em { font-style: normal; }
.cap b { font-size: 22px; font-weight: 500; letter-spacing: 0.04em; color: var(--ag-ink); text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8); }
.cap i { font-style: normal; font-size: 13px; line-height: 1.6; letter-spacing: 0.04em; color: var(--ag-ink-60); }

/* 索引列:一眼看到全部特色 */
.index { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 18px; }
.tab { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px;
  border: 1px solid var(--ag-line-soft); color: var(--ag-ink-60); font-size: 13px; letter-spacing: 0.06em; white-space: nowrap; transition: color 0.2s, border-color 0.2s, background 0.2s; }
.tab .ti { font-size: 11px; color: var(--ag-ink-35); font-variant-numeric: tabular-nums; transition: color 0.2s; }
.tab:hover { color: var(--ag-ink); border-color: var(--ag-line); }
.tab.on { color: var(--ag-ink); border-color: var(--ag-ember); background: rgba(232, 132, 42, 0.08); }
.tab.on .ti { color: var(--ag-ember); }
.tab:focus-visible { outline: 2px solid var(--ag-ember); outline-offset: 2px; }

/* 選中那項的重點 */
.info { margin-top: 44px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; animation: feat-up 0.45s ease-out; }
@keyframes feat-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.ihead .ag-h { margin: 10px 0 18px; }
.dbtn { margin-top: 4px; height: 40px; padding: 0 18px; }
.dbtn:hover { border-color: var(--ag-ember); color: var(--ag-ember); }
.points { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--ag-line); }
.points li { padding: 12px 0 12px 18px; border-bottom: 1px solid var(--ag-line-soft); position: relative; }
.points li::before { content: ''; position: absolute; left: 0; top: 22px; width: 6px; height: 1px; background: var(--ag-ember); }

/* 多格插畫:橫跨兩欄,排成一排 */
.strip { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.strip figure { margin: 0; border: 1px solid var(--ag-line-soft); background: #050810; overflow: hidden; }
.strip img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.strip figcaption { padding: 10px 12px; color: var(--ag-ink-72); text-transform: none; letter-spacing: 0.06em; }

@media (max-width: 800px) {
  .ring { height: 380px; perspective: 900px; }
  .card { width: 280px; height: 330px; margin-left: -140px; }
  .cap { top: calc(280px * 9 / 16 - 14px); padding: 0 16px 16px; gap: 4px; }
  .cap b { font-size: 19px; }
  .cap i { font-size: 12.5px; }
  .index { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; padding: 2px 2px 8px; margin-top: 12px; scrollbar-width: none; }
  .index::-webkit-scrollbar { display: none; }
  .info { grid-template-columns: 1fr; gap: 22px; margin-top: 28px; }
  .strip { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .card, .info, .art img, .cap { transition: none; animation: none; }
}
</style>

<style>
/* 詳細規則彈窗:Teleport 到 body,所以不能 scoped。全部 .mw- 前綴。 */
.mw {
  /* Teleport 到 body 就拿不到 .ag-root 的變數,這裡自己帶一份給 .ag-cap / .ag-table / .ag-btn 用 */
  --ag-bg: #000; --ag-ink: #fff; --ag-ink-72: rgba(255, 255, 255, 0.72); --ag-ink-60: rgba(255, 255, 255, 0.6);
  --ag-ink-50: rgba(255, 255, 255, 0.5); --ag-ink-35: rgba(255, 255, 255, 0.35);
  --ag-line: rgba(255, 255, 255, 0.22); --ag-line-soft: rgba(255, 255, 255, 0.1);
  --ag-ember: #e8842a; --ag-ember-glow: rgba(232, 132, 42, 0.35);
  --ag-font: 'Inter', 'Noto Sans TC', system-ui, -apple-system, 'Segoe UI', sans-serif;
  position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px;
  background: rgba(0, 0, 0, 0.72); backdrop-filter: blur(10px); font-family: var(--ag-font, 'Inter', 'Noto Sans TC', system-ui, sans-serif); color: #fff; }
.mw-panel { position: relative; width: min(880px, 100%); max-height: min(86vh, 100%); display: flex; flex-direction: column;
  background: #070707; border: 1px solid rgba(255, 255, 255, 0.14); border-top: 2px solid #e8842a;
  box-shadow: 0 40px 90px -30px rgba(0, 0, 0, 1), 0 0 60px -20px rgba(232, 132, 42, 0.35); }
.mw-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 24px 28px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.mw-head h2 { margin: 6px 0 0; font-size: 1.5rem; font-weight: 400; letter-spacing: -0.01em; }
.mw-close { all: unset; cursor: pointer; width: 38px; height: 38px; display: grid; place-items: center; color: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.14); font-size: 14px; transition: 0.2s; }
.mw-close:hover { color: #fff; border-color: #e8842a; }
.mw-body { overflow-y: auto; padding: 8px 28px 6px; overscroll-behavior: contain; }
.mw-body .dsec { padding: 20px 0; }
.mw-body .dsec + .dsec { border-top: 1px solid rgba(255, 255, 255, 0.1); }
.mw-body .dh { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
.mw-body .dh h3 { margin: 0; font-size: 15px; font-weight: 500; letter-spacing: 0.02em; }
.mw-body ul { list-style: none; margin: 0; padding: 0; }
.mw-body li { position: relative; padding: 8px 0 8px 18px; font-size: 13.5px; line-height: 1.7; color: rgba(255, 255, 255, 0.78); border-bottom: 1px solid rgba(255, 255, 255, 0.07); }
.mw-body li::before { content: ''; position: absolute; left: 0; top: 17px; width: 6px; height: 1px; background: #e8842a; }
.mw-body .ag-table-wrap { border-top: 1px solid rgba(255, 255, 255, 0.1); }
.mw-body .ag-table td { white-space: normal; }
.mw-foot { display: flex; justify-content: flex-end; padding: 16px 28px 22px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
/* 全站 main.css 的 button 樣式會漏進來(彈窗不在 .ag-root 底下),這裡完整重設 */
.mw-btn { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 12px; height: 46px; padding: 0 26px;
  background: #e8842a; color: #120800; font-family: inherit; font-size: 13px; font-weight: 700; letter-spacing: 0.14em;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
  transition: background 0.2s, box-shadow 0.2s, transform 0.2s; }
.mw-btn span { font-size: 12px; opacity: 0.8; }
.mw-btn:hover { background: #ffa04a; box-shadow: 0 0 28px rgba(232, 132, 42, 0.45); transform: translateY(-1px); }
.mw-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (max-width: 640px) { .mw-foot { justify-content: stretch; } .mw-btn { width: 100%; justify-content: center; } }

/* 絲滑進出:遮罩淡入,面板從下方 16px 微縮放浮上來;關閉加 .closing 反向跑 */
@keyframes mw-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes mw-panel-in { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes mw-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes mw-panel-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px) scale(0.98); } }
.mw { animation: mw-in 0.28s ease both; }
.mw .mw-panel { animation: mw-panel-in 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.mw.closing { animation: mw-out 0.2s ease both; pointer-events: none; }
.mw.closing .mw-panel { animation: mw-panel-out 0.2s ease both; }

@media (max-width: 640px) {
  .mw { padding: 0; align-items: flex-end; }
  .mw-panel { width: 100%; max-height: 92vh; border-left: 0; border-right: 0; }
  .mw-head { padding: 18px 18px 14px; }
  .mw-body { padding: 4px 18px; }
  .mw-foot { padding: 12px 18px 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .mw, .mw .mw-panel, .mw.closing, .mw.closing .mw-panel { animation: none; }
}
</style>
