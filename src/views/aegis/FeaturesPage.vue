<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AgPage from './ui/AgPage.vue'
import { AG_FEATURES } from '@/data/aegis/features'

const route = useRoute()
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const artOf = (file: string) => `${base}/aegis/art/${file}`
onMounted(() => {
  const h = (route.hash || '').replace('#', '')
  if (h) requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }))
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
  </AgPage>
</template>

<style scoped>
.feat { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; padding: 40px 0; border-bottom: 1px solid var(--ag-line-soft); scroll-margin-top: 90px; }
.feat.flip .ag-shot, .feat.flip .art { order: 2; }
.art { position: relative; aspect-ratio: 16 / 9; border: 1px solid var(--ag-line-soft); overflow: hidden; background: #050810; box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.9); }
.art::after { content: ''; position: absolute; top: 0; left: 0; width: 22px; height: 22px; border-top: 2px solid var(--ag-ember); border-left: 2px solid var(--ag-ember); opacity: 0.9; }
.art img { display: block; width: 100%; height: 100%; object-fit: cover; }
@media (max-width: 800px) { .feat.flip .art { order: 0; } }
/* 多格插畫:橫跨兩欄,排成一排 */
.strip { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 8px; }
.strip figure { margin: 0; border: 1px solid var(--ag-line-soft); background: #050810; overflow: hidden; transition: border-color 0.25s, transform 0.25s; }
.strip figure:hover { border-color: var(--ag-ember); transform: translateY(-3px); }
.strip img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.strip figcaption { padding: 10px 12px; color: var(--ag-ink-72); text-transform: none; letter-spacing: 0.06em; }
@media (max-width: 800px) { .strip { grid-template-columns: 1fr; } }
.txt .ag-h { margin: 10px 0 18px; }
ul { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--ag-line); }
li { padding: 10px 0 10px 18px; border-bottom: 1px solid var(--ag-line-soft); position: relative; }
li::before { content: ''; position: absolute; left: 0; top: 18px; width: 6px; height: 1px; background: var(--ag-ember); }
@media (max-width: 800px) {
  .feat { grid-template-columns: 1fr; gap: 22px; }
  .feat.flip .ag-shot { order: 0; }
}
</style>
