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
