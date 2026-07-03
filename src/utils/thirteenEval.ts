// 十三支前端評估器:給理牌時即時顯示牌型 + 倒水警示用。
// 與後端 ThirteenEngine 同一套「彩金牌版」規則(後端為結算權威,這裡只負責即時提示)。
// 牌型大小(弱→強,ordinal):
// 0 烏龍 1 一對 2 兩對 3 三條 4 彩金三條 5 順子 6 同花 7 對子同花 8 葫蘆 9 彩金葫蘆 10 鐵支 11 彩金五虎將 12 同花順 13 五枚

export const CAT_ZH = [
  '烏龍', '一對', '兩對', '三條', '彩金三條', '順子', '同花', '對子同花',
  '葫蘆', '彩金葫蘆', '鐵支', '彩金五虎將', '同花順', '五枚',
]

export interface Eval {
  cat: number
  tb: number[]
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
/** 是否本局彩金牌(被切點數的牌)。 */
export function isGolden(code: string, goldenRank?: number | null): boolean {
  return goldenRank != null && goldenRank >= 2 && cardRank(code) === goldenRank
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

export function evaluate(cards: string[], goldenRank?: number | null): Eval {
  const gold = goldenRank != null && goldenRank >= 2 ? goldenRank : -1
  if (cards.length === 3) return evaluate3(cards, gold)
  return evaluate5(cards, gold)
}

function evaluate5(cards: string[], gold: number): Eval {
  const groups = rankGroups(cards)
  const c = rankCount(cards)
  // 第5索引(X)= 黑桃,算同花時視為黑桃(♠)
  const flush = new Set(cards.map((x) => { const s = cardSuit(x); return s === 'X' ? 'S' : s })).size === 1
  const sh = straightHigh(cards)
  const straight = sh > 0
  let maxSame = 0, pairs = 0, tripRank = 0, quadRank = 0, fiveRank = 0
  for (const rs of Object.keys(c)) {
    const r = Number(rs), n = c[r] ?? 0
    maxSame = Math.max(maxSame, n)
    if (n === 2) pairs++
    if (n === 3) tripRank = r
    if (n === 4) quadRank = r
    if (n >= 5) fiveRank = r
  }
  const ranksDesc = cards.map(cardRank).sort((a, b) => b - a)
  const g = gold >= 2

  if (fiveRank > 0) return mk(13, groups)                              // 五枚
  if (straight && flush) return mk(12, [sh])                           // 同花順
  if (quadRank > 0) return mk(g && quadRank === gold ? 11 : 10, groups) // 彩金五虎將 / 鐵支
  if (maxSame === 3 && pairs >= 1) return mk(g && tripRank === gold ? 9 : 8, groups) // 彩金葫蘆 / 葫蘆
  if (flush) return mk(pairs >= 1 ? 7 : 6, ranksDesc)                  // 對子同花 / 同花
  if (straight) return mk(5, [sh])                                     // 順子
  if (maxSame === 3) return mk(g && tripRank === gold ? 4 : 3, groups) // 彩金三條 / 三條
  if (pairs === 2) return mk(2, groups)
  if (pairs === 1) return mk(1, groups)
  return mk(0, groups)
}

function evaluate3(cards: string[], gold: number): Eval {
  const groups = rankGroups(cards)
  const c = rankCount(cards)
  let maxSame = 0, tripRank = 0
  for (const rs of Object.keys(c)) {
    const r = Number(rs), n = c[r] ?? 0
    maxSame = Math.max(maxSame, n)
    if (n === 3) tripRank = r
  }
  if (maxSame === 3) return mk(gold >= 2 && tripRank === gold ? 4 : 3, groups) // 彩金衝三 / 衝三
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
export function isFoul(front: string[], middle: string[], back: string[], goldenRank?: number | null): boolean {
  if (front.length !== 3 || middle.length !== 5 || back.length !== 5) return false
  const f = evaluate(front, goldenRank), m = evaluate(middle, goldenRank), b = evaluate(back, goldenRank)
  return compareEval(b, m) < 0 || compareEval(m, f) < 0
}
