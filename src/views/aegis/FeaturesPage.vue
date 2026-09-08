<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AgPage from './ui/AgPage.vue'
import { AG_FEATURES, type AgFeature } from '@/data/aegis/features'

const route = useRoute()
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const artOf = (file: string) => `${base}/aegis/art/${file}`

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
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
watch(modal, (m) => {
  // 全站 body 自己滾:開窗時鎖住 body,關窗還原
  document.body.style.overflow = m ? 'hidden' : ''
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  const h = (route.hash || '').replace('#', '')
  if (h) requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }))
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <AgPage eyebrow="FEATURES // 遊戲特色" title="這裡才有的玩法。" sub="不只練功打寶,還有別的地方玩不到的。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div v-for="(f, i) in AG_FEATURES" :key="f.id" :id="f.id" class="feat" :class="{ flip: i % 2 === 1 }">
          <div v-if="f.art" class="art"><img :src="artOf(f.art)" :alt="f.title" /></div>
          <div v-else class="ag-shot"><span class="ag-cap">{{ f.shot }} · 截圖待補</span></div>
          <div class="txt">
            <div class="ag-cap ember">// {{ f.idx }}</div>
            <h2 class="ag-h">{{ f.title }}<span class="thin">{{ f.short }}</span></h2>
            <ul>
              <li v-for="p in f.points" :key="p" class="ag-body">{{ p }}</li>
            </ul>
            <button v-if="f.details" type="button" class="ag-btn dbtn" @click="openModal(f)">
              詳細規則 <span class="arr">→</span>
            </button>
          </div>
          <div v-if="f.strip && f.strip.length" class="strip">
            <figure v-for="s in f.strip" :key="s.file">
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
.feat { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; padding: 40px 0; border-bottom: 1px solid var(--ag-line-soft); scroll-margin-top: 90px; }
.feat.flip .ag-shot, .feat.flip .art { order: 2; }
.art { position: relative; aspect-ratio: 16 / 9; border: 1px solid var(--ag-line-soft); overflow: hidden; background: #050810; box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.9); }
.art::after { content: ''; position: absolute; top: 0; left: 0; width: 22px; height: 22px; border-top: 2px solid var(--ag-ember); border-left: 2px solid var(--ag-ember); opacity: 0.9; }
.art img { display: block; width: 100%; height: 100%; object-fit: cover; }
.txt .ag-h { margin: 10px 0 18px; }
ul { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--ag-line); }
li { padding: 10px 0 10px 18px; border-bottom: 1px solid var(--ag-line-soft); position: relative; }
li::before { content: ''; position: absolute; left: 0; top: 18px; width: 6px; height: 1px; background: var(--ag-ember); }
.dbtn { margin-top: 22px; height: 40px; padding: 0 18px; }
.dbtn:hover { border-color: var(--ag-ember); color: var(--ag-ember); }

/* 多格插畫:橫跨兩欄,排成一排 */
.strip { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 8px; }
.strip figure { margin: 0; border: 1px solid var(--ag-line-soft); background: #050810; overflow: hidden; transition: border-color 0.25s, transform 0.25s; }
.strip figure:hover { border-color: var(--ag-ember); transform: translateY(-3px); }
.strip img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.strip figcaption { padding: 10px 12px; color: var(--ag-ink-72); text-transform: none; letter-spacing: 0.06em; }

@media (max-width: 800px) {
  .feat { grid-template-columns: 1fr; gap: 22px; }
  .feat.flip .ag-shot, .feat.flip .art { order: 0; }
  .strip { grid-template-columns: 1fr; }
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
