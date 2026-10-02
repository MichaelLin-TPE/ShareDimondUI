// 天堂塔防的後端呼叫與資料型別(對應後端 TdController / TdService 的回應)。
// 天幣、女神像生命、波數全部是後端算的;這裡只送「我要做什麼」、拿回「發生了什麼」。
import { api } from '../prereg/api'

export interface PathInfo { title: string; desc: string }
export interface ClassInfo { id: string; title: string; desc: string; price: number; baseDmg: number; range: number; magic: boolean; paths: PathInfo[] }
export interface MobInfo { id: string; title: string; desc: string; speed: number }
export interface BlessInfo { id: string; title: string; desc: string; rarity: number }
export interface TalentInfo { id: string; title: string; desc: string; max: number }
export interface TdConfig {
  width: number; height: number; unit: number; path: number[][]; slots: number[][]; goddess: number[]; tps: number
  maxLevel: number; pathLevel: number; princeLimit: number; sellRefundPct: number; blessEvery: number
  classes: ClassInfo[]; mobs: MobInfo[]; bosses: string[]; chapters: string[]; blessings: BlessInfo[]; talents: TalentInfo[]
}

export interface TowerView {
  cls: string; level: number; path: number; pathTitle: string | null; upgradeCost: number; sellValue: number
  dmg: number; rangePx: number; perMinute: number; hp: number; needPath: boolean
  /** 騎士會在路上哪幾個地方把怪攔下來(後端的距離單位;其他職業是空的) */
  guards: number[]
}
export interface BlessView { id: string; title: string; desc: string; rarity: number; count: number }
export interface RunView {
  wave: number; wavesCleared: number; chapter: string; gold: number; goddessHp: number; goddessMax: number
  towers: (TowerView | null)[]; prices: Record<string, number>; princeLeft: number; discountPct: number
  blessings: BlessView[]; choices: BlessView[] | null; over: boolean; kills: number; leaks: number
  firstOfDay: boolean; bossNext: boolean
  /** 下一波會出的怪:[類型, 階級(0 一般 1 精英 2 王), 數量] */
  nextSpawns: number[][]
}
export interface TalentView { id: string; title: string; desc: string; level: number; max: number; nextCost: number }
export interface ProfileView { badges: number; talents: TalentView[]; bestWave: number; bestHp: number; runs: number; firstRunBonusAvailable: boolean }
export interface StateView { profile: ProfileView; run: RunView | null }
export interface WaveView {
  wave: number; events: number[][]; ticks: number; goldEarned: number; kills: number; leaks: number
  cleared: boolean; over: boolean; badgesEarned: number; newBest: boolean; state: StateView
}
export interface RankRow { rank: number; name: string; wave: number; hp: number; at: string; me: boolean }
export interface RankView { top: RankRow[]; mine: RankRow | null; players: number }

export const td = {
  config: () => api.get<TdConfig>('/aegis/td/config', false),
  state: () => api.get<StateView>('/aegis/td/state'),
  start: () => api.post<StateView>('/aegis/td/run/start'),
  action: (type: 'buy' | 'upgrade' | 'path' | 'sell' | 'bless', slot: number | null, cls: string | null, value: number | null) =>
    api.post<StateView>('/aegis/td/run/action', { type, slot, cls, value }),
  wave: () => api.post<WaveView>('/aegis/td/run/wave'),
  abandon: () => api.post<WaveView>('/aegis/td/run/abandon'),
  talent: (index: number) => api.post<StateView>('/aegis/td/talent', { index }),
  ranking: (limit = 100) => api.get<RankView>(`/aegis/td/ranking?limit=${limit}`),
}

// 事件碼(跟後端 TdEngine 一樣;每筆事件是一個數字陣列,[0] 是事件碼、[1] 是第幾個 tick)
export const EV = { SPAWN: 1, MOVE: 2, HIT: 3, CAST: 4, STATUS: 5, DIE: 6, LEAK: 7, KNIGHT: 8, BLOCK: 9, REVIVE: 10, END: 99 } as const
export const HIT_FLAG = { CRIT: 1, SPLASH: 2, CHAIN: 4, POISON: 8, REFLECT: 16, BRAVE: 32 } as const
export const STATUS = { SLOW: 1, STUN: 2, POISON: 3 } as const
export const KNIGHT = { HIT: 0, DOWN: 1, UP: 2 } as const
/** 後端 Cls 的順序 */
export const CLS_ORDER = ['ELF', 'KNIGHT', 'WIZARD', 'DARKELF', 'PRINCE'] as const
