// 職業介紹頁下半部「這個職業有什麼」:直接從遊戲特色 / 技能介紹的資料抓出跟這個職業有關的那幾列,
// 特色頁改數字這裡就跟著變,不用兩邊維護(2026-11-07 使用者:「有職業相關的東西都寫在職業介紹裡,不用再去遊戲特色找」)。
// 只放 職業本能 / 職業試煉獎勵 / 基本數值 三塊(2026-11-07 使用者;王裝、龍之鎧甲、攻城技能書、首創技能拿掉,那些在遊戲特色 / 技能介紹看)。
import { AG_FEATURES } from './features'
import type { AgClassKey } from './skills'

export interface AgClassBlock {
  title: string
  /** 站內連結:完整規則 */
  to: string
  rows: [string, string][]
  note?: string
}

// 特色資料裡同一個職業的寫法不一(王族 / 君主、黑妖 / 黑暗妖精)
const ALIAS: Record<AgClassKey, string[]> = {
  royal: ['王族', '君主'],
  knight: ['騎士'],
  elf: ['妖精'],
  wizard: ['法師'],
  darkelf: ['黑妖', '黑暗妖精'],
}
// 職業試煉 50 級試煉地點(features trial「規則」第一句)
const TRIAL_PLACE: Record<AgClassKey, string> = {
  royal: '遺忘之島', knight: '大陸', elf: '水晶洞穴', wizard: '遺忘之島', darkelf: '底比斯沙漠',
}
// 伺服器設置頁「每級職業底血」與寵物頁「魅力職業加值」
const BASE: Record<AgClassKey, [string, string][]> = {
  royal: [['每級底血', '9'], ['帶寵物魅力加值', '+6'], ['當隊長', '一起打同一隻怪的組隊經驗再 +5.9%']],
  knight: [['每級底血', '13(五職最高)'], ['帶寵物魅力加值', '+0']],
  elf: [['每級底血', '8'], ['帶寵物魅力加值', '+12(五職最高)']],
  wizard: [['每級底血', '6'], ['帶寵物魅力加值', '+6']],
  darkelf: [['每級底血', '8'], ['帶寵物魅力加值', '+6']],
}

const F = (id: string) => `/aegis/features#${id}`
const isMine = (cell: string | undefined, c: AgClassKey) => !!cell && cell.split('、').some((x) => ALIAS[c].includes(x.trim()))
const rowsOf = (fid: string, hPrefix: string) =>
  AG_FEATURES.find((f) => f.id === fid)?.details?.find((d) => d.h.startsWith(hPrefix))?.table ?? { head: [], rows: [] }
const dash = (v: string | undefined) => (v && v !== '—' ? v : '')

export function classBlocks(c: AgClassKey): AgClassBlock[] {
  const out: AgClassBlock[] = []

  const ins = rowsOf('classgrowth', '五條本能').rows.find((r) => isMine(r[0], c))
  if (ins) out.push({ title: `職業本能 · ${ins[1]}`, to: F('classgrowth'), rows: [['70 級滿', ins[2]!]], note: [dash(ins[3]), '50 級開始每升一級長一點,不靠道具。'].filter(Boolean).join(';') })

  const tr = rowsOf('trial', '四階段獎勵')
  const trow = tr.rows.find((r) => isMine(r[0], c))
  if (trow) out.push({
    title: '職業試煉獎勵', to: F('trial'),
    rows: tr.head.slice(1).map((h, i) => [h, trow[i + 1]!] as [string, string]),
    note: `奇岩「職業試煉教官」接;50 級試煉在${TRIAL_PLACE[c]},獎勵怪不掉、商店不賣。`,
  })

  out.push({ title: '基本數值', to: '/aegis/server', rows: BASE[c] })
  return out
}
