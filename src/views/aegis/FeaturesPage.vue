<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AgPage from './ui/AgPage.vue'
import { AG_FEATURES } from '@/data/aegis/features'

const route = useRoute()
onMounted(() => {
  const h = (route.hash || '').replace('#', '')
  if (h) requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }))
})
</script>

<template>
  <AgPage eyebrow="FEATURES // 遊戲特色" title="在原始碼上加的。" sub="每一項都查得到、改得動。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div v-for="(f, i) in AG_FEATURES" :key="f.id" :id="f.id" class="feat" :class="{ flip: i % 2 === 1 }">
          <div class="ag-shot"><span class="ag-cap">{{ f.shot }} · 截圖待補</span></div>
          <div class="txt">
            <div class="ag-cap ember">// {{ f.idx }}</div>
            <h2 class="ag-h">{{ f.title }}<span class="thin">{{ f.short }}</span></h2>
            <ul>
              <li v-for="p in f.points" :key="p" class="ag-body">{{ p }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.feat { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; padding: 40px 0; border-bottom: 1px solid var(--ag-line-soft); scroll-margin-top: 90px; }
.feat.flip .ag-shot { order: 2; }
.txt .ag-h { margin: 10px 0 18px; }
ul { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--ag-line); }
li { padding: 10px 0 10px 18px; border-bottom: 1px solid var(--ag-line-soft); position: relative; }
li::before { content: ''; position: absolute; left: 0; top: 18px; width: 6px; height: 1px; background: var(--ag-ember); }
@media (max-width: 800px) {
  .feat { grid-template-columns: 1fr; gap: 22px; }
  .feat.flip .ag-shot { order: 0; }
}
</style>
