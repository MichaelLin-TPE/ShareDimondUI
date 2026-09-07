<script setup lang="ts">
import { ref } from 'vue'
import AgPage from './ui/AgPage.vue'
import { AG_CLASSES } from '@/data/aegis/classes'

const cur = ref(AG_CLASSES[0]!)
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
          <div class="art ag-shot"><span class="ag-cap">{{ cur.name }} 立繪待補</span></div>
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
.art { aspect-ratio: 4 / 5; }
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
