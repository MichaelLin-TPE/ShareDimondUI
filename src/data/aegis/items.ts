// 武器防具(假資料佔位)。之後從伺服器 DB weapon / armor 表匯出蓋掉。
export type AgItemCat = 'weapon' | 'armor'

export interface AgItem {
  name: string
  cat: AgItemCat
  slot: string
  stat: string // 武器:小/大攻擊;防具:AC
  safe: number
  cls: string
  from: string
}

export const AG_ITEM_TABS: { key: AgItemCat; label: string }[] = [
  { key: 'weapon', label: '武器' },
  { key: 'armor', label: '防具' },
]

export const AG_ITEMS: AgItem[] = [
  { name: '短劍', cat: 'weapon', slot: '單手劍', stat: '5 / 4', safe: 6, cls: '全職業', from: '商店' },
  { name: '長劍', cat: 'weapon', slot: '單手劍', stat: '8 / 10', safe: 6, cls: '君主 騎士 黑妖', from: '商店' },
  { name: '日本刀', cat: 'weapon', slot: '單手劍', stat: '10 / 8', safe: 6, cls: '君主 騎士 黑妖', from: '怪物掉落' },
  { name: '雙手劍', cat: 'weapon', slot: '雙手劍', stat: '15 / 16', safe: 6, cls: '騎士', from: '怪物掉落' },
  { name: '長弓', cat: 'weapon', slot: '弓', stat: '10 / 11', safe: 6, cls: '妖精', from: '商店' },
  { name: '精靈弓', cat: 'weapon', slot: '弓', stat: '12 / 14', safe: 6, cls: '妖精', from: '怪物掉落' },
  { name: '雙刀', cat: 'weapon', slot: '雙刀', stat: '9 / 11', safe: 6, cls: '黑妖', from: '怪物掉落' },
  { name: '魔杖', cat: 'weapon', slot: '法杖', stat: '4 / 4', safe: 6, cls: '法師', from: '商店' },
  { name: '皮盔', cat: 'armor', slot: '頭盔', stat: 'AC −1', safe: 6, cls: '全職業', from: '商店' },
  { name: '鎖子甲', cat: 'armor', slot: '盔甲', stat: 'AC −5', safe: 6, cls: '君主 騎士', from: '商店' },
  { name: '板甲', cat: 'armor', slot: '盔甲', stat: 'AC −7', safe: 6, cls: '騎士', from: '怪物掉落' },
  { name: '精靈鏈甲', cat: 'armor', slot: '盔甲', stat: 'AC −6', safe: 6, cls: '妖精', from: '怪物掉落' },
  { name: '魔法長袍', cat: 'armor', slot: '盔甲', stat: 'AC −3', safe: 6, cls: '法師', from: '商店' },
  { name: '鐵盾', cat: 'armor', slot: '盾牌', stat: 'AC −3', safe: 6, cls: '君主 騎士', from: '商店' },
  { name: '皮靴', cat: 'armor', slot: '鞋子', stat: 'AC −1', safe: 6, cls: '全職業', from: '商店' },
  { name: '守護斗篷', cat: 'armor', slot: '斗篷', stat: 'AC −2', safe: 6, cls: '全職業', from: '任務' },
]
