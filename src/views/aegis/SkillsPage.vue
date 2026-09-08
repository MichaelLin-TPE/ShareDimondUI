<script setup lang="ts">
import { computed, ref } from 'vue'
import AgPage from './ui/AgPage.vue'
import { AG_SKILLS, AG_SKILL_TABS, type AgClassKey } from '@/data/aegis/skills'

const tab = ref<AgClassKey>('all')
const q = ref('')
const rows = computed(() => {
  const k = q.value.trim()
  return AG_SKILLS.filter((s) => (k ? s.name.includes(k) || s.effect.includes(k) : s.cls === tab.value))
})
</script>

<template>
  <AgPage eyebrow="SKILLS // 技能介紹" title="技能表。" sub="等級、耗魔、冷卻、效果。" lead="技能資料陸續整理中,先放常用的。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="bar">
          <div class="ag-tabs">
            <button v-for="t in AG_SKILL_TABS" :key="t.key" type="button" class="ag-tab" :class="{ on: tab === t.key && !q }" @click="tab = t.key; q = ''">{{ t.label }}</button>
          </div>
          <label class="ag-search"><span class="ic">⌕</span><input v-model="q" placeholder="搜尋技能或效果" /></label>
        </div>
        <div class="ag-table-wrap">
          <table class="ag-table">
            <thead><tr><th>Lv</th><th>技能</th><th>類型</th><th>MP</th><th>冷卻</th><th>效果</th></tr></thead>
            <tbody>
              <tr v-for="s in rows" :key="s.cls + s.name">
                <td class="num">{{ s.level }}</td>
                <td class="name">{{ s.name }}</td>
                <td><span class="tag" :class="{ ember: s.type === '攻擊' }">{{ s.type }}</span></td>
                <td class="num">{{ s.mp }}</td>
                <td class="num">{{ s.cooldown }}</td>
                <td>{{ s.effect }}</td>
              </tr>
              <tr v-if="!rows.length"><td colspan="6" class="empty">沒有符合的技能</td></tr>
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
