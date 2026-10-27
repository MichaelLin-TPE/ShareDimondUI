// 事前預約站(/reserve)的內容設定。
// 里程碑:預約帳號數達到 count,全服玩家開服都拿得到 items。獎勵是草案,改這裡就好,畫面自動跟著變。
export type RvIcon = 'potion' | 'scroll' | 'hourglass' | 'doll' | 'crown'

export interface RvMilestone {
  count: number
  title: string
  icon: RvIcon
  items: string[]
}

export const RV_MILESTONES: RvMilestone[] = [
  { count: 500, title: '開荒補給', icon: 'potion', items: ['終極治癒藥水 ×100', '自我加速藥水 ×30'] },
  { count: 1000, title: '衝裝起步', icon: 'scroll', items: ['對武器施法的卷軸 ×2', '對盔甲施法的卷軸 ×3'] },
  { count: 2000, title: '時光饋贈', icon: 'hourglass', items: ['時光袋 ×5'] },
  { count: 3000, title: '魔法夥伴', icon: 'doll', items: ['娃娃召喚卷 ×1', '六芒星抽抽包 ×3'] },
  { count: 5000, title: '全服狂歡', icon: 'crown', items: ['開服首週經驗 ×2', '金元寶 ×50'] },
]

/** 分享用的網址:不帶 #,LINE 貼上才不會被改掉(public/reserve/index.html 會轉進來) */
export const RV_SHARE_URL = 'https://gameshare-system.com/reserve/'

export const RV_STEPS = [
  { n: '01', t: '建立帳號', d: '帳號就是開服後登入遊戲用的帳號。' },
  { n: '02', t: '創立角色', d: '職業、性別、能力值、名字現在就定。' },
  { n: '03', t: '開服登入', d: '角色已經在選角畫面,里程碑獎勵直接領。' },
]

/** 遊戲特色:數字列(數值同官網伺服器設置 server.ts) */
export const RV_STATS = [
  { v: '3.81', k: '經典版本' },
  { v: '×10', k: '經驗倍率' },
  { v: '100', k: '等級上限' },
  { v: '3', k: '同 IP 多開' },
  { v: '00:00', k: '每日重置' },
]

/** 遊戲特色:挑六個最有感的,圖在 public/aegis/art/;完整的在官網 /aegis/features */
export const RV_FEATURES = [
  { title: '屠龍遠征', line: '每天輪一條龍,首通拿屠龍聖印。', art: 'dragonraid.jpg' },
  { title: '王裝', line: '每隻王都有自己的套裝和武器。', art: 'bossgear.jpg' },
  { title: '獄之試煉', line: '1~4 人打王,十分鐘一場,每天都能打。', art: 'dungeon.jpg' },
  { title: '首領積分', line: '打王不用搶最後一刀,打多少算多少。', art: 'boss-points.jpg' },
  { title: '魔法娃娃', line: '抽娃娃、合成、升星,全帳號一起變強。', art: 'doll.jpg' },
  { title: '釣魚', line: '掛個竿,錢跟屬性自己游過來。', art: 'fishing-panic.jpg' },
]
