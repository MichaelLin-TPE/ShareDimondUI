// 技能介紹(假資料佔位)。之後直接從伺服器 DB skills 表匯出蓋掉,欄位對齊即可。
export type AgClassKey = 'all' | 'royal' | 'knight' | 'elf' | 'wizard' | 'darkelf' | 'dragon' | 'illusion'

export interface AgSkill {
  name: string
  cls: AgClassKey
  level: number
  mp: number
  cooldown: string
  type: '攻擊' | '輔助' | '治癒' | '減益'
  effect: string
}

export const AG_SKILL_TABS: { key: AgClassKey; label: string }[] = [
  { key: 'all', label: '共通' },
  { key: 'royal', label: '君主' },
  { key: 'knight', label: '騎士' },
  { key: 'elf', label: '妖精' },
  { key: 'wizard', label: '法師' },
  { key: 'darkelf', label: '黑妖' },
  { key: 'dragon', label: '龍騎士' },
  { key: 'illusion', label: '幻術師' },
]

export const AG_SKILLS: AgSkill[] = [
  { name: '初級治癒術', cls: 'all', level: 1, mp: 5, cooldown: '—', type: '治癒', effect: '回復少量 HP' },
  { name: '光箭', cls: 'all', level: 1, mp: 3, cooldown: '—', type: '攻擊', effect: '單體魔法傷害 1d6+10' },
  { name: '保護罩', cls: 'all', level: 2, mp: 8, cooldown: '—', type: '輔助', effect: 'AC −2,持續 1800 秒' },
  { name: '日光術', cls: 'all', level: 2, mp: 6, cooldown: '—', type: '輔助', effect: '照亮周圍,持續 1800 秒' },
  { name: '祝福魔法武器', cls: 'all', level: 4, mp: 10, cooldown: '—', type: '輔助', effect: '武器命中 +2、傷害 +2' },
  { name: '王族光環', cls: 'royal', level: 20, mp: 20, cooldown: '600 秒', type: '輔助', effect: '隊伍全體屬性加成' },
  { name: '衝擊之暈', cls: 'knight', level: 50, mp: 20, cooldown: '30 秒', type: '減益', effect: '目標暈眩 3 秒,命中已平衡' },
  { name: '精準目標', cls: 'elf', level: 30, mp: 15, cooldown: '—', type: '減益', effect: '遠程命中 −8' },
  { name: '烈焰武器', cls: 'elf', level: 30, mp: 15, cooldown: '—', type: '輔助', effect: '武器附加火屬性傷害' },
  { name: '火球術', cls: 'wizard', level: 24, mp: 20, cooldown: '—', type: '攻擊', effect: '範圍火屬性傷害' },
  { name: '冰矛圍籬', cls: 'wizard', level: 32, mp: 25, cooldown: '—', type: '攻擊', effect: '範圍冰屬性傷害並減速' },
  { name: '燃燒的火焰', cls: 'darkelf', level: 30, mp: 15, cooldown: '—', type: '輔助', effect: '雙刀傷害 +3' },
  { name: '龍之守護', cls: 'dragon', level: 30, mp: 20, cooldown: '—', type: '輔助', effect: '減傷 +10%,持續 300 秒' },
  { name: '立方體:火焰', cls: 'illusion', level: 40, mp: 30, cooldown: '60 秒', type: '攻擊', effect: '召喚火焰立方體持續傷害' },
]
