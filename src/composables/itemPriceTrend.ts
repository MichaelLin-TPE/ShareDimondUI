import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

/**
 * 道具價格走勢 — 競爭力功能,給會長/成員看歷史成交趨勢決定該不該買 / 該標多少。
 *
 * === 後端 endpoint 規格 ===
 * GET https://api.gameshare-system.com/item-price-trend?itemName={name}&days={n}
 * Headers: Authorization, Sign, TimeStamp
 *
 * Response:
 * {
 *   itemName: string,
 *   days: number,
 *   series: [
 *     {
 *       currency: string,
 *       points: [
 *         { date: 'YYYY-MM-DD', avgPrice: number, count: number, minPrice: number, maxPrice: number }
 *       ]
 *     },
 *     ...
 *   ]
 * }
 *
 * 後端 SQL 參考:
 *   SELECT TO_CHAR(complete_time, 'YYYY-MM-DD') AS d, currency,
 *          AVG(final_price), MIN(final_price), MAX(final_price), COUNT(*)
 *   FROM treasure
 *   WHERE clan_id = ? AND status = 'COMPLETE_SHARE'
 *     AND item_name = ? AND complete_time >= SYSDATE - ?
 *   GROUP BY TO_CHAR(complete_time, 'YYYY-MM-DD'), currency
 *   ORDER BY d ASC
 */

export interface PricePoint {
  date: string
  avgPrice: number
  count: number
  minPrice: number
  maxPrice: number
}
export interface PriceSeries {
  currency: string
  points: PricePoint[]
}
export interface PriceTrendResponse {
  itemName: string
  days: number
  series: PriceSeries[]
}

const API = 'https://api.gameshare-system.com'

export type DaysRange = 7 | 30 | 90 | 365

// === Mock data 用 (後端端點上線後可拿掉) ===
// 用 itemName 當 seed,同道具每次重整看到一樣的趨勢
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619
  return Math.abs(h)
}
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}
function generateMockData(itemName: string, days: number): PriceTrendResponse {
  const rand = seededRandom(hashStr(itemName))
  const currencies = ['鑽石', '金幣']
  // 隨機決定第二個幣別有沒有資料 (有的道具只在某幣別交易)
  const activeCurrencies = rand() > 0.4 ? currencies : [currencies[0]!]
  const series: PriceSeries[] = activeCurrencies.map((currency, ci) => {
    const basePrice = (currency === '鑽石' ? 50000 : 1200000) * (0.5 + rand() * 1.5)
    const trend = (rand() - 0.5) * 0.8 // -0.4 ~ +0.4 整體趨勢
    const points: PricePoint[] = []
    const today = new Date()
    // 不是每天都有交易,大概 60% 的天數有點
    for (let i = days - 1; i >= 0; i--) {
      const r = seededRandom(hashStr(itemName) + i * 13 + ci * 1000)
      if (r() > 0.6) continue // 沒有交易的日子跳過
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const date = d.toISOString().slice(0, 10)
      const noise = (r() - 0.5) * 0.3
      const trendComponent = (trend * (days - i)) / days
      const avgPrice = Math.round(basePrice * (1 + trendComponent + noise))
      const count = 1 + Math.floor(r() * 4) // 1-4 筆
      const spread = avgPrice * (0.05 + r() * 0.1) // 5-15% 價差
      points.push({
        date,
        avgPrice,
        count,
        minPrice: Math.round(avgPrice - spread),
        maxPrice: Math.round(avgPrice + spread),
      })
    }
    return { currency, points }
  })
  return { itemName, days, series }
}

export function useItemPriceTrend() {
  const authStore = useAuthStore()
  const sharedLists = useSharedListsStore()

  const selectedItemName = ref('')
  const selectedDays = ref<DaysRange>(30)
  const data = ref<PriceTrendResponse | null>(null)
  const loading = ref(false)

  // 道具下拉選項 — 從共享 store 拿,中文排序
  const itemOptions = computed(() =>
    sharedLists.treasureList
      .map((t) => ({ value: t.itemName, label: t.itemName }))
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant')),
  )

  const daysOptions: { value: DaysRange; label: string }[] = [
    { value: 7, label: '7 天' },
    { value: 30, label: '30 天' },
    { value: 90, label: '90 天' },
    { value: 365, label: '一年' },
  ]

  const loadTrend = async () => {
    if (!selectedItemName.value) {
      data.value = null
      return
    }
    loading.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const url = `${API}/item-price-trend?itemName=${encodeURIComponent(selectedItemName.value)}&days=${selectedDays.value}`
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
      })
      if (!res.ok) {
        // 端點還沒上線 → 暫時用 mock 給看 chart 樣子 (TODO: 後端上線後拿掉這段)
        if (res.status === 404) {
          data.value = generateMockData(selectedItemName.value, selectedDays.value)
          return
        }
        useAlert.error('載入價格走勢失敗')
        return
      }
      const json = (await res.json()) as PriceTrendResponse
      // 防呆:後端可能回 null series
      if (!json.series) json.series = []
      data.value = json
    } catch (e) {
      console.error(e)
      useAlert.error('載入價格走勢失敗,請稍後再試')
    } finally {
      loading.value = false
    }
  }

  // === 統計指標(從 data 算出) ===
  const allPoints = computed<PricePoint[]>(() => data.value?.series.flatMap((s) => s.points) ?? [])

  const stats = computed(() => {
    const pts = allPoints.value
    if (pts.length === 0) {
      return { avg: 0, min: 0, max: 0, totalCount: 0, trendPct: null as number | null }
    }
    let sumPrice = 0
    let sumCount = 0
    let minP = Infinity
    let maxP = -Infinity
    for (const p of pts) {
      sumPrice += p.avgPrice * p.count
      sumCount += p.count
      if (p.minPrice < minP) minP = p.minPrice
      if (p.maxPrice > maxP) maxP = p.maxPrice
    }
    const avg = sumCount > 0 ? sumPrice / sumCount : 0
    // 趨勢 % = 後 1/3 平均 vs 前 1/3 平均
    const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date))
    const third = Math.max(1, Math.floor(sorted.length / 3))
    const head = sorted.slice(0, third)
    const tail = sorted.slice(-third)
    const headAvg = head.reduce((s, p) => s + p.avgPrice, 0) / head.length
    const tailAvg = tail.reduce((s, p) => s + p.avgPrice, 0) / tail.length
    const trendPct = headAvg > 0 ? ((tailAvg - headAvg) / headAvg) * 100 : null
    return { avg, min: minP, max: maxP, totalCount: sumCount, trendPct }
  })

  // 預設選第一個道具
  onMounted(async () => {
    await sharedLists.loadTreasureList()
    const first = itemOptions.value[0]
    if (!selectedItemName.value && first) {
      selectedItemName.value = first.value
    }
  })

  // 任一篩選變動 → 重新拉
  watch([selectedItemName, selectedDays], () => {
    loadTrend()
  })

  return {
    selectedItemName,
    selectedDays,
    data,
    loading,
    itemOptions,
    daysOptions,
    stats,
    loadTrend,
  }
}
