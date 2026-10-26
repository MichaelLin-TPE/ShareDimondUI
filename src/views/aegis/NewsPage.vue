<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AgPage from './ui/AgPage.vue'
import { AG_NEWS, type AgNewsKind } from '@/data/aegis/news'

const route = useRoute()
// 預設展開最新一則
const open = ref<string | null>(AG_NEWS[0]?.id ?? null)
function toggle(id: string) { open.value = open.value === id ? null : id }
onMounted(() => {
  const h = (route.hash || '').replace('#', '')
  if (h && AG_NEWS.some((n) => n.id === h)) {
    open.value = h
    requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }))
  }
})

const KIND_CLASS: Record<AgNewsKind, string> = { 新內容: 'k-new', 調整: 'k-adj', 修正: 'k-fix' }
</script>

<template>
  <AgPage eyebrow="NEWS // 最新消息" title="更新紀錄。" sub="點開看每一版有什麼新東西。">
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
              <div v-if="n.note || n.client" class="note">
                <span v-if="n.client" class="chip">客戶端要更新</span>
                <span v-if="n.note">{{ n.note }}</span>
              </div>
              <div v-for="g in n.groups" :key="g.kind" class="grp" :class="KIND_CLASS[g.kind]">
                <div class="kind"><i />{{ g.kind }}</div>
                <ul>
                  <li v-for="it in g.items" :key="it[0]">
                    <RouterLink v-if="it[2]" :to="it[2]" class="nm link">{{ it[0] }} →</RouterLink>
                    <span v-else class="nm">{{ it[0] }}</span>
                    <span class="ds">{{ it[1] }}</span>
                  </li>
                </ul>
              </div>
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
.head .ti { font-size: 16px; font-weight: 400; color: var(--ag-ink); }
.head .pm { color: var(--ag-ink-35); text-align: right; font-weight: 200; font-size: 18px; line-height: 1; }
.item.open .head .pm { color: var(--ag-ember); }

.body { padding: 0 0 28px 188px; display: flex; flex-direction: column; gap: 22px; max-width: 860px; }

.note { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 16px; border-left: 2px solid var(--ag-ember); background: rgba(255, 255, 255, 0.03); color: var(--ag-ink-72); font-size: 14px; }
.chip { font-size: 11px; letter-spacing: 0.08em; padding: 3px 8px; border: 1px solid var(--ag-ember); color: var(--ag-ember); white-space: nowrap; }

.kind { display: flex; align-items: center; gap: 8px; font-size: 12px; letter-spacing: 0.14em; color: var(--ag-ink-60); margin-bottom: 8px; }
.kind i { width: 8px; height: 8px; border-radius: 50%; background: var(--kc); }
.k-new { --kc: var(--ag-ember); }
.k-new .kind { color: var(--ag-ember); }
.k-adj { --kc: #6fa8dc; }
.k-fix { --kc: var(--ag-ink-35); }

ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--ag-line-soft); }
li { display: grid; grid-template-columns: 170px 1fr; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--ag-line-soft); align-items: baseline; }
.nm { font-size: 14px; font-weight: 500; color: var(--ag-ink); }
.nm.link { color: var(--ag-ember); text-decoration: none; }
.nm.link:hover { text-decoration: underline; }
.ds { font-size: 14px; color: var(--ag-ink-72); line-height: 1.6; }

@media (max-width: 960px) {
  .head { grid-template-columns: 96px 1fr 24px; }
  .head .t { display: none; }
  .body { padding-left: 0; }
  li { grid-template-columns: 1fr; gap: 2px; }
}
</style>
