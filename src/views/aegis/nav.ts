// 神盾天堂官網導覽設定。
// 加入口:在這裡加一行 + 在 router 加對應 child + 建一個 view。
// 導覽列版型是「左右各半、中間 logo」(Dune),left / right 決定落在 logo 的哪一側。
export interface AgNavItem {
  label: string
  to: string
  side: 'left' | 'right'
  /** 強調項(白字),目前只給「點我玩遊戲」 */
  strong?: boolean
}

export const AG_NAV: AgNavItem[] = [
  { label: '最新消息', to: '/aegis/news', side: 'left' },
  { label: '職業介紹', to: '/aegis/classes', side: 'left' },
  { label: '遊戲特色', to: '/aegis/features', side: 'left' },
  { label: '伺服器設置', to: '/aegis/server', side: 'left' },
  { label: '技能介紹', to: '/aegis/skills', side: 'right' },
  { label: '武器防具', to: '/aegis/items', side: 'right' },
  { label: '交易區', to: '/aegis/market', side: 'right' },
  { label: '聯絡客服', to: '/aegis/contact', side: 'right' },
  { label: '點我玩遊戲', to: '/aegis/play', side: 'right', strong: true },
]

export const AG_SITE = {
  name: '神盾天堂',
  latin: 'AEGIS',
  tagline: '3.81 經典私服',
  /** AEGIS 登入器最新版下載(公開 repo release) */
  downloadUrl: 'https://github.com/MichaelLin-TPE/AEGIS/releases/latest',
  lineQr: 'https://qr-official.line.me/gs/M_920wuugp_GW.png?oat_content=qr',
}
