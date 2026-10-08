// 小遊戲總開關。2026-10-09 使用者為送金流審核先全部隱藏;要恢復把 GAMES_HIDDEN 改 false 重新部署即可。
// 後端 API 與資料都沒動,只是前端不顯示、不讓進。
export const GAMES_HIDDEN = true

/** 所有小遊戲與彩金分配的路由 */
export const GAME_PATHS = [
  '/clan/game1a2b',
  '/clan/slot',
  '/clan/dice',
  '/clan/roulette',
  '/clan/thirteen',
  '/clan/niuniu',
  '/clan/scratch',
  '/clan/holdem',
  '/clan/jackpotDistribute',
]

/** 功能權限頁上屬於小遊戲的功能鍵 */
export const GAME_FEATURE_KEYS = ['game1a2b']
