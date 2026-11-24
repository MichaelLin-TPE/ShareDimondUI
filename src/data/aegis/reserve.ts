import { AG_FEATURES } from './features'

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
  { count: 50, title: '開荒補給', icon: 'potion', items: ['受祝福瞬間移動卷軸 ×100', '治癒藥水(綁定)×1,000'] },
  { count: 100, title: '時光饋贈', icon: 'hourglass', items: ['時光袋 ×10'] },
  { count: 200, title: '魔法夥伴', icon: 'doll', items: ['娃娃召喚卷 ×10'] },
  { count: 300, title: '破曉變身', icon: 'crown', items: ['紫變自選卷軸 ×1', '炫色武器石 ×5', '炫色防具石 ×5'] },
]

/** 分享用的網址:不帶 #,LINE 貼上才不會被改掉(public/reserve/index.html 會轉進來) */
export const RV_SHARE_URL = 'https://gameshare-system.com/reserve/'

export const RV_STEPS = [
  { n: '01', t: '建立帳號', d: '帳號就是開服後登入遊戲用的帳號。' },
  { n: '02', t: '創立角色', d: '職業、性別、能力值、名字現在就定。' },
  { n: '03', t: '開服登入', d: '角色已經在選角畫面,里程碑獎勵直接領。' },
]

/** 遊戲特色:數字列(數值同官網伺服器設置 server.ts) */
// 跟官網首頁數字帶同一套(雲端 config 真值);「不賣裝備」用文案帶,不放數字(2026-11-07 使用者)
export const RV_STATS = [
  { v: '×4', k: '經驗倍率' },
  { v: '×10', k: '負重倍率' },
  { v: '60', k: '等級上限' },
  { v: '3', k: '同 IP 多開' },
  { v: String(AG_FEATURES.length), k: '首創玩法' },
]

/** 三個問句:跟官網首頁同一套,打玩家換服的痛點 */
export const RV_WHY = [
  { q: '玩膩了短期服?', a: '這裡長期經營,今天練的每一級,明年還在。' },
  { q: '還在玩賣裝備的服?', a: '沒有儲值買強度,王裝、符文、娃娃全部自己打。' },
  { q: '無課怕追不上人?', a: '強度只看你花的時間,機率全部公開,努力多少就強多少。' },
]

/** 遊戲特色:挑六個最有感的,圖在 public/aegis/art/;完整的在官網 /aegis/features */
export const RV_FEATURES = [
  { title: '首領積分', line: '打王不用搶最後一刀,打多少算多少。', art: 'boss-points.jpg' },
  { title: '懸賞令', line: '每天三張懸賞單,解完拿積分、精華、聲望。', art: 'bounty.jpg' },
  { title: '職業試煉', line: '一隻 NPC 帶你從 15 級打到 50 級,每關發裝備。', art: 'trial-officer.jpg' },
  { title: '賽季', line: '一週一季,每週換主題,每個人的任務都不一樣。', art: 'season.jpg' },
  { title: '裝備圖鑑', line: '爛裝也有用,登錄收藏冊全帳號永久加成。', art: 'codex.jpg' },
  { title: '屠龍遠征', line: '每天輪一條龍,首通拿屠龍聖印。', art: 'dragonraid.jpg' },
  { title: '獄之試煉', line: '1~4 人打王,十分鐘一場,每天都能打。', art: 'dungeon.jpg' },
  { title: '獨家娛樂場', line: '拉霸、妞妞、十三支、麻將、捕魚,天幣上桌、真人坐莊。', art: 'casino.jpg' },
  { title: '釣魚', line: '掛個竿,錢跟屬性自己游過來。', art: 'fishing-panic.jpg' },
]
