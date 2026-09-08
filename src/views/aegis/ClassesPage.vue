<script setup lang="ts">
// 職業介紹:3D 弧形卡片輪播(中間那張聚焦放大、跟著滑鼠傾斜、人物浮在卡面上),下方顯示定位與起始素質。
import { computed, ref } from 'vue'
import AgPage from './ui/AgPage.vue'
import { AG_CLASSES } from '@/data/aegis/classes'

const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const artOf = (id: string) => `${base}/aegis/classes/${id}.png`

const active = ref(0)
const n = AG_CLASSES.length
const cur = computed(() => AG_CLASSES[active.value]!)
const go = (i: number) => { active.value = ((i % n) + n) % n }
const next = () => go(active.value + 1)
const prev = () => go(active.value - 1)

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
  const px = ((e.clientX - r.left) / r.width) * 2 - 1 // -1(左) ~ 1(右)
  const py = ((e.clientY - r.top) / r.height) * 2 - 1 // -1(上) ~ 1(下)
  tilt.value = { rx: -py * 9, ry: px * 12, px, py, on: true }
}
const onLeaveRing = () => { tilt.value = { rx: 0, ry: 0, px: 0, py: 0, on: false } }

// 每張卡相對中央的位移:平移 + 繞 Y 軸轉 + 縮小 + 變暗;聚焦卡再疊上滑鼠傾斜
const cardStyle = (i: number) => {
  const off = i - active.value
  const a = Math.abs(off)
  const t = off === 0 ? tilt.value : null
  const extra = t && t.on ? ` rotateX(${t.rx.toFixed(2)}deg) rotateY(${t.ry.toFixed(2)}deg)` : ''
  return {
    transform: `translateX(${off * 62}%) translateZ(${-a * 160}px) rotateY(${off * -26}deg) scale(${1 - a * 0.1})${extra}`,
    zIndex: String(10 - a),
    opacity: String(a > 2 ? 0 : 1 - a * 0.22),
    filter: `brightness(${1 - a * 0.28})`,
    pointerEvents: a > 2 ? 'none' : 'auto',
    '--px': t ? String(t.px) : '0',
    '--py': t ? String(t.py) : '0',
    '--mx': t ? `${((t.px + 1) / 2) * 100}%` : '50%',
    '--my': t ? `${((t.py + 1) / 2) * 100}%` : '50%',
  } as Record<string, string>
}

// 滑動切換只給手機(觸控);PC 用點的
let sx = 0, dragging = false
const onDown = (e: PointerEvent) => { if (e.pointerType !== 'touch') return; sx = e.clientX; dragging = true }
const onUp = (e: PointerEvent) => {
  if (!dragging) return
  dragging = false
  const dx = e.clientX - sx
  if (dx < -40) next()
  else if (dx > 40) prev()
}

const statRows = [
  ['STR 力量', 'str'], ['DEX 敏捷', 'dex'], ['CON 體質', 'con'], ['WIS 精神', 'wis'], ['CHA 魅力', 'cha'], ['INT 智力', 'int'],
] as const
</script>

<template>
  <AgPage eyebrow="CLASSES // 職業介紹" title="五個職業。" sub="點哪張,就看哪個。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="stage" @pointerdown="onDown" @pointerup="onUp" @pointercancel="dragging = false" @pointerleave="dragging = false">
          <div class="ring" @pointermove="onMove" @pointerleave="onLeaveRing">
            <button
              v-for="(c, i) in AG_CLASSES" :key="c.id" type="button" class="card"
              :class="{ on: i === active, tilt: i === active && tilt.on }" :style="cardStyle(i)" :aria-pressed="i === active"
              @click="go(i)"
            >
              <!-- 卡身(平面層,裁切在卡內):底紋、光暈、掃光、名牌底、隨滑鼠移動的高光 -->
              <span class="clip">
                <span class="wm">{{ c.latin }}</span>
                <span class="glow"></span>
                <span class="sheen"></span>
                <span class="shine"></span>
                <span class="capbg"></span>
              </span>
              <!-- 浮出卡面的層:人物、內框、名牌 -->
              <img :src="artOf(c.id)" :alt="c.name" class="fig" draggable="false" />
              <span class="cap">
                <b>{{ c.name }}</b>
                <i>{{ c.role }}</i>
              </span>
            </button>
          </div>
          <div class="dots">
            <button v-for="(c, i) in AG_CLASSES" :key="c.id" type="button" class="dot" :class="{ on: i === active }" :aria-label="c.name" @click="go(i)"></button>
          </div>
        </div>

        <div class="info" :key="cur.id">
          <div class="ihead">
            <div>
              <div class="ag-cap ember">{{ cur.latin }}</div>
              <h2 class="ag-h">{{ cur.name }}<span class="thin">{{ cur.role }}</span></h2>
            </div>
            <p class="ag-body desc">{{ cur.desc }}</p>
          </div>
          <div class="stats">
            <div v-for="[label, key] in statRows" :key="key" class="srow">
              <span class="k ag-cap">{{ label }}</span>
              <span class="bar"><i :style="{ width: (cur.stats[key] / 18) * 100 + '%' }"></i></span>
              <span class="v">{{ cur.stats[key] }}</span>
            </div>
            <div class="srow bonus">
              <span class="k ag-cap">可加點</span>
              <span class="bar"></span>
              <span class="v ember">+{{ cur.bonus }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.stage { position: relative; user-select: none; touch-action: pan-y; }
.ring { position: relative; height: 540px; perspective: 1300px; perspective-origin: 50% 38%; overflow: visible; }  /* ⚠️ 不能 preserve-3d:旁邊的卡 translateZ 為負會落到容器平面後方,點擊會被容器接走 */
.card {
  all: unset; cursor: pointer; position: absolute; left: 50%; top: 24px; width: 300px; height: 460px; margin-left: -150px;
  /* 金屬感邊框:外框斜向漸層細線;卡身本體在 .clip,這層不裁切,子層才能浮出來(preserve-3d) */
  border: 0; border-radius: 18px;
  background: linear-gradient(180deg, rgba(22, 22, 26, 0.92), rgba(6, 6, 8, 0.96));
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s, filter 0.6s, box-shadow 0.3s;
  /* 厚度:多層 1px 偏移的深銅色影子,卡一轉就看得到側面 */
  box-shadow: 1px 1px 0 #2a2a30, 2px 2px 0 #242429, 3px 3px 0 #1e1e23, 4px 4px 0 #18181c, 5px 5px 0 #121215, 6px 6px 0 #0c0c0e,
    0 34px 60px -26px rgba(0, 0, 0, 0.95);
}
/* 卡背的實心板:往後 18px,轉起來有厚度感 */
.card::before { content: ''; position: absolute; inset: 0; border-radius: 18px; transform: translateZ(-18px); background: linear-gradient(180deg, #1c1c21, #0a0a0c); }
.card.tilt { transition: transform 0.14s ease-out, opacity 0.6s, filter 0.6s, box-shadow 0.3s; }
.card.on {
  background: linear-gradient(180deg, rgba(30, 30, 36, 0.94), rgba(8, 8, 10, 0.97));
  box-shadow: 1px 1px 0 #34343b, 2px 2px 0 #2c2c33, 3px 3px 0 #24242a, 4px 4px 0 #1c1c21, 5px 5px 0 #141418, 6px 6px 0 #0d0d10,
    0 44px 80px -28px rgba(0, 0, 0, 1), 0 0 60px -14px rgba(255, 255, 255, 0.12);
}

/* 卡身平面層 */
.clip { position: absolute; inset: 0; overflow: hidden; border-radius: 18px; transform: translateZ(1px); }
.wm { position: absolute; left: 50%; top: 22px; transform: translateX(calc(-50% + var(--px, 0) * -8px)) translateY(calc(var(--py, 0) * -6px)); font-size: 2.4rem; font-weight: 700; letter-spacing: 0.08em; color: rgba(255, 255, 255, 0.05); white-space: nowrap; pointer-events: none; transition: transform 0.14s ease-out; }
.glow { position: absolute; left: 50%; bottom: 12%; width: 70%; height: 22%; transform: translateX(-50%); border-radius: 50%;
  background: radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0.16), transparent 70%); filter: blur(10px); opacity: 0; transition: opacity 0.4s; }
.card.on .glow { opacity: 1; }
.sheen { position: absolute; left: -60%; top: 0; width: 50%; height: 100%; pointer-events: none; opacity: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.10) 50%, transparent 60%); }
.card.on .sheen { animation: sheen 1.1s ease-out 0.2s 1 forwards; }
@keyframes sheen { 0% { left: -60%; opacity: 1; } 100% { left: 110%; opacity: 0; } }
/* 跟著滑鼠走的高光,像卡面有一層釉 */
.shine { position: absolute; inset: 0; opacity: 0; transition: opacity 0.3s; pointer-events: none;
  background: radial-gradient(60% 45% at var(--mx, 50%) var(--my, 50%), rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04) 40%, transparent 70%); }
.card.tilt .shine { opacity: 1; }
.capbg { position: absolute; left: 0; right: 0; bottom: 0; height: 120px; background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.88) 45%); }

/* 浮出卡面的層 */
.fig { position: absolute; left: 50%; bottom: 84px; height: 78%; width: auto; max-width: 92%; object-fit: contain;
  transform: translateX(calc(-50% + var(--px, 0) * 10px)) translateY(calc(var(--py, 0) * 6px)) translateZ(46px);
  filter: drop-shadow(0 22px 26px rgba(0, 0, 0, 0.75)); transition: transform 0.14s ease-out, filter 0.3s; }
.card.on .fig { transform: translateX(calc(-50% + var(--px, 0) * 10px)) translateY(calc(-4px + var(--py, 0) * 6px)) translateZ(56px); }
.cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 18px 16px; display: flex; flex-direction: column; gap: 3px; pointer-events: none;
  transform: translateX(calc(var(--px, 0) * 4px)) translateZ(40px); transition: transform 0.14s ease-out; }
.cap b { font-size: 18px; font-weight: 500; letter-spacing: 0.04em; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8); }
.cap i { font-style: normal; font-size: 11px; letter-spacing: 0.1em; color: var(--ag-ink-50); }

.dots { display: flex; justify-content: center; gap: 10px; margin-top: 8px; }
.dot { all: unset; cursor: pointer; width: 22px; height: 3px; background: var(--ag-line); transition: background 0.25s, width 0.25s; }
.dot.on { background: var(--ag-ember); width: 34px; }

.info { margin-top: 44px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; animation: ag-up 0.45s ease-out; }
.ihead .ag-h { margin: 10px 0 16px; }
.desc { max-width: 46ch; }
.stats { border-top: 1px solid var(--ag-line); }
.srow { display: grid; grid-template-columns: 110px 1fr 40px; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--ag-line-soft); }
.srow .bar { height: 1px; background: var(--ag-line-soft); position: relative; }
.srow .bar i { position: absolute; left: 0; top: -1px; height: 3px; background: var(--ag-ember); transition: width 0.5s ease; }
.srow .v { text-align: right; font-variant-numeric: tabular-nums; font-size: 14px; font-weight: 300; }
.srow .v.ember { color: var(--ag-ember); }

@media (max-width: 800px) {
  .ring { height: 450px; perspective: 900px; }
  .card { width: 230px; height: 380px; margin-left: -115px; }
  .fig { bottom: 74px; }
  .info { grid-template-columns: 1fr; gap: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .card, .info, .fig, .cap, .wm { transition: none; animation: none; }
}
</style>
