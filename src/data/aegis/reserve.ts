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
  { v: '0', k: '儲值能買到的裝備' },
  { v: '×10', k: '經驗倍率' },
  { v: '100', k: '等級上限' },
  { v: '3', k: '同 IP 多開' },
  { v: '00:00', k: '每日重置' },
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
  { title: '賽季', line: '兩週一季,每個人的任務都不一樣。', art: 'season.jpg' },
  { title: '裝備圖鑑', line: '爛裝也有用,登錄收藏冊全帳號永久加成。', art: 'codex.jpg' },
  { title: '屠龍遠征', line: '每天輪一條龍,首通拿屠龍聖印。', art: 'dragonraid.jpg' },
  { title: '獄之試煉', line: '1~4 人打王,十分鐘一場,每天都能打。', art: 'dungeon.jpg' },
  { title: '時光幣', line: '在線每 30 分鐘一顆,5 顆開一袋。', art: 'hourglass.jpg' },
  { title: '釣魚', line: '掛個竿,錢跟屬性自己游過來。', art: 'fishing-panic.jpg' },
]
