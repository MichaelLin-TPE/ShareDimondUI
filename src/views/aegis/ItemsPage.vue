<script setup lang="ts">
import { computed, ref } from 'vue'
import AgPage from './ui/AgPage.vue'
import { AG_ITEMS, AG_ITEM_TABS, type AgItemCat } from '@/data/aegis/items'

const tab = ref<AgItemCat>('weapon')
const q = ref('')
const rows = computed(() => {
  const k = q.value.trim()
  return AG_ITEMS.filter((s) => (k ? s.name.includes(k) || s.slot.includes(k) || s.cls.includes(k) : s.cat === tab.value))
})
</script>

<template>
  <AgPage eyebrow="ITEMS // 武器防具" title="裝備表。" sub="攻擊、防禦、安全值、職業限制。" lead="裝備資料陸續整理中,先放常見的。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="bar">
          <div class="ag-tabs">
            <button v-for="t in AG_ITEM_TABS" :key="t.key" type="button" class="ag-tab" :class="{ on: tab === t.key && !q }" @click="tab = t.key; q = ''">{{ t.label }}</button>
          </div>
          <label class="ag-search"><span class="ic">⌕</span><input v-model="q" placeholder="搜尋名稱、部位、職業" /></label>
        </div>
        <div class="ag-table-wrap">
          <table class="ag-table">
            <thead><tr><th>名稱</th><th>部位</th><th>{{ tab === 'weapon' && !q ? '攻擊 小 / 大' : '數值' }}</th><th>安全值</th><th>職業</th><th>取得</th></tr></thead>
            <tbody>
              <tr v-for="s in rows" :key="s.name">
                <td class="name">{{ s.name }}</td>
                <td>{{ s.slot }}</td>
                <td class="num">{{ s.stat }}</td>
                <td class="num">+{{ s.safe }}</td>
                <td>{{ s.cls }}</td>
                <td><span class="tag">{{ s.from }}</span></td>
              </tr>
              <tr v-if="!rows.length"><td colspan="6" class="empty">沒有符合的裝備</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.bar { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; }
.bar .ag-tabs { flex: 1; margin-bottom: 0; }
.bar .ag-search { margin-bottom: 8px; }
.ag-table-wrap { margin-top: 22px; }
.empty { color: var(--ag-ink-35); text-align: center; padding: 30px; }
</style>
