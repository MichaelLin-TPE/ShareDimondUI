// 伺服器設置。基本設定為現行 config 真值;倍率尚未定案;
// 衝裝機率取自 rates.properties EnchantRateOver1~4,語意待與伺服器端核對後定稿。
export interface AgKv { k: string; v: string; note?: string }

export const AG_SERVER_BASIC: AgKv[] = [
  { k: '版本', v: '3.81' },
  { k: '等級上限', v: '100' },
  { k: '職業', v: '7 職', note: '君主 / 騎士 / 妖精 / 法師 / 黑妖 / 龍騎士 / 幻術師' },
  { k: '同 IP 多開', v: '3 隻' },
  { k: '每日重置', v: '00:00', note: '簽到 / 媽祖 / 副本 / 限購' },
  { k: '51 級後加點上限', v: '每圍 35' },
  { k: '萬能藥上限', v: '單圍 45 · 總計 20 瓶' },
  { k: '登入器', v: 'AEGIS 神盾', note: '啟動自動更新' },
]

export const AG_SERVER_RATES: AgKv[] = [
  { k: '經驗倍率', v: '調整中' },
  { k: '天幣掉落', v: '調整中' },
  { k: '物品掉落', v: '調整中' },
  { k: '負重倍率', v: '×100' },
  { k: '商店賣價 / 買價', v: '×1.0 / ×1.0' },
]

export interface AgEnchantRow { step: string; rate: string; fail: string }
export const AG_ENCHANT: AgEnchantRow[] = [
  { step: '安全值內', rate: '100%', fail: '不會失敗' },
  { step: '超過安全值 +1', rate: '40%', fail: '破裝' },
  { step: '超過安全值 +2', rate: '20%', fail: '破裝' },
  { step: '超過安全值 +3', rate: '15%', fail: '破裝' },
  { step: '超過安全值 +4 以上', rate: '10%', fail: '破裝' },
]
