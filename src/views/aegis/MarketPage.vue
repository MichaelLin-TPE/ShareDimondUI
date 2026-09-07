<script setup lang="ts">
import { computed, ref } from 'vue'
import AgPage from './ui/AgPage.vue'
import { AG_MARKET, AG_MARKET_CATS } from '@/data/aegis/market'

const cat = ref(AG_MARKET_CATS[0]!)
const rows = computed(() => AG_MARKET.filter((r) => r.cat === cat.value))
const fmt = (n: number) => n.toLocaleString('zh-TW')
const trendMark = { up: '▲', down: '▼', flat: '—' } as const
</script>

<template>
  <AgPage eyebrow="MARKET // 交易區" title="參考物價。" sub="玩家間成交的參考價,不是官方商店。" lead="目前為佔位資料。之後可擴充為玩家自行貼買賣單。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="ag-tabs">
          <button v-for="c in AG_MARKET_CATS" :key="c" type="button" class="ag-tab" :class="{ on: cat === c }" @click="cat = c">{{ c }}</button>
        </div>
        <div class="ag-table-wrap">
          <table class="ag-table">
            <thead><tr><th>品項</th><th>參考價(天幣)</th><th>趨勢</th><th>備註</th></tr></thead>
            <tbody>
              <tr v-for="r in rows" :key="r.name">
                <td class="name">{{ r.name }}</td>
                <td class="num">{{ fmt(r.price) }}</td>
                <td class="num trend" :class="r.trend">{{ trendMark[r.trend] }}</td>
                <td>{{ r.note || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.trend.up { color: var(--ag-ember); }
.trend.down { color: var(--ag-ink-50); }
.trend.flat { color: var(--ag-ink-35); }
</style>
