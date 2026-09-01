<script setup lang="ts">
/**
 * MotionHunter 專屬廣告浮層。
 * 流程:開站先彈出置中 popup → 關掉後縮成右下常駐卡(不擋功能)→ 可再收成邊緣頁籤。
 * 「不再自動彈出」勾選後寫進 localStorage,下次直接顯示常駐卡不再 popup。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'

type Phase = 'popup' | 'dock' | 'tab'
const KEY = 'mh_promo_v1'

const router = useRouter()
const route = useRoute()
/** 在 MH 介紹頁(/mh)本身不顯示廣告,避免重複 */
const hiddenHere = computed(() => route.name === 'mh')

const ready = ref(false)
const phase = ref<Phase>('dock')
const noPopup = ref(false)
const popupCv = ref<HTMLCanvasElement | null>(null)
const dockCv = ref<HTMLCanvasElement | null>(null)

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
let stop: (() => void) | null = null

function load(): { noPopup?: boolean; collapsed?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ noPopup: noPopup.value, collapsed: phase.value === 'tab' }))
  } catch {
    /* localStorage 不可用時靜默略過 */
  }
}

onMounted(() => {
  const s = load()
  noPopup.value = !!s.noPopup
  phase.value = s.noPopup ? (s.collapsed ? 'tab' : 'dock') : 'popup'
  ready.value = true
  mountAnim()
})
onBeforeUnmount(() => stop?.())

watch(phase, () => {
  persist()
  mountAnim()
})
watch(noPopup, persist)

function mountAnim() {
  stop?.()
  stop = null
  nextTick(() => {
    const cv = phase.value === 'popup' ? popupCv.value : phase.value === 'dock' ? dockCv.value : null
    if (cv) stop = radar(cv)
  })
}

function dismissPopup() {
  phase.value = 'dock'
}
function collapse() {
  phase.value = 'tab'
}
function expand() {
  phase.value = 'dock'
}
function reopen() {
  phase.value = 'popup'
}
function openSite() {
  router.push('/mh') // 站內 MH 介紹頁(公開路由,不外連、不曝光原始碼)
}

/** MH 招牌雷達掃描動畫(canvas)。掃到就亮琥珀光點=偵測到怪。 */
function radar(cv: HTMLCanvasElement): () => void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const ctx = cv.getContext('2d')
  if (!ctx) return () => {}
  const w = cv.width / dpr
  const h = cv.height / dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) / 2 - 3
  const blips: [number, number][] = [
    [0.6, -0.7],
    [0.42, 1.9],
    [0.78, 3.5],
    [0.5, 4.8],
  ]
  let raf = 0
  const t0 = performance.now()
  const draw = (now: number) => {
    const t = (now - t0) / 1000
    const a = (t * 1.7) % (Math.PI * 2)
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(111,168,255,.28)'
    ctx.lineWidth = 1
    for (const rf of [1, 0.62, 0.32]) {
      ctx.beginPath()
      ctx.arc(cx, cy, R * rf, 0, 7)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(cx - R, cy)
    ctx.lineTo(cx + R, cy)
    ctx.moveTo(cx, cy - R)
    ctx.lineTo(cx, cy + R)
    ctx.stroke()
    // sweep wedge
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, R, a - 0.6, a)
    ctx.closePath()
    const lg = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    lg.addColorStop(0, 'rgba(111,168,255,.35)')
    lg.addColorStop(1, 'rgba(111,168,255,0)')
    ctx.fillStyle = lg
    ctx.fill()
    ctx.restore()
    // sweep arm
    ctx.strokeStyle = 'rgba(156,193,255,.9)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    ctx.stroke()
    // blips glow when swept
    for (const [rf, ang] of blips) {
      let d = (a - ang) % (Math.PI * 2)
      if (d < 0) d += Math.PI * 2
      const lit = Math.max(0, 1 - d / 1.2)
      const bx = cx + Math.cos(ang) * R * rf
      const by = cy + Math.sin(ang) * R * rf
      ctx.beginPath()
      ctx.arc(bx, by, 2 + lit * 1.6, 0, 7)
      ctx.fillStyle = `rgba(255,194,75,${0.2 + lit * 0.8})`
      ctx.shadowColor = 'rgba(255,194,75,.9)'
      ctx.shadowBlur = lit * 10
      ctx.fill()
      ctx.shadowBlur = 0
    }
    if (!reduced) raf = requestAnimationFrame(draw)
  }
  draw(performance.now())
  return () => cancelAnimationFrame(raf)
}
</script>

<template>
  <div v-if="ready && !hiddenHere" class="mh-promo">
    <!-- 置中 POPUP splash -->
    <transition name="mh-fade">
      <div v-if="phase === 'popup'" class="mh-overlay" @click.self="dismissPopup">
        <div class="mh-card">
          <button class="mh-x" type="button" @click="dismissPopup" aria-label="關閉">✕</button>
          <div class="mh-hero">
            <canvas ref="popupCv" width="240" height="240" class="mh-radar-lg"></canvas>
          </div>
          <div class="mh-kicker">📡 MotionHunter · 天堂專屬</div>
          <h3 class="mh-title">掛機自動打怪,<b>睡覺也在練功</b></h3>
          <ul class="mh-feats">
            <li><span>🎯</span>動作偵測鎖敵,自動攻擊最近的怪</li>
            <li><span>❤️</span>血魔自動補給,不再暴斃</li>
            <li><span>🧭</span>卡怪自動走位,整晚不卡點</li>
          </ul>
          <button class="mh-cta" type="button" @click="openSite">查看方案 →</button>
          <label class="mh-check">
            <input type="checkbox" v-model="noPopup" />
            不再自動彈出(仍會保留右下小卡)
          </label>
        </div>
      </div>
    </transition>

    <!-- 右下常駐卡 -->
    <transition name="mh-dock">
      <div v-if="phase === 'dock'" class="mh-dock">
        <canvas ref="dockCv" width="132" height="132" class="mh-radar-sm"></canvas>
        <div class="mh-dock-txt">
          <div class="mh-dock-kick">MOTIONHUNTER</div>
          <div class="mh-dock-line">掛機自動打怪 · 動作偵測鎖敵</div>
          <button class="mh-dock-cta" type="button" @click="openSite">查看方案</button>
        </div>
        <div class="mh-dock-ctrls">
          <button class="mh-mini" type="button" @click="reopen" title="看完整介紹">⤢</button>
          <button class="mh-mini" type="button" @click="collapse" title="收起">—</button>
        </div>
      </div>
    </transition>

    <!-- 收起後的邊緣頁籤 -->
    <transition name="mh-tab">
      <button v-if="phase === 'tab'" class="mh-tab" type="button" @click="expand">
        <span class="mh-tab-dot"></span>📡 MH
      </button>
    </transition>
  </div>
</template>

<style scoped>
.mh-promo {
  --mhb: #6fa8ff;
  --mhb2: #9cc1ff;
  --mhpanel: #141b2b;
  --mhpanel2: #0f1626;
  --mhline: #2a3750;
  --mhink: #e8eef8;
  --mhdim: #93a1b8;
  --mhamber: #ffc24b;
  font-family: 'Noto Sans TC', system-ui, sans-serif;
}
.mh-promo button {
  font-family: inherit;
}

/* ── POPUP ── */
.mh-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(6, 10, 17, 0.72);
  backdrop-filter: blur(5px);
}
.mh-card {
  position: relative;
  width: 100%;
  max-width: 360px;
  padding: 26px 24px 20px;
  border-radius: 18px;
  background: linear-gradient(180deg, #17203200, #0d1424), var(--mhpanel);
  border: 1px solid var(--mhline);
  border-top: 2px solid var(--mhb);
  box-shadow:
    0 30px 70px -30px #000,
    0 0 50px -24px rgba(111, 168, 255, 0.6);
  text-align: center;
  box-sizing: border-box;
}
.mh-x {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--mhdim);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: 0.15s;
}
.mh-x:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--mhink);
}
.mh-hero {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}
.mh-radar-lg {
  width: 108px;
  height: 108px;
}
.mh-kicker {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--mhb);
}
.mh-title {
  margin: 6px 0 14px;
  font-size: 1.24rem;
  font-weight: 800;
  color: var(--mhink);
  line-height: 1.35;
}
.mh-title b {
  color: var(--mhb2);
}
.mh-feats {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  text-align: left;
}
.mh-feats li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.86rem;
  color: var(--mhdim);
}
.mh-feats li span {
  flex: none;
  width: 22px;
  text-align: center;
}
.mh-cta {
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 11px;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #06101f;
  background: linear-gradient(180deg, var(--mhb2), var(--mhb));
  box-shadow: 0 10px 24px -10px rgba(111, 168, 255, 0.7);
  cursor: pointer;
  transition: 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
.mh-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px -10px rgba(111, 168, 255, 0.8);
}
.mh-check {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 14px;
  font-size: 0.75rem;
  color: var(--mhdim);
  cursor: pointer;
  user-select: none;
}
.mh-check input {
  width: 14px;
  height: 14px;
  accent-color: var(--mhb);
  cursor: pointer;
}

/* ── DOCK (右下常駐卡) ── */
.mh-dock {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 9990;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100vw - 32px);
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(180deg, #17203233, #0d1424), var(--mhpanel);
  border: 1px solid var(--mhline);
  border-left: 2px solid var(--mhb);
  box-shadow:
    0 22px 50px -26px #000,
    0 0 34px -18px rgba(111, 168, 255, 0.55);
}
.mh-radar-sm {
  width: 52px;
  height: 52px;
  flex: none;
}
.mh-dock-txt {
  min-width: 0;
}
.mh-dock-kick {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--mhb);
}
.mh-dock-line {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--mhink);
  margin: 2px 0 7px;
  white-space: nowrap;
}
.mh-dock-cta {
  padding: 6px 13px;
  border: none;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #06101f;
  background: linear-gradient(180deg, var(--mhb2), var(--mhb));
  cursor: pointer;
  transition: 0.16s;
}
.mh-dock-cta:hover {
  filter: brightness(1.06);
}
.mh-dock-ctrls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: flex-start;
}
.mh-mini {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--mhdim);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: 0.15s;
}
.mh-mini:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--mhink);
}

/* ── TAB (收起後邊緣) ── */
.mh-tab {
  position: fixed;
  right: 0;
  bottom: 96px;
  z-index: 9990;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px 9px 12px;
  border: 1px solid var(--mhline);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: var(--mhpanel);
  color: var(--mhb2);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: -10px 0 30px -16px rgba(111, 168, 255, 0.6);
}
.mh-tab:hover {
  background: var(--mhpanel2);
}
.mh-tab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--mhamber);
  box-shadow: 0 0 8px rgba(255, 194, 75, 0.8);
}

/* ── transitions ── */
.mh-fade-enter-active,
.mh-fade-leave-active {
  transition: opacity 0.28s ease;
}
.mh-fade-enter-from,
.mh-fade-leave-to {
  opacity: 0;
}
.mh-fade-enter-active .mh-card {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.mh-fade-enter-from .mh-card {
  transform: scale(0.92);
}
.mh-dock-enter-active,
.mh-tab-enter-active {
  transition:
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.4s ease;
}
.mh-dock-enter-from {
  opacity: 0;
  transform: translateY(22px) scale(0.96);
}
.mh-tab-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.mh-dock-leave-active,
.mh-tab-leave-active {
  transition: opacity 0.2s ease;
}
.mh-dock-leave-to,
.mh-tab-leave-to {
  opacity: 0;
}

@media (max-width: 480px) {
  .mh-dock {
    right: 12px;
    bottom: 12px;
    padding: 10px 12px;
    gap: 10px;
  }
  .mh-dock-line {
    white-space: normal;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mh-fade-enter-active,
  .mh-fade-leave-active,
  .mh-dock-enter-active,
  .mh-tab-enter-active,
  .mh-cta,
  .mh-fade-enter-active .mh-card {
    transition: none !important;
  }
}
</style>
