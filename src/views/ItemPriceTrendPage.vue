<script setup lang="ts">
import { computed, ref } from 'vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useItemPriceTrend, type PriceSeries, type PricePoint } from '@/composables/itemPriceTrend'

const {
  selectedItemName,
  selectedDays,
  data,
  loading,
  itemOptions,
  daysOptions,
  stats,
  loadTrend,
} = useItemPriceTrend()

// === 不同幣別配色 (主題色 + fallback rotation) ===
const PALETTE = [
  'var(--c-light)',
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
]
const colorOf = (idx: number): string => PALETTE[idx % PALETTE.length] ?? PALETTE[0]!

// === Legend toggle: 哪些 currency 被隱藏 ===
const hiddenCurrencies = ref<Set<string>>(new Set())
const toggleCurrency = (currency: string) => {
  const next = new Set(hiddenCurrencies.value)
  if (next.has(currency)) next.delete(currency)
  else next.add(currency)
  hiddenCurrencies.value = next
}
const visibleSeries = computed<PriceSeries[]>(
  () => data.value?.series.filter((s) => !hiddenCurrencies.value.has(s.currency)) ?? [],
)

// === Chart 幾何 ===
const CHART_W = 1000
const CHART_H = 380
const PAD_LEFT = 70
const PAD_RIGHT = 24
const PAD_TOP = 16
const PAD_BOTTOM = 44
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM

// === 軸範圍 ===
const allVisiblePoints = computed<PricePoint[]>(() =>
  visibleSeries.value.flatMap((s) => s.points),
)

const allDates = computed<string[]>(() => {
  const set = new Set<string>()
  for (const p of allVisiblePoints.value) set.add(p.date)
  return Array.from(set).sort()
})

const yMinMax = computed(() => {
  const pts = allVisiblePoints.value
  if (pts.length === 0) return { min: 0, max: 100 }
  let min = Infinity
  let max = -Infinity
  for (const p of pts) {
    if (p.minPrice < min) min = p.minPrice
    if (p.maxPrice > max) max = p.maxPrice
  }
  // 上下 padding 5%
  const range = max - min || max * 0.1 || 100
  return {
    min: Math.max(0, min - range * 0.05),
    max: max + range * 0.05,
  }
})

// === 座標轉換 ===
const xOf = (date: string): number => {
  const dates = allDates.value
  if (dates.length === 0) return PAD_LEFT
  if (dates.length === 1) return PAD_LEFT + PLOT_W / 2
  const idx = dates.indexOf(date)
  return PAD_LEFT + (idx / (dates.length - 1)) * PLOT_W
}
const yOf = (price: number): number => {
  const { min, max } = yMinMax.value
  if (max === min) return PAD_TOP + PLOT_H / 2
  return PAD_TOP + (1 - (price - min) / (max - min)) * PLOT_H
}

// 每條 series 轉成 SVG path
const pathOf = (series: PriceSeries): string => {
  const sorted = [...series.points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.date).toFixed(1)} ${yOf(p.avgPrice).toFixed(1)}`)
    .join(' ')
}

// === Y 軸 ticks (5 條) ===
const yTicks = computed(() => {
  const { min, max } = yMinMax.value
  const ticks: { y: number; label: string }[] = []
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4
    ticks.push({ y: yOf(v), label: formatPrice(v) })
  }
  return ticks
})

// === X 軸 labels (~6-8 個,間隔抽樣) ===
const xLabels = computed(() => {
  const dates = allDates.value
  if (dates.length === 0) return []
  const step = Math.max(1, Math.ceil(dates.length / 7))
  const labels: { x: number; label: string }[] = []
  for (let i = 0; i < dates.length; i += step) {
    const d = dates[i]
    if (d) labels.push({ x: xOf(d), label: d.slice(5) }) // MM-DD
  }
  // 強制把最後一筆加進去
  const last = dates[dates.length - 1]
  const lastLabel = labels[labels.length - 1]
  if (last && (!lastLabel || lastLabel.label !== last.slice(5))) {
    labels.push({ x: xOf(last), label: last.slice(5) })
  }
  return labels
})

// === Hover tooltip ===
interface HoverPoint {
  series: PriceSeries
  point: PricePoint
  cx: number
  cy: number
  color: string
}
const hover = ref<HoverPoint | null>(null)
const onPointEnter = (
  series: PriceSeries,
  point: PricePoint,
  color: string,
) => {
  hover.value = { series, point, cx: xOf(point.date), cy: yOf(point.avgPrice), color }
}
const onPointLeave = () => {
  hover.value = null
}

// === Format helpers ===
function formatPrice(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k'
  return Math.round(n).toString()
}
function formatFull(n: number): string {
  return Math.round(n).toLocaleString('zh-TW')
}
function formatTrend(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}
const trendClass = computed(() => {
  const t = stats.value.trendPct
  if (t === null) return 'neutral'
  if (t > 5) return 'up'
  if (t < -5) return 'down'
  return 'neutral'
})

const hasData = computed(() => (data.value?.series.length ?? 0) > 0)
</script>

<template>
  <div class="ipt-page">
    <div class="ipt-head">
      <h2 class="ipt-title">📈 道具價格走勢</h2>
      <p class="ipt-sub">追蹤血盟內歷史成交價,決定該不該買 / 該標多少</p>
    </div>

    <!-- 道具選擇 (獨立一行) -->
    <div class="ipt-item-row">
      <SearchableSelect
        class="ipt-select"
        v-model="selectedItemName"
        :options="itemOptions"
        placeholder="選擇道具"
      />
    </div>

    <!-- 區間切換 (抄 AttendancePage .range-tabs 格式) -->
    <div class="range-tabs">
      <div class="range-group">
        <button
          v-for="opt in daysOptions"
          :key="opt.value"
          class="range-btn"
          :class="{ active: selectedDays === opt.value }"
          :disabled="loading"
          @click="selectedDays = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
      <div class="range-group refresh-wrap">
        <button
          class="range-btn refresh-btn"
          @click="loadTrend"
          :disabled="loading"
          title="重新整理"
        >
          🔄
        </button>
      </div>
    </div>

    <!-- 統計卡 -->
    <div class="ipt-stats">
      <div class="stat">
        <div class="stat-label">平均成交價</div>
        <div class="stat-value gold">{{ formatFull(stats.avg) }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">最高 / 最低</div>
        <div class="stat-value">
          <span class="hi">{{ formatFull(stats.max) }}</span>
          <span class="sep">/</span>
          <span class="lo">{{ formatFull(stats.min) }}</span>
        </div>
      </div>
      <div class="stat">
        <div class="stat-label">成交筆數</div>
        <div class="stat-value">{{ stats.totalCount }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">區間趨勢</div>
        <div class="stat-value trend" :class="trendClass">
          <span v-if="trendClass === 'up'">↗</span>
          <span v-else-if="trendClass === 'down'">↘</span>
          <span v-else>→</span>
          {{ formatTrend(stats.trendPct) }}
        </div>
      </div>
    </div>

    <!-- 主圖 -->
    <div class="ipt-chart-card">
      <div v-if="loading" class="loading-state">
        <div class="spinner" aria-hidden="true"></div>
        <span>載入中...</span>
      </div>

      <div v-else-if="!hasData" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">沒有成交紀錄</div>
        <div class="empty-msg">
          這段時間內沒有此道具的成交資料,試試換個區間或道具
        </div>
      </div>

      <template v-else>
        <!-- Legend -->
        <div class="ipt-legend">
          <button
            v-for="(s, i) in data?.series"
            :key="s.currency"
            type="button"
            class="legend-item"
            :class="{ off: hiddenCurrencies.has(s.currency) }"
            :style="{ '--dot-color': colorOf(i) }"
            @click="toggleCurrency(s.currency)"
          >
            <span class="legend-dot"></span>
            {{ s.currency }}
          </button>
        </div>

        <!-- Chart -->
        <div class="ipt-svg-wrap">
          <svg
            class="ipt-svg"
            :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
            preserveAspectRatio="none"
          >
            <!-- Y grid lines + labels -->
            <g class="grid">
              <line
                v-for="(t, i) in yTicks"
                :key="`grid-${i}`"
                :x1="PAD_LEFT"
                :x2="CHART_W - PAD_RIGHT"
                :y1="t.y"
                :y2="t.y"
              />
            </g>
            <g class="y-labels">
              <text
                v-for="(t, i) in yTicks"
                :key="`y-${i}`"
                :x="PAD_LEFT - 10"
                :y="t.y + 4"
                text-anchor="end"
              >
                {{ t.label }}
              </text>
            </g>

            <!-- X labels -->
            <g class="x-labels">
              <text
                v-for="(l, i) in xLabels"
                :key="`x-${i}`"
                :x="l.x"
                :y="CHART_H - PAD_BOTTOM + 22"
                text-anchor="middle"
              >
                {{ l.label }}
              </text>
            </g>

            <!-- Series lines + 點 -->
            <g
              v-for="(s, i) in visibleSeries"
              :key="`s-${s.currency}`"
              class="series"
              :style="{ '--c': colorOf(data!.series.findIndex((x) => x.currency === s.currency)) }"
            >
              <path :d="pathOf(s)" class="line" />
              <circle
                v-for="p in s.points"
                :key="`${s.currency}-${p.date}`"
                :cx="xOf(p.date)"
                :cy="yOf(p.avgPrice)"
                r="4.5"
                class="dot"
                @mouseenter="onPointEnter(s, p, colorOf(i))"
                @mouseleave="onPointLeave"
              />
            </g>

            <!-- Hover crosshair -->
            <g v-if="hover" class="hover-mark">
              <line
                :x1="hover.cx"
                :x2="hover.cx"
                :y1="PAD_TOP"
                :y2="CHART_H - PAD_BOTTOM"
              />
              <circle :cx="hover.cx" :cy="hover.cy" r="7" :stroke="hover.color" />
            </g>
          </svg>

          <!-- Tooltip -->
          <div
            v-if="hover"
            class="ipt-tooltip"
            :style="{
              left: `${(hover.cx / CHART_W) * 100}%`,
              top: `${(hover.cy / CHART_H) * 100}%`,
            }"
          >
            <div class="tt-date">{{ hover.point.date }}</div>
            <div class="tt-row">
              <span class="tt-cur" :style="{ color: hover.color }">{{ hover.series.currency }}</span>
              <span class="tt-avg">{{ formatFull(hover.point.avgPrice) }}</span>
            </div>
            <div class="tt-meta">
              {{ hover.point.count }} 筆 · 範圍
              {{ formatFull(hover.point.minPrice) }} ~ {{ formatFull(hover.point.maxPrice) }}
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ipt-page {
  padding: 32px 16px 80px;
  max-width: 1100px;
  margin: 0 auto;
}

/* Head */
.ipt-head {
  text-align: center;
  margin-bottom: 22px;
}
.ipt-title {
  margin: 0 0 4px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.ipt-sub {
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

/* 道具選擇 row */
.ipt-item-row {
  margin-bottom: 12px;
}
.ipt-select {
  display: block;
  width: 100%;
  max-width: 360px;
  height: 38px;
}
.ipt-select :deep(.ss-trigger) {
  height: 38px !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}

/* === Range tabs — 抄 AttendancePage / PersonalMarket .seg-tabs 成功 pattern === */
.range-tabs {
  display: flex;
  align-items: stretch;
  gap: 10px;
  margin-bottom: 18px;
}
.range-group {
  flex: 1;
  display: flex;
  align-items: center;
  height: 48px;
  padding: 4px;
  background-color: #14161f;
  border: 1px solid #24263a;
  border-radius: 10px;
  gap: 4px;
  box-sizing: border-box;
  overflow: hidden;
}
.range-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 38px; /* 48 - 4*2 padding - 1*2 border = 38, 完全填滿 */
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: 7px;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s ease;
  white-space: nowrap;
  line-height: 1;
}
.range-btn:hover:not(:disabled):not(.active) {
  color: #fff;
}
.range-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
}
.range-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
/* refresh 包進跟 range-group 同樣的容器,跟左邊 4 顆完全等高同框 */
.refresh-wrap {
  flex: 0 0 auto;
  width: 56px;
}
.refresh-btn {
  font-size: 1rem;
}
.refresh-btn:hover:not(:disabled) {
  color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.1);
}

/* Stats */
.ipt-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.stat {
  background: #161822;
  border: 1px solid #2d3047;
  border-radius: 14px;
  padding: 14px 16px;
}
.stat-label {
  font-size: 0.78rem;
  color: #64748b;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}
.stat-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: #e2e8f0;
}
.stat-value.gold {
  color: var(--c-light);
}
.stat-value .hi {
  color: var(--c-light);
}
.stat-value .lo {
  color: #94a3b8;
  font-size: 0.95rem;
}
.stat-value .sep {
  color: #475569;
  margin: 0 6px;
  font-weight: 400;
}
.stat-value.trend.up {
  color: #22c55e;
}
.stat-value.trend.down {
  color: #ef4444;
}
.stat-value.trend.neutral {
  color: #94a3b8;
}

/* Chart Card */
.ipt-chart-card {
  background: #161822;
  border: 1px solid #2d3047;
  border-radius: 16px;
  padding: 18px;
  position: relative;
}

/* Legend */
.ipt-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(15, 17, 26, 0.7);
  border: 1px solid #2e3147;
  border-radius: 999px;
  color: #cbd5e1;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.legend-item:hover {
  border-color: #555a78;
}
.legend-item.off {
  opacity: 0.4;
  text-decoration: line-through;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--dot-color);
  box-shadow: 0 0 8px var(--dot-color);
}
.legend-item.off .legend-dot {
  box-shadow: none;
}

/* SVG */
.ipt-svg-wrap {
  position: relative;
  width: 100%;
}
.ipt-svg {
  width: 100%;
  height: auto;
  display: block;
  font-family: inherit;
}
.grid line {
  stroke: rgba(255, 255, 255, 0.06);
  stroke-width: 1;
}
.y-labels text,
.x-labels text {
  fill: #64748b;
  font-size: 12px;
}

.series .line {
  fill: none;
  stroke: var(--c);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 4px var(--c));
  transition: stroke-width 0.18s;
}
.series:hover .line {
  stroke-width: 3.2;
}
.series .dot {
  fill: var(--c);
  stroke: #161822;
  stroke-width: 2;
  cursor: pointer;
  transition: r 0.15s;
}
.series .dot:hover {
  r: 6.5;
}

.hover-mark line {
  stroke: rgba(255, 255, 255, 0.18);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
.hover-mark circle {
  fill: none;
  stroke-width: 2;
  filter: drop-shadow(0 0 8px currentColor);
}

/* Tooltip */
.ipt-tooltip {
  position: absolute;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 14px));
  background: rgba(15, 17, 26, 0.96);
  border: 1px solid #3a3f5c;
  border-radius: 10px;
  padding: 8px 12px;
  min-width: 140px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
  font-size: 0.82rem;
  z-index: 5;
}
.tt-date {
  color: #94a3b8;
  font-size: 0.78rem;
  margin-bottom: 4px;
}
.tt-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 2px;
}
.tt-cur {
  font-weight: 700;
}
.tt-avg {
  color: #fff;
  font-weight: 800;
}
.tt-meta {
  color: #64748b;
  font-size: 0.74rem;
  margin-top: 4px;
}

/* Loading / Empty */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  color: #94a3b8;
  font-size: 0.95rem;
}
.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(var(--c-light-rgb), 0.18);
  border-top-color: var(--c-light);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}
.empty-icon {
  font-size: 2.4rem;
  margin-bottom: 10px;
  opacity: 0.6;
}
.empty-title {
  color: #cbd5e1;
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 6px;
}
.empty-msg {
  color: #64748b;
  font-size: 0.85rem;
}

/* Mobile */
@media (max-width: 640px) {
  .ipt-page {
    padding: 20px 12px 60px;
  }
  .ipt-filter {
    flex-direction: column;
    align-items: stretch;
  }
  .ipt-select {
    max-width: none;
  }
  .ipt-days {
    width: 100%;
  }
  .stat-value {
    font-size: 1.05rem;
  }
}
</style>
