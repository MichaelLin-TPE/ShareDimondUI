// 職業介紹頁下半部「這個職業有什麼」:直接從遊戲特色 / 技能介紹的資料抓出跟這個職業有關的那幾列,
// 特色頁改數字這裡就跟著變,不用兩邊維護(2026-11-07 使用者:「有職業相關的東西都寫在職業介紹裡,不用再去遊戲特色找」)。
// 只抓「給誰」欄寫了特定職業的列;全職業共用的不放(那些在遊戲特色看)。
import { AG_FEATURES } from './features'
import { AG_SKILLS, type AgClassKey } from './skills'

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

  const gear: [string, string][] = []
  for (const r of rowsOf('bossgear', '套裝').rows) if (isMine(r[1], c)) gear.push([`${r[0]}套裝(四件)`, [r[2], dash(r[3])].filter(Boolean).join(';')])
  for (const r of rowsOf('bossgear', '傲慢之塔').rows) if (isMine(r[3], c)) gear.push([`${r[2]}(塔 ${r[0]} 樓 ${r[1]})`, r[4]!])
  for (const r of rowsOf('bossgear', '單件').rows) if (isMine(r[1], c)) gear.push([r[0]!, r[2]!])
  if (gear.length) out.push({ title: '職業專屬王裝', to: F('bossgear'), rows: gear, note: '只有王會掉,一律 1%。全職業都能穿的王裝在遊戲特色看。' })

  const base = rowsOf('dragonarmor', '部位基礎').rows.find((r) => isMine(r[1], c))
  if (base) {
    const dt = rowsOf('dragonarmor', '16 件')
    const col = dt.head.findIndex((h) => isMine(/\(([^)]+)\)/.exec(h)?.[1], c))
    const part = base[0]!
    out.push({
      title: `龍之鎧甲 · ${part}`, to: F('dragonarmor'),
      rows: [
        ['基礎', [`AC ${base[2]}`, base[3], `抗魔 ${base[4]}`, base[5]].filter(Boolean).join('、')],
        ...(col > 0 ? dt.rows.map((r) => [`${r[0]}的${part}`, r[col]!] as [string, string]) : []),
      ],
      note: '四條龍各一件,另加該龍的共同能力。',
    })
  }

  const books = rowsOf('siege', '盟主換技能書').rows.filter((r) => isMine(/\(([^)]+)\)/.exec(r[0]!)?.[1], c))
  if (books.length) out.push({ title: '攻城技能書', to: F('siege'), rows: books.map((r) => [r[0]!.replace(/\(.*\)/, ''), `血盟積分 ${r[1]}`]), note: '肯特攻城累積的血盟積分,盟主在攻城官換。' })

  const sk = AG_SKILLS.filter((s) => s.cls === c && s.custom)
  if (sk.length) out.push({ title: '首創技能', to: `/aegis/skills?c=${c}`, rows: sk.map((s) => [`${s.name}(${s.level} 級)`, s.effect]) })

  out.push({ title: '基本數值', to: '/aegis/server', rows: BASE[c] })
  return out
}
