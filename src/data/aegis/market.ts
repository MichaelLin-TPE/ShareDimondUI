// 交易區:先做「參考物價表」版(假資料佔位)。之後若要玩家貼單,另接後端。
export interface AgPrice {
  cat: string
  name: string
  price: number // 天幣
  trend: 'up' | 'down' | 'flat'
  note?: string
}

export const AG_MARKET_CATS = ['卷軸', '藥水', '材料', '裝備']

export const AG_MARKET: AgPrice[] = [
  { cat: '卷軸', name: '武器強化卷軸', price: 12000, trend: 'up' },
  { cat: '卷軸', name: '防具強化卷軸', price: 8000, trend: 'flat' },
  { cat: '卷軸', name: '祝福武器強化卷軸', price: 65000, trend: 'up', note: '週末需求高' },
  { cat: '卷軸', name: '傳送卷軸', price: 300, trend: 'flat' },
  { cat: '藥水', name: '高品質治癒藥水', price: 220, trend: 'down' },
  { cat: '藥水', name: '精靈餅乾', price: 1500, trend: 'flat' },
  { cat: '藥水', name: '勇敢藥水', price: 900, trend: 'up' },
  { cat: '材料', name: '魔法石', price: 4000, trend: 'flat' },
  { cat: '材料', name: '精靈水晶', price: 2600, trend: 'down' },
  { cat: '材料', name: '金屬礦石', price: 350, trend: 'flat' },
  { cat: '裝備', name: '+7 日本刀', price: 480000, trend: 'up' },
  { cat: '裝備', name: '+6 板甲', price: 260000, trend: 'flat' },
  { cat: '裝備', name: '守護斗篷', price: 45000, trend: 'down' },
]
