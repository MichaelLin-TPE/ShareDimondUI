export type ListingType = 'FIXED_PRICE' | 'BIDDING'
export type ListingStatus = 'OPEN' | 'WAIT_PAY' | 'COMPLETED' | 'CANCELED' | 'EXPIRED'

export interface PersonalListingItem {
  itemId: string
  itemName: string
  clanId: string
  ownerMemberId: number
  createdAt: string | null
}

export interface PersonalListing {
  id: number
  listingCode: string
  clanId: string
  sellerMemberId: number
  sellerName: string
  itemId: string
  itemName: string
  listingType: ListingType
  status: ListingStatus
  fixedPrice: number | null
  startPrice: number | null
  currentPrice: number | null
  finalPrice: number | null
  currency: string
  confirmCurrency: string | null
  biddingMemberId: number
  buyerMemberId: number
  buyerName: string | null
  hasEnoughMoney: boolean
  expireTime: string | null
  confirmTime: string | null
  failedBidCount: number
  remark: string | null
  createTime: string | null
}

export interface PersonalListingBidding {
  id: number
  listingCode: string
  memberId: number
  memberName: string
  joinTime: string
  biddingPrice: number
  currency: string
}

export interface PersonalListingDetail {
  listing: PersonalListing
  bids: PersonalListingBidding[]
}

export interface OpenListingPayload {
  itemId: string
  /** 0 = FIXED_PRICE, 1 = BIDDING */
  type: 0 | 1
  fixedPrice?: number
  startPrice?: number
  currency: string
  /** BIDDING 必填; FIXED_PRICE 可不填或 0 = 不限期 */
  durationMins?: number
  remark?: string
}

export interface EditListingPayload {
  listingCode: string
  fixedPrice?: number
  startPrice?: number
  currency?: string
  durationMins?: number
  remark?: string
}
