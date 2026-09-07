<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AgPage from './ui/AgPage.vue'
import { AG_NEWS } from '@/data/aegis/news'

const route = useRoute()
const open = ref<string | null>(null)
function toggle(id: string) { open.value = open.value === id ? null : id }
onMounted(() => {
  const h = (route.hash || '').replace('#', '')
  if (h && AG_NEWS.some((n) => n.id === h)) {
    open.value = h
    requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ block: 'center' }))
  }
})
</script>

<template>
  <AgPage eyebrow="NEWS // 最新消息" title="更新紀錄。" sub="每一版改了什麼,都寫在這裡。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="list">
          <article v-for="n in AG_NEWS" :key="n.id" :id="n.id" class="item" :class="{ open: open === n.id }">
            <button type="button" class="head" @click="toggle(n.id)">
              <span class="d">{{ n.date }}</span>
              <span class="t">{{ n.tag }}</span>
              <span class="ti">{{ n.title }}</span>
              <span class="pm">{{ open === n.id ? '−' : '+' }}</span>
            </button>
            <div v-if="open === n.id" class="body">
              <p v-for="(p, i) in n.body" :key="i" class="ag-body">{{ p }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.list { border-top: 1px solid var(--ag-line); }
.item { border-bottom: 1px solid var(--ag-line-soft); }
.head { display: grid; grid-template-columns: 110px 60px 1fr 24px; align-items: baseline; gap: 18px; width: 100%; padding: 20px 0; text-align: left; }
.head .d { font-size: 11px; letter-spacing: 0.1em; color: var(--ag-ink-50); font-variant-numeric: tabular-nums; }
.head .t { font-size: 10px; letter-spacing: 0.16em; color: var(--ag-ember); }
.head .ti { font-size: 15px; font-weight: 300; color: var(--ag-ink); }
.head .pm { color: var(--ag-ink-35); text-align: right; font-weight: 200; font-size: 18px; line-height: 1; }
.item.open .head .pm { color: var(--ag-ember); }
.body { padding: 0 0 24px 188px; display: flex; flex-direction: column; gap: 10px; max-width: 760px; }
@media (max-width: 960px) {
  .head { grid-template-columns: 96px 1fr 24px; }
  .head .t { display: none; }
  .body { padding-left: 0; }
}
</style>
