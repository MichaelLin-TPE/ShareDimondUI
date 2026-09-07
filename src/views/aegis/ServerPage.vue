<script setup lang="ts">
import AgPage from './ui/AgPage.vue'
import { AG_SERVER_BASIC, AG_SERVER_RATES, AG_ENCHANT } from '@/data/aegis/server'
</script>

<template>
  <AgPage eyebrow="SERVER // 伺服器設置" title="數值全部公開。" sub="不用問,自己看。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="cols">
          <div>
            <div class="ag-sec-head"><div><div class="idx">01 // BASIC</div><h2>基本設定</h2></div></div>
            <div class="kvs">
              <div v-for="r in AG_SERVER_BASIC" :key="r.k" class="kv">
                <span class="k ag-cap">{{ r.k }}</span>
                <span class="v">{{ r.v }}<small v-if="r.note">{{ r.note }}</small></span>
              </div>
            </div>
          </div>
          <div>
            <div class="ag-sec-head"><div><div class="idx">02 // RATES</div><h2>倍率</h2></div></div>
            <div class="kvs">
              <div v-for="r in AG_SERVER_RATES" :key="r.k" class="kv">
                <span class="k ag-cap">{{ r.k }}</span>
                <span class="v" :class="{ dim: r.v === '調整中' }">{{ r.v }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="ag-sec-head enc"><div><div class="idx">03 // ENCHANT</div><h2>衝裝機率表</h2></div><span class="ag-cap">資料校對中</span></div>
        <div class="ag-table-wrap">
          <table class="ag-table">
            <thead><tr><th>階段</th><th>成功率</th><th>失敗</th></tr></thead>
            <tbody>
              <tr v-for="r in AG_ENCHANT" :key="r.step">
                <td class="name">{{ r.step }}</td>
                <td class="num">{{ r.rate }}</td>
                <td>{{ r.fail }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-bottom: 56px; }
.kvs { border-top: 1px solid var(--ag-line); }
.kv { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; padding: 13px 0; border-bottom: 1px solid var(--ag-line-soft); }
.kv .v { font-size: 14px; font-weight: 300; text-align: right; }
.kv .v small { display: block; font-size: 11px; color: var(--ag-ink-50); margin-top: 2px; }
.kv .v.dim { color: var(--ag-ink-35); }
.enc { margin-top: 8px; }
@media (max-width: 800px) { .cols { grid-template-columns: 1fr; gap: 36px; } }
</style>
