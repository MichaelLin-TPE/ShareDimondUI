<script setup lang="ts">
import { ref } from 'vue'
import AgPage from './ui/AgPage.vue'
import { AG_CLASSES } from '@/data/aegis/classes'

const cur = ref(AG_CLASSES[0]!)
// 立繪:public/aegis/classes/<id>.png(去背 PNG,高 1400)
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const artOf = (id: string) => `${base}/aegis/classes/${id}.png`
const statRows = [
  ['STR 力量', 'str'], ['DEX 敏捷', 'dex'], ['CON 體質', 'con'], ['WIS 精神', 'wis'], ['CHA 魅力', 'cha'], ['INT 智力', 'int'],
] as const
</script>

<template>
  <AgPage eyebrow="CLASSES // 職業介紹" title="七個職業。" sub="起始素質、可加點,全是伺服器真值。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="ag-tabs">
          <button v-for="c in AG_CLASSES" :key="c.id" type="button" class="ag-tab" :class="{ on: cur.id === c.id }" @click="cur = c">{{ c.name }}</button>
        </div>
        <div class="cls">
          <div class="art">
            <span class="wm">{{ cur.latin }}</span>
            <img :key="cur.id" :src="artOf(cur.id)" :alt="cur.name" class="fig" />
            <span class="floor"></span>
          </div>
          <div class="info">
            <div class="ag-cap ember">{{ cur.latin }}</div>
            <h2 class="ag-h">{{ cur.name }}<span class="thin">{{ cur.role }}</span></h2>
            <p class="ag-body desc">{{ cur.desc }}</p>
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
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.cls { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }
.art { position: relative; aspect-ratio: 4 / 5; overflow: hidden; border: 1px solid var(--ag-line-soft);
  background: radial-gradient(60% 50% at 50% 62%, rgba(232, 132, 42, 0.22), transparent 70%), rgba(3, 3, 3, 0.55); backdrop-filter: blur(6px); }
.art .wm { position: absolute; left: 50%; top: 8%; transform: translateX(-50%); font-size: clamp(2.6rem, 7vw, 5.5rem); font-weight: 700; letter-spacing: 0.08em; color: rgba(255, 255, 255, 0.045); white-space: nowrap; pointer-events: none; }
.art .fig { position: absolute; left: 50%; bottom: 6%; height: 88%; width: auto; max-width: 92%; object-fit: contain; transform: translateX(-50%);
  filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.7)); animation: ag-fig-in 0.55s ease-out; }
@keyframes ag-fig-in { from { opacity: 0; transform: translateX(-50%) translateY(14px); } to { opacity: 1; transform: translateX(-50%); } }
.art .floor { position: absolute; left: 50%; bottom: 5%; width: 62%; height: 14px; transform: translateX(-50%); border-radius: 50%;
  background: radial-gradient(50% 50% at 50% 50%, rgba(232, 132, 42, 0.35), transparent 70%); filter: blur(4px); }
.info .ag-h { margin: 10px 0 16px; }
.desc { max-width: 46ch; }
.stats { margin-top: 28px; border-top: 1px solid var(--ag-line); }
.srow { display: grid; grid-template-columns: 110px 1fr 40px; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--ag-line-soft); }
.srow .bar { height: 1px; background: var(--ag-line-soft); position: relative; }
.srow .bar i { position: absolute; left: 0; top: -1px; height: 3px; background: var(--ag-ember); transition: width 0.5s ease; }
.srow .v { text-align: right; font-variant-numeric: tabular-nums; font-size: 14px; font-weight: 300; }
.srow .v.ember { color: var(--ag-ember); }
@media (max-width: 800px) {
  .cls { grid-template-columns: 1fr; }
  .art { aspect-ratio: 16 / 10; }
}
</style>
