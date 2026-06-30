// 十三支前端評估器:給理牌時即時顯示牌型 + 倒水警示用。
// 與後端 ThirteenEngine 同一套規則(後端為結算權威,這裡只負責即時提示)。

export const CAT_ZH = [
  '烏龍', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '鐵支', '同花順',
]

export interface Eval {
  cat: number // 0 高牌 … 8 同花順
  tb: number[] // tiebreak
  label: string
}

const RANK: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 11, Q: 12, K: 13, A: 14,
}

export function cardRank(code: string): number {
  return RANK[code.slice(0, -1)] ?? 0
}
export function cardSuit(code: string): string {
  return code.slice(-1)
}

function rankCount(cards: string[]): Record<number, number> {
  const c: Record<number, number> = {}
  for (const card of cards) {
    const r = cardRank(card)
    c[r] = (c[r] ?? 0) + 1
  }
  return c
}

// 不重複點數依(數量↓, 點數↓)排序 — 當鐵支/葫蘆/對子/高牌的 tiebreak
function rankGroups(cards: string[]): number[] {
  const c = rankCount(cards)
  return Object.keys(c)
    .map(Number)
    .sort((a, b) => ((c[b] ?? 0) - (c[a] ?? 0)) || (b - a))
}

function straightHigh(cards: string[]): number {
  const c = rankCount(cards)
  const has = (r: number) => (c[r] ?? 0) > 0
  for (let high = 14; high >= 6; high--) {
    let ok = true
    for (let r = high; r > high - 5; r--) if (!has(r)) { ok = false; break }
    if (ok) return high
  }
  if (has(14) && has(2) && has(3) && has(4) && has(5)) return 5 // 輪子
  return 0
}

export function evaluate(cards: string[]): Eval {
  if (cards.length === 3) return evaluate3(cards)
  return evaluate5(cards)
}

function evaluate5(cards: string[]): Eval {
  const groups = rankGroups(cards)
  const c = rankCount(cards)
  // 第5索引(X)= 黑桃,算同花時視為黑桃(♠)
  const flush = new Set(cards.map((c) => { const s = cardSuit(c); return s === 'X' ? 'S' : s })).size === 1
  const sh = straightHigh(cards)
  const straight = sh > 0
  let maxSame = 0, pairs = 0
  for (const r of Object.keys(c).map(Number)) {
    maxSame = Math.max(maxSame, c[r] ?? 0)
    if (c[r] === 2) pairs++
  }
  const ranksDesc = cards.map(cardRank).sort((a, b) => b - a)
  if (straight && flush) return mk(8, [sh])
  if (maxSame >= 4) return mk(7, groups) // 5色版:5張同點也算鐵支
  if (maxSame === 3 && pairs >= 1) return mk(6, groups)
  if (flush) return mk(5, ranksDesc)
  if (straight) return mk(4, [sh])
  if (maxSame === 3) return mk(3, groups)
  if (pairs === 2) return mk(2, groups)
  if (pairs === 1) return mk(1, groups)
  return mk(0, groups)
}

function evaluate3(cards: string[]): Eval {
  const groups = rankGroups(cards)
  const c = rankCount(cards)
  let maxSame = 0
  for (const r of Object.keys(c).map(Number)) maxSame = Math.max(maxSame, c[r] ?? 0)
  if (maxSame === 3) return mk(3, groups)
  if (maxSame === 2) return mk(1, groups)
  return mk(0, groups)
}

function mk(cat: number, tb: number[]): Eval {
  return { cat, tb, label: CAT_ZH[cat] ?? '' }
}

export function compareEval(a: Eval, b: Eval): number {
  if (a.cat !== b.cat) return a.cat - b.cat
  const n = Math.min(a.tb.length, b.tb.length)
  for (let i = 0; i < n; i++) {
    const x = a.tb[i] ?? 0, y = b.tb[i] ?? 0
    if (x !== y) return x - y
  }
  return 0
}

/** 倒水:後墩 ≥ 中墩 ≥ 前墩 才合法。回傳 true 代表倒水(犯規)。 */
export function isFoul(front: string[], middle: string[], back: string[]): boolean {
  if (front.length !== 3 || middle.length !== 5 || back.length !== 5) return false
  const f = evaluate(front), m = evaluate(middle), b = evaluate(back)
  return compareEval(b, m) < 0 || compareEval(m, f) < 0
}
