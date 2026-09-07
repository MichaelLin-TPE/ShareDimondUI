// 遊戲特色(內容為伺服器已實作系統;截圖待補)。
export interface AgFeature {
  id: string
  idx: string
  title: string
  short: string
  points: string[]
  shot: string
}

export const AG_FEATURES: AgFeature[] = [
  {
    id: 'fishing', idx: '01', title: '釣魚系統', short: '五種釣竿,分層的速度、距離、耐久與掉落。',
    points: ['地圖 5300 全水域可釣', '短竿到長竿五種分層,越好的竿釣得越遠越快', '獨立掉落表,掛機也能有穩定收入'],
    shot: '釣魚場景截圖',
  },
  {
    id: 'collection', idx: '02', title: '釣魚收藏', short: '登錄收藏品,屬性永久生效。',
    points: ['13 件收藏品,三個系列加傳說級', '向 NPC 登錄後不佔背包、永久加屬性', '成就能力查詢可看目前加成'],
    shot: '收藏登錄畫面',
  },
  {
    id: 'enchant', idx: '03', title: '公開衝裝機率', short: '所有人同一張表,失敗一律破裝。',
    points: ['機率表吃設定檔,直接公開在伺服器設置頁', '不分帳號、不分身分', '安全值以上失敗即破,沒有例外'],
    shot: '衝裝畫面',
  },
  {
    id: 'daily', idx: '04', title: '午夜排程重置', short: '每日 00:00 準時,不靠重啟。',
    points: ['簽到、媽祖祝福、副本次數、限購額度', '排程重置,伺服器不用天天重開', '重啟週期拉長,掛機更穩'],
    shot: '每日簽到畫面',
  },
  {
    id: 'aegis', idx: '05', title: 'AEGIS 神盾登入器', short: '啟動即更新,常用輔助內建。',
    points: ['撿取、吃肉、修刀、盟徽、傷害顯示、掛網六開關', '啟動時自動檢查並套用更新', '不需另裝外掛'],
    shot: '登入器畫面',
  },
]
