export interface Member {
  account: string
  userName: string
  clanId:string
  enabled:boolean
  createAt:string
  authToken:string
  clanName: string
  role:string
  /** 血盟試用到期時間 (epoch millis) */
  clanExpiresAt?: number | null
}
