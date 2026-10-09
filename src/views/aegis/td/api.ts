// 天堂塔防的後端呼叫與資料型別(對應後端 TdController / TdService 的回應)。
// 天幣、女神像生命、波數全部是後端算的;這裡只送「我要做什麼」、拿回「發生了什麼」。
import { api } from '../prereg/api'

export interface PathInfo { title: string; desc: string }
/** jobTitle / jobDesc:轉職後的稱號與說明 */
export interface ClassInfo { id: string; title: string; desc: string; price: number; baseDmg: number; range: number; magic: boolean; paths: PathInfo[]; jobTitle: string; jobDesc: string }
export interface MobInfo { id: string; title: string; desc: string; speed: number }
export interface BlessInfo { id: string; title: string; desc: string; rarity: number }
export interface TalentInfo { id: string; title: string; desc: string; max: number }
/** 一張地圖:路線折點、塔位、女神像位置(邏輯像素) */
export interface MapInfo { path: number[][]; slots: number[][]; goddess: number[] }
export interface TdConfig {
  width: number; height: number; unit: number; path: number[][]; slots: number[][]; goddess: number[]; tps: number
  maxLevel: number; pathLevel: number; jobLevel: number; jobMaxLevel: number; jobDmgPct: number; princeLimit: number; sellRefundPct: number; blessEvery: number
  /** 覺醒最高到幾級(15 之後)、技能最高幾階 */
  awakenMaxLevel: number; skillMaxRank: number
  classes: ClassInfo[]; mobs: MobInfo[]; bosses: string[]; chapters: string[]; blessings: BlessInfo[]; talents: TalentInfo[]
  /** 全部七張地圖,照場景順序;path / slots / goddess 是第一張(舊欄位) */
  maps: MapInfo[]
}

export interface TowerView {
  cls: string; level: number; path: number; pathTitle: string | null; upgradeCost: number; sellValue: number
  dmg: number; rangePx: number; perMinute: number; hp: number; needPath: boolean
  /** 騎士會在路上哪幾個地方把怪攔下來(後端的距離單位;其他職業是空的) */
  guards: number[]
  /** 君主才有:這座光環現在給什麼(直接顯示) */
  aura: string | null
  /** 轉職了沒、轉職後的稱號、第二條路線;canJob = 現在可以轉職(10 級、選過路線、還沒轉) */
  job: boolean; jobTitle: string | null; path2: number; path2Title: string | null; canJob: boolean
  /** 覺醒了幾級(15 級以下 0);職業技能(轉職後才能買,cost = -1 是練滿或還不能買) */
  awaken: number; skills: SkillView[]
}
export interface SkillView { idx: number; title: string; desc: string; rank: number; max: number; cost: number }
export interface BlessView { id: string; title: string; desc: string; rarity: number; count: number }
export interface RunView {
  wave: number; wavesCleared: number; chapter: string; gold: number; goddessHp: number; goddessMax: number
  towers: (TowerView | null)[]; prices: Record<string, number>; princeLeft: number; discountPct: number
  blessings: BlessView[]; choices: BlessView[] | null; over: boolean; kills: number; leaks: number
  firstOfDay: boolean; bossNext: boolean
  /** 下一波會出的怪:[類型, 階級(0 一般 1 精英 2 王), 數量] */
  nextSpawns: number[][]
  /** 這一波用 config.maps 的第幾張 */
  map: number
  /** 候補區:換場景收回來的英雄,要擺回去才能開始下一波 */
  bench: TowerView[]
  /** 重擺期間(換場景之後、開打之前):擺好的可以再拿起來 */
  rearranging: boolean
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
  action: (type: 'buy' | 'upgrade' | 'path' | 'job' | 'place' | 'pickup' | 'sell' | 'bless' | 'skill', slot: number | null, cls: string | null, value: number | null) =>
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
