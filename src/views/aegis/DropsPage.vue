<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AgPage from './ui/AgPage.vue'
import raw from '@/data/aegis/drops.json'

// 打寶查詢:輸入道具 → 哪些怪會掉、在哪張地圖(不顯示隻數)。
// 資料由 L1Server/tools/export_aegis_drops.py 從遊戲 DB 匯出(只收有生成點的怪、金幣不收、同名地圖合併、一般怪排在首領前),
// 掉落機會分六級、不公開精確數字。改了掉落表或生成點要重跑匯出再部署。
type Loc = [number, number] // [地圖索引, 隻數](隻數只用來排序,頁面不顯示)
type Mob = [string, number, number, Loc[]] // [名稱, 等級(0 = 不顯示), 是否首領, 生成地點(多到少)]
type Src = [number, number] // [怪物或地圖索引, 機會等級]
type Item = [string, Src[], Src[]?] // [名稱, 怪物來源, 整張地圖任何怪都會掉]
interface DropData {
  v: string
  maps: string[]
  mobs: Mob[]
  items: Item[]
}
const data = raw as unknown as DropData

const TIERS = [
  { label: '必掉', bars: 5 },
  { label: '常見', bars: 4 },
  { label: '普通', bars: 3 },
  { label: '少見', bars: 2 },
  { label: '稀有', bars: 1 },
  { label: '極稀有', bars: 1 },
]
const NO_TIER = { label: '—', bars: 0 }
const tierOf = (t: number) => TIERS[t] ?? NO_TIER
const mapName = (m: number) => data.maps[m] ?? '未知地點'

const PICK_LIMIT = 40
const ROW_LIMIT = 30
const PLACE_LIMIT = 3
const DEFAULT = '對武器施法的卷軸'
const QUICK = ['對武器施法的卷軸', '對盔甲施法的卷軸', '受祝福對武器施法的卷軸', '魔法書', '精靈水晶', '黑暗精靈水晶', '技術書']

interface ItemView {
  idx: number
  name: string
  count: number
}
const itemViews: ItemView[] = data.items.map((it, idx) => ({ idx, name: it[0], count: it[1].length + (it[2]?.length ?? 0) }))
const quick = QUICK.filter((c) => itemViews.some((v) => v.name.includes(c)))

const q = ref(DEFAULT)
const picked = ref(itemViews.find((v) => v.name === DEFAULT)?.idx ?? -1)
const showAll = ref(false)

const matches = computed<ItemView[]>(() => {
  const k = q.value.trim()
  if (!k) return []
  // 名字完全相同的排最前,其餘短名字在前(通常是本體,長的是祝福/詛咒版)
  return itemViews
    .filter((v) => v.name.includes(k))
    .sort((a, b) => Number(b.name === k) - Number(a.name === k) || a.name.length - b.name.length)
})

watch(q, () => {
  showAll.value = false
  const k = q.value.trim()
  const m = matches.value
  const exact = m.find((v) => v.name === k)
  const only = m.length === 1 ? m[0] : undefined
  picked.value = exact?.idx ?? only?.idx ?? -1
})

function choose(v: ItemView) {
  picked.value = v.idx
  showAll.value = false
}

const item = computed(() => (picked.value >= 0 ? (data.items[picked.value] ?? null) : null))

const rows = computed(() => {
  if (!item.value) return []
  return item.value[1].flatMap(([mi, tier]) => {
    const mob = data.mobs[mi]
    if (!mob) return []
    const locs = mob[3]
    return [
      {
        name: mob[0],
        lvl: mob[1],
        boss: mob[2] === 1,
        tier,
        places: locs.slice(0, PLACE_LIMIT).map(([m]) => mapName(m)),
        placeCount: locs.length,
      },
    ]
  })
})
const shownRows = computed(() => (showAll.value ? rows.value : rows.value.slice(0, ROW_LIMIT)))
const mapRows = computed(() => (item.value?.[2] ?? []).map(([m, tier]) => ({ name: mapName(m), tier })))
const best = computed(() => {
  const ts = [...rows.value.map((r) => r.tier), ...mapRows.value.map((r) => r.tier)]
  return ts.length ? Math.min(...ts) : -1
})
const summary = computed(() => {
  const parts: string[] = []
  if (rows.value.length) parts.push(`${rows.value.length} 種怪會掉`)
  if (mapRows.value.length) parts.push(`${mapRows.value.length} 張地圖打任何怪都會掉`)
  return parts.join(',')
})
</script>

<template>
  <AgPage eyebrow="DROPS // 打寶查詢" title="想打什麼?" sub="搜道具,告訴你去哪打。" lead="輸入想要的道具,列出會掉它的怪和在哪張地圖打得到。資料直接從伺服器匯出。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="finder">
          <label class="ag-search big">
            <span class="ic">⌕</span>
            <input v-model="q" type="search" placeholder="輸入道具名稱,例如:魔法書" aria-label="搜尋道具名稱" />
          </label>
          <div class="quick">
            <span class="ql">常用</span>
            <button v-for="c in quick" :key="c" type="button" class="chip" :class="{ on: q.trim() === c }" @click="q = c">{{ c }}</button>
          </div>
        </div>

        <div v-if="matches.length > 1" class="picks">
          <div class="picks-cap">
            找到 {{ matches.length }} 種道具<template v-if="matches.length > PICK_LIMIT">,先列 {{ PICK_LIMIT }} 種,名字打完整一點會更準</template>;點一個看在哪裡打
          </div>
          <div class="pick-list">
            <button v-for="v in matches.slice(0, PICK_LIMIT)" :key="v.idx" type="button" class="pick" :class="{ on: picked === v.idx }" @click="choose(v)">
              {{ v.name }}<span class="n">{{ v.count }}</span>
            </button>
          </div>
        </div>

        <p v-if="q.trim() && !matches.length" class="empty-msg">
          找不到「{{ q.trim() }}」。換個短一點的關鍵字試試,例如「卷軸」「水晶」「魔杖」;商店買得到、打怪不會掉的東西這裡查不到。
        </p>

        <div v-if="item" class="result">
          <div class="res-head">
            <div class="ag-cap ember">掉落來源</div>
            <h2>{{ item[0] }}</h2>
            <p v-if="best >= 0">{{ summary }};最好打到的機會:<b>{{ tierOf(best).label }}</b></p>
          </div>

          <div v-if="mapRows.length" class="mapwide">
            <div class="mw-cap">在這些地圖打任何怪都有機會掉</div>
            <div class="mw-list">
              <span v-for="r in mapRows" :key="r.name" class="mw-item">
                {{ r.name }}
                <span class="meter" :aria-label="'掉落機會 ' + tierOf(r.tier).label">
                  <i v-for="k in 5" :key="k" :class="{ f: k <= tierOf(r.tier).bars }"></i>
                  <em>{{ tierOf(r.tier).label }}</em>
                </span>
              </span>
            </div>
          </div>

          <div v-if="rows.length" class="ag-table-wrap">
            <table class="ag-table drops-table">
              <thead>
                <tr><th>怪物</th><th>等級</th><th>在哪裡打</th><th>掉落機會</th></tr>
              </thead>
              <tbody>
                <tr v-for="(r, idx) in shownRows" :key="idx">
                  <td class="name">{{ r.name }}<span v-if="r.boss" class="tag ember boss">首領</span></td>
                  <td class="num">{{ r.lvl ? 'Lv ' + r.lvl : '—' }}</td>
                  <td class="where">
                    {{ r.places.join('、') }}<span v-if="r.placeCount > PLACE_LIMIT" class="more">,共 {{ r.placeCount }} 處</span>
                  </td>
                  <td class="chance">
                    <span class="meter" :aria-label="'掉落機會 ' + tierOf(r.tier).label">
                      <i v-for="k in 5" :key="k" :class="{ f: k <= tierOf(r.tier).bars }"></i>
                      <em>{{ tierOf(r.tier).label }}</em>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button v-if="rows.length > ROW_LIMIT && !showAll" type="button" class="show-all" @click="showAll = true">顯示全部 {{ rows.length }} 種怪</button>
        </div>

        <p class="note">
          掉落機會分六級:必掉、常見、普通、少見、稀有、極稀有,不公開精確數字。同一種怪在哪張地圖打,掉落機會都一樣,挑離你近的就好。一般怪排在前面,首領放在最後。資料更新:{{ data.v }}
        </p>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
button { background: none; border: 0; font-family: inherit; color: inherit; cursor: pointer; }
button:focus-visible { outline: 1px solid var(--ag-ember); outline-offset: 3px; }

.finder { display: grid; gap: 16px; }
.ag-search.big { max-width: 640px; height: 54px; padding: 0 18px; border-color: var(--ag-line); }
.ag-search.big:focus-within { border-color: var(--ag-ember); }
.ag-search.big input { font-size: 16px; background: none; border: 0; outline: none; }
.ag-search.big .ic { font-size: 15px; }

.quick { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.quick .ql { font-size: 12px; letter-spacing: 0.18em; color: var(--ag-ink-35); margin-right: 4px; }
.chip { font-size: 14px; padding: 6px 12px; border: 1px solid var(--ag-line-soft); color: var(--ag-ink-60); transition: color 0.2s, border-color 0.2s; }
.chip:hover { color: var(--ag-ink); border-color: var(--ag-line); }
.chip.on { color: var(--ag-ink); border-color: var(--ag-ember); }

.picks { margin-top: 34px; }
.picks-cap { font-size: 14px; color: var(--ag-ink-50); margin-bottom: 12px; line-height: 1.6; }
.pick-list { display: flex; flex-wrap: wrap; gap: 8px; }
.pick { display: inline-flex; align-items: center; gap: 8px; font-size: 14.5px; padding: 8px 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--ag-line-soft); color: var(--ag-ink-72); text-align: left; transition: color 0.2s, border-color 0.2s, background 0.2s; }
.pick:hover { color: var(--ag-ink); border-color: var(--ag-line); }
.pick.on { color: var(--ag-ink); border-color: var(--ag-ember); background: rgba(232, 132, 42, 0.08); }
.pick .n { font-size: 12px; color: var(--ag-ink-35); font-variant-numeric: tabular-nums; }
.pick.on .n { color: var(--ag-ember); }

.empty-msg { margin-top: 30px; font-size: 15px; line-height: 1.7; color: var(--ag-ink-60); max-width: 60ch; }

.result { margin-top: 44px; }
.res-head { margin-bottom: 20px; }
.res-head h2 { font-size: clamp(1.4rem, 2.6vw, 2rem); font-weight: 400; letter-spacing: 0.01em; margin: 8px 0 8px; text-wrap: balance; }
.res-head p { font-size: 15px; color: var(--ag-ink-60); line-height: 1.7; }
.res-head b { font-weight: 500; color: var(--ag-ember); }

.mapwide { margin-bottom: 24px; padding: 16px 18px; border-left: 2px solid var(--ag-ember); background: rgba(232, 132, 42, 0.06); }
.mw-cap { font-size: 14px; color: var(--ag-ink-72); margin-bottom: 10px; }
.mw-list { display: flex; flex-wrap: wrap; gap: 10px 28px; }
.mw-item { display: inline-flex; align-items: center; gap: 12px; font-size: 15px; color: var(--ag-ink); }

.drops-table td.where { line-height: 1.6; min-width: 240px; }
.drops-table .more { color: var(--ag-ink-35); }
.drops-table td.chance { white-space: nowrap; }
.drops-table .boss { margin-left: 8px; vertical-align: 1px; }

.meter { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.meter i { width: 10px; height: 6px; background: rgba(255, 255, 255, 0.12); }
.meter i.f { background: var(--ag-ember); }
.meter em { font-style: normal; margin-left: 8px; font-size: 14px; color: var(--ag-ink-72); }

.show-all { margin-top: 16px; font-size: 14px; letter-spacing: 0.06em; padding: 10px 16px; border: 1px solid var(--ag-line-soft); color: var(--ag-ink-72); }
.show-all:hover { color: var(--ag-ink); border-color: var(--ag-ember); }

.note { margin-top: 36px; font-size: 13.5px; line-height: 1.7; color: var(--ag-ink-35); max-width: 72ch; }

/* 手機:表格改成一隻怪一張小卡,不用左右滑(玩家多是 30~60 歲,橫向捲動容易漏看掉落機會) */
@media (max-width: 640px) {
  .ag-search.big { height: 50px; }
  .ag-table-wrap { overflow-x: visible; }
  .drops-table, .drops-table tbody { display: block; }
  .drops-table thead { display: none; }
  .drops-table tr { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; padding: 14px 2px; border-bottom: 1px solid var(--ag-line-soft); }
  .drops-table td { display: block; padding: 0; border: 0; background: none !important; }
  .drops-table td.name { grid-column: 1; grid-row: 1; white-space: normal; }
  .drops-table td.num { grid-column: 2; grid-row: 1; text-align: right; color: var(--ag-ink-50); }
  .drops-table td.where { grid-column: 1 / -1; min-width: 0; font-size: 14px; }
  .drops-table td.chance { grid-column: 1 / -1; }
}
</style>
