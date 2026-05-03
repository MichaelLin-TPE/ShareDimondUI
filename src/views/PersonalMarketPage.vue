<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { usePersonalMarket } from '@/composables/personalMarket.ts'
import type { PersonalListing } from '@/types/personalMarket.ts'

// 我的交易 sub-tab
type MineSubTab = 'sell' | 'buy' | 'history'
const mineSubTab = ref<MineSubTab>('sell')

const {
  activeTab,
  myItems,
  loading,
  submitting,
  searchQuery,
  typeFilter,
  detail,
  showDetailModal,
  showOpenModal,
  openForm,
  showEditModal,
  editForm,
  showCreateItemModal,
  createItemForm,
  showBidModal,
  bidForm,
  showBuyModal,
  buyForm,
  showSelectBuyerModal,
  selectBuyerForm,
  me,
  filteredMarketList,
  myActiveListings,
  myHistoryListings,
  myWaitPayPurchases,
  myHistoryPurchases,
  myBids,
  stats,
  openDetail,
  closeDetail,
  openCreateItem,
  submitCreateItem,
  openOpenModal,
  submitOpenListing,
  openEditModal,
  submitEditListing,
  cancelListing,
  openBuyModal,
  submitBuy,
  openBidModal,
  submitBid,
  openSelectBuyerModal,
  submitSelectBuyer,
  confirmFromWallet,
  confirmByGame,
  formatPrice,
  formatTime,
  formatRemain,
  statusLabel,
} = usePersonalMarket()

const balance = useBalanceStore()

// ===== item options for SearchableSelect =====
const itemOptions = computed(() =>
  myItems.value.map((it) => ({ value: it.itemId, label: it.itemName })),
)

// ===== currency options (公會啟用幣別) =====
const currencyOptions = computed(() =>
  balance.clanBalanceList.map((b) => ({ value: b.currency, label: b.currency })),
)

// 我的錢包 (for 立刻買的幣別選擇)
const myWalletOptions = computed(() =>
  balance.balanceList.map((b) => ({
    value: b.currency,
    label: `${b.currency} (餘額 ${Number(b.balance).toLocaleString()})`,
  })),
)

// 把 wait_pay 的單拆出來放最上面
const waitPayListings = computed(() =>
  myActiveListings.value.filter((l) => l.status === 'WAIT_PAY'),
)
const openListings = computed(() =>
  myActiveListings.value.filter((l) => l.status === 'OPEN'),
)

const isMine = (l: PersonalListing) => l.sellerName === me.value

// 詳情 helper
const detailListing = computed(() => detail.value?.listing ?? null)
const detailBids = computed(() => detail.value?.bids ?? [])
const detailIsMine = computed(() => detailListing.value?.sellerName === me.value)
const detailHasBids = computed(() => detailBids.value.length > 0)

const priceLabel = (l: PersonalListing) => {
  if (l.listingType === 'FIXED_PRICE') {
    return formatPrice(l.fixedPrice)
  }
  return formatPrice(l.currentPrice ?? l.startPrice)
}

const priceCaption = (l: PersonalListing) => {
  if (l.listingType === 'FIXED_PRICE') return '固定價'
  if (l.currentPrice != null) return '當前最高'
  return '起標價'
}

// 把編輯按鈕的有效性算清楚 (edit modal)
const onEdit = (l: PersonalListing) => {
  // 我們不知道是否有人出價,先打開讓用戶看,後端會擋
  // 但若已經有 currentPrice 就視為有人出過價
  const hasBids = l.currentPrice != null && l.currentPrice > 0
  openEditModal(l, hasBids)
}
</script>

<template>
  <div class="pm-page">
    <!-- ===== Header ===== -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon">💰</div>
        <div>
          <h1 class="page-title">個人掛賣區</h1>
          <p class="page-sub">公會內成員間的私人交易市場</p>
        </div>
      </div>
      <button class="btn-add" @click="openOpenModal">+ 開新掛單</button>
    </div>

    <!-- ===== Stats ===== -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-label">市場掛單</span>
        <span class="stat-value">{{ stats.market }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">我在賣</span>
        <span class="stat-value gold">{{ stats.mine }}</span>
      </div>
      <div class="stat-card" :class="{ flash: stats.waitPay > 0 }">
        <span class="stat-label">待我確認</span>
        <span class="stat-value warn">{{ stats.waitPay }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">我在買</span>
        <span class="stat-value buy">{{ stats.buying }}</span>
      </div>
    </div>

    <!-- ===== Tabs ===== -->
    <div class="seg-tabs">
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'market' }"
        @click="activeTab = 'market'"
      >
        🏪 市場
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'mine' }"
        @click="activeTab = 'mine'"
      >
        📋 我的交易
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'items' }"
        @click="activeTab = 'items'"
      >
        📦 道具庫
      </button>
    </div>

    <!-- ===== Loading ===== -->
    <div v-if="loading" class="empty-card">
      <div class="empty-icon">⏳</div>
      <div class="empty-text">載入中...</div>
    </div>

    <!-- ===== TAB: 市場 ===== -->
    <div v-else-if="activeTab === 'market'">
      <div class="toolbar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="🔍 搜尋道具或賣家..."
          class="search-input"
        />
        <div class="type-chips">
          <button
            type="button"
            class="chip"
            :class="{ active: typeFilter === 'ALL' }"
            @click="typeFilter = 'ALL'"
          >
            全部
          </button>
          <button
            type="button"
            class="chip"
            :class="{ active: typeFilter === 'FIXED_PRICE' }"
            @click="typeFilter = 'FIXED_PRICE'"
          >
            💰 固定價
          </button>
          <button
            type="button"
            class="chip"
            :class="{ active: typeFilter === 'BIDDING' }"
            @click="typeFilter = 'BIDDING'"
          >
            🎯 競標
          </button>
        </div>
      </div>

      <div v-if="filteredMarketList.length === 0" class="empty-card">
        <div class="empty-icon">🛒</div>
        <div class="empty-text">目前沒有掛賣中的商品</div>
      </div>

      <div v-else class="card-grid">
        <div
          v-for="l in filteredMarketList"
          :key="l.listingCode"
          class="listing-card"
          :class="{ mine: isMine(l), bidding: l.listingType === 'BIDDING' }"
          @click="openDetail(l.listingCode)"
        >
          <div class="card-top">
            <div class="card-item-name">{{ l.itemName }}</div>
            <span
              class="type-badge"
              :class="l.listingType === 'BIDDING' ? 'badge-bid' : 'badge-fixed'"
            >
              {{ l.listingType === 'BIDDING' ? '🎯 競標' : '💰 固定價' }}
            </span>
          </div>

          <div class="card-price-row">
            <span class="price-num">{{ priceLabel(l) }}</span>
            <span class="price-curr">{{ l.currency }}</span>
          </div>
          <div class="price-caption">{{ priceCaption(l) }}</div>

          <div class="card-meta">
            <span class="meta-item">👤 {{ l.sellerName }}</span>
            <span class="meta-item" :class="{ urgent: l.expireTime }">
              ⏱ {{ formatRemain(l.expireTime) }}
            </span>
          </div>

          <div v-if="l.remark" class="card-remark">📝 {{ l.remark }}</div>
          <span v-if="isMine(l)" class="mine-tag">我的單</span>
        </div>
      </div>
    </div>

    <!-- ===== TAB: 我的交易 ===== -->
    <div v-else-if="activeTab === 'mine'">
      <!-- 子分頁 -->
      <div class="sub-tabs">
        <button
          type="button"
          class="sub-tab-btn"
          :class="{ active: mineSubTab === 'sell' }"
          @click="mineSubTab = 'sell'"
        >
          🟡 賣
          <span
            v-if="waitPayListings.length + openListings.length > 0"
            class="sub-tab-badge"
          >
            {{ waitPayListings.length + openListings.length }}
          </span>
        </button>
        <button
          type="button"
          class="sub-tab-btn"
          :class="{ active: mineSubTab === 'buy' }"
          @click="mineSubTab = 'buy'"
        >
          🟣 買
          <span
            v-if="myWaitPayPurchases.length + myBids.length > 0"
            class="sub-tab-badge"
          >
            {{ myWaitPayPurchases.length + myBids.length }}
          </span>
        </button>
        <button
          type="button"
          class="sub-tab-btn"
          :class="{ active: mineSubTab === 'history' }"
          @click="mineSubTab = 'history'"
        >
          📜 歷史
          <span
            v-if="myHistoryListings.length + myHistoryPurchases.length > 0"
            class="sub-tab-badge"
          >
            {{ myHistoryListings.length + myHistoryPurchases.length }}
          </span>
        </button>
      </div>

      <!-- ===== Sub: 賣 ===== -->
      <div v-if="mineSubTab === 'sell'">
        <!-- ⚡ 賣家身份: 待我確認付款 -->
        <template v-if="waitPayListings.length > 0">
          <h3 class="section-h">⚡ 待我確認付款 ({{ waitPayListings.length }})</h3>
          <div class="my-list">
            <div
              v-for="l in waitPayListings"
              :key="l.listingCode"
              class="my-card waitpay"
            >
              <div class="my-card-head">
                <div class="my-name">{{ l.itemName }}</div>
                <span class="status-chip status-waitpay">{{ statusLabel(l.status) }}</span>
              </div>
              <div class="my-info">
                <div class="my-info-row">
                  <span class="info-label">買家</span>
                  <span class="info-val">👤 {{ l.buyerName ?? '—' }}</span>
                </div>
                <div class="my-info-row">
                  <span class="info-label">成交價</span>
                  <span class="info-val gold">
                    {{ formatPrice(l.finalPrice ?? l.currentPrice ?? l.fixedPrice) }}
                    {{ l.confirmCurrency ?? l.currency }}
                  </span>
                </div>
                <div class="my-info-row" v-if="!l.hasEnoughMoney">
                  <span class="warn-text">⚠ 買家下單時餘額不足,系統會在你按「錢包扣款」時即時補凍結</span>
                </div>
              </div>
              <div class="my-actions">
                <button
                  class="btn-confirm-wallet"
                  :disabled="submitting"
                  @click="confirmFromWallet(l.listingCode)"
                >
                  💳 錢包扣款
                </button>
                <button
                  class="btn-confirm-game"
                  :disabled="submitting"
                  @click="confirmByGame(l.listingCode)"
                >
                  🎮 遊戲內付款
                </button>
                <button class="btn-secondary-sm" @click="openDetail(l.listingCode)">
                  查看詳情
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- 📋 賣家身份: 我在賣 -->
        <template v-if="openListings.length > 0">
          <h3 class="section-h">📋 我在賣 ({{ openListings.length }})</h3>
          <div class="my-list">
            <div v-for="l in openListings" :key="l.listingCode" class="my-card">
              <div class="my-card-head">
                <div class="my-name">{{ l.itemName }}</div>
                <span class="type-badge" :class="l.listingType === 'BIDDING' ? 'badge-bid' : 'badge-fixed'">
                  {{ l.listingType === 'BIDDING' ? '🎯 競標' : '💰 固定價' }}
                </span>
              </div>
              <div class="my-info">
                <div class="my-info-row">
                  <span class="info-label">{{
                    l.listingType === 'FIXED_PRICE' ? '訂價' : (l.currentPrice ? '當前最高' : '起標價')
                  }}</span>
                  <span class="info-val gold">{{ priceLabel(l) }} {{ l.currency }}</span>
                </div>
                <div class="my-info-row">
                  <span class="info-label">期限</span>
                  <span class="info-val">{{ formatRemain(l.expireTime) }}</span>
                </div>
                <div v-if="l.listingType === 'BIDDING' && l.currentPrice" class="my-info-row">
                  <span class="info-label">最高出價</span>
                  <span class="info-val">👤 (見詳情)</span>
                </div>
              </div>
              <div class="my-actions">
                <button class="btn-secondary-sm" @click="openDetail(l.listingCode)">
                  查看詳情
                </button>
                <button
                  v-if="l.listingType === 'BIDDING' && l.currentPrice"
                  class="btn-finalize"
                  @click="openSelectBuyerModal()"
                >
                  結標選人
                </button>
                <button class="btn-edit-sm" @click="onEdit(l)">編輯</button>
                <button class="btn-danger-sm" @click="cancelListing(l.listingCode)">撤單</button>
              </div>
            </div>
          </div>
        </template>

        <div
          v-if="waitPayListings.length === 0 && openListings.length === 0"
          class="empty-card"
        >
          <div class="empty-icon">🟡</div>
          <div class="empty-text">你目前沒有掛賣中的單,點右上「+ 開新掛單」開始賣吧</div>
        </div>
      </div>

      <!-- ===== Sub: 買 ===== -->
      <div v-else-if="mineSubTab === 'buy'">
        <!-- 🛒 買家身份: 等賣家收款 -->
        <template v-if="myWaitPayPurchases.length > 0">
          <h3 class="section-h">🛒 等賣家收款 ({{ myWaitPayPurchases.length }})</h3>
          <div class="my-list">
            <div
              v-for="l in myWaitPayPurchases"
              :key="l.listingCode"
              class="my-card waitpay"
            >
              <div class="my-card-head">
                <div class="my-name">{{ l.itemName }}</div>
                <span class="status-chip status-waitpay">{{ statusLabel(l.status) }}</span>
              </div>
              <div class="my-info">
                <div class="my-info-row">
                  <span class="info-label">賣家</span>
                  <span class="info-val">👤 {{ l.sellerName }}</span>
                </div>
                <div class="my-info-row">
                  <span class="info-label">成交價</span>
                  <span class="info-val gold">
                    {{ formatPrice(l.finalPrice ?? l.currentPrice ?? l.fixedPrice) }}
                    {{ l.confirmCurrency ?? l.currency }}
                  </span>
                </div>
                <div class="my-info-row">
                  <span class="warn-text">⏳ 已下單,等待賣家確認收款</span>
                </div>
              </div>
              <div class="my-actions">
                <button class="btn-secondary-sm" @click="openDetail(l.listingCode)">
                  查看詳情
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- 🎯 買家身份: 我出價中 -->
        <template v-if="myBids.length > 0">
          <h3 class="section-h">🎯 我出價中 ({{ myBids.length }})</h3>
          <div class="my-list">
            <div v-for="l in myBids" :key="l.listingCode" class="my-card">
              <div class="my-card-head">
                <div class="my-name">{{ l.itemName }}</div>
                <span class="type-badge badge-bid">🎯 競標</span>
              </div>
              <div class="my-info">
                <div class="my-info-row">
                  <span class="info-label">賣家</span>
                  <span class="info-val">👤 {{ l.sellerName }}</span>
                </div>
                <div class="my-info-row">
                  <span class="info-label">當前最高</span>
                  <span class="info-val gold">{{ priceLabel(l) }} {{ l.currency }}</span>
                </div>
                <div class="my-info-row">
                  <span class="info-label">期限</span>
                  <span class="info-val" :class="{ urgent: l.expireTime }">
                    {{ formatRemain(l.expireTime) }}
                  </span>
                </div>
              </div>
              <div class="my-actions">
                <button class="btn-secondary-sm" @click="openDetail(l.listingCode)">
                  查看詳情
                </button>
                <button class="btn-bid-sm" @click="openDetail(l.listingCode)">
                  🎯 再加價
                </button>
              </div>
            </div>
          </div>
        </template>

        <div
          v-if="myWaitPayPurchases.length === 0 && myBids.length === 0"
          class="empty-card"
        >
          <div class="empty-icon">🟣</div>
          <div class="empty-text">你目前沒有正在進行的購買,到「🏪 市場」逛逛吧</div>
        </div>
      </div>

      <!-- ===== Sub: 歷史 ===== -->
      <div v-else-if="mineSubTab === 'history'">
        <!-- 📜 賣家歷史 -->
        <template v-if="myHistoryListings.length > 0">
          <h3 class="section-h">📜 賣家歷史 ({{ myHistoryListings.length }})</h3>
          <div class="my-list">
            <div
              v-for="l in myHistoryListings"
              :key="l.listingCode"
              class="my-card history"
            >
              <div class="my-card-head">
                <div class="my-name">{{ l.itemName }}</div>
                <span class="status-chip" :class="`status-${l.status.toLowerCase()}`">
                  {{ statusLabel(l.status) }}
                </span>
              </div>
              <div class="my-info">
                <div class="my-info-row" v-if="l.status === 'COMPLETED'">
                  <span class="info-label">成交</span>
                  <span class="info-val gold">
                    {{ formatPrice(l.finalPrice) }} {{ l.confirmCurrency ?? l.currency }}
                  </span>
                </div>
                <div class="my-info-row" v-if="l.buyerName && l.status === 'COMPLETED'">
                  <span class="info-label">買家</span>
                  <span class="info-val">👤 {{ l.buyerName }}</span>
                </div>
                <div class="my-info-row">
                  <span class="info-label">時間</span>
                  <span class="info-val">{{ formatTime(l.confirmTime ?? l.createTime) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 🛍️ 買家歷史 -->
        <template v-if="myHistoryPurchases.length > 0">
          <h3 class="section-h">🛍️ 買家歷史 ({{ myHistoryPurchases.length }})</h3>
          <div class="my-list">
            <div
              v-for="l in myHistoryPurchases"
              :key="l.listingCode"
              class="my-card history"
            >
              <div class="my-card-head">
                <div class="my-name">{{ l.itemName }}</div>
                <span class="status-chip" :class="`status-${l.status.toLowerCase()}`">
                  {{ statusLabel(l.status) }}
                </span>
              </div>
              <div class="my-info">
                <div class="my-info-row" v-if="l.status === 'COMPLETED'">
                  <span class="info-label">付款</span>
                  <span class="info-val gold">
                    {{ formatPrice(l.finalPrice) }} {{ l.confirmCurrency ?? l.currency }}
                  </span>
                </div>
                <div class="my-info-row">
                  <span class="info-label">賣家</span>
                  <span class="info-val">👤 {{ l.sellerName }}</span>
                </div>
                <div class="my-info-row">
                  <span class="info-label">時間</span>
                  <span class="info-val">{{ formatTime(l.confirmTime ?? l.createTime) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div
          v-if="myHistoryListings.length === 0 && myHistoryPurchases.length === 0"
          class="empty-card"
        >
          <div class="empty-icon">📜</div>
          <div class="empty-text">還沒有歷史紀錄</div>
        </div>
      </div>
    </div>

    <!-- ===== TAB: 道具庫 ===== -->
    <div v-else-if="activeTab === 'items'">
      <div class="items-toolbar">
        <span class="items-hint">先在這裡建立道具,才能拿來開掛單</span>
        <button class="btn-add-secondary" @click="openCreateItem">+ 新增道具</button>
      </div>

      <div v-if="myItems.length === 0" class="empty-card">
        <div class="empty-icon">📦</div>
        <div class="empty-text">道具庫是空的,點上方「+ 新增道具」加一個</div>
      </div>

      <div v-else class="item-grid">
        <div v-for="it in myItems" :key="it.itemId" class="item-card">
          <div class="item-icon-wrap">📦</div>
          <div class="item-content">
            <div class="item-name-text">{{ it.itemName }}</div>
            <div class="item-meta">建立於 {{ formatTime(it.createdAt) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================
         Modal: 詳情
         ============================================ -->
    <div v-if="showDetailModal" class="modal-mask" @click.self="closeDetail">
      <div class="modal-card detail-modal">
        <div v-if="!detailListing" class="empty-card">
          <div class="empty-icon">⏳</div>
          <div class="empty-text">載入中...</div>
        </div>

        <template v-else>
          <div class="modal-header">
            <div>
              <div class="modal-title">📦 {{ detailListing.itemName }}</div>
              <div class="modal-sub">
                <span class="type-badge" :class="detailListing.listingType === 'BIDDING' ? 'badge-bid' : 'badge-fixed'">
                  {{ detailListing.listingType === 'BIDDING' ? '🎯 競標' : '💰 固定價' }}
                </span>
                <span class="status-chip" :class="`status-${detailListing.status.toLowerCase()}`">
                  {{ statusLabel(detailListing.status) }}
                </span>
              </div>
            </div>
            <button class="close-x" @click="closeDetail">✕</button>
          </div>

          <div class="modal-body">
            <div class="detail-info">
              <div class="info-card">
                <span class="info-label">賣家</span>
                <div class="info-val">👤 {{ detailListing.sellerName }}</div>
              </div>
              <div class="info-card price-info">
                <span class="info-label">
                  {{
                    detailListing.listingType === 'FIXED_PRICE'
                      ? '訂價'
                      : (detailListing.currentPrice ? '當前最高' : '起標價')
                  }}
                </span>
                <div class="big-price">
                  {{ priceLabel(detailListing) }}
                  <span class="big-price-curr">{{ detailListing.currency }}</span>
                </div>
              </div>
              <div class="info-card">
                <span class="info-label">期限</span>
                <div class="info-val">{{ formatRemain(detailListing.expireTime) }}</div>
              </div>
              <div v-if="detailListing.remark" class="info-card">
                <span class="info-label">備註</span>
                <div class="info-val remark-text">{{ detailListing.remark }}</div>
              </div>
            </div>

            <!-- 出價歷史 (BIDDING) -->
            <div v-if="detailListing.listingType === 'BIDDING'" class="bid-section">
              <div class="bid-section-h">出價紀錄 ({{ detailBids.length }})</div>
              <div v-if="detailBids.length === 0" class="bid-empty">
                還沒有人出價
              </div>
              <div v-else class="bid-list">
                <div
                  v-for="b in detailBids"
                  :key="b.id"
                  class="bid-row"
                  :class="{ top: b === detailBids[0] }"
                >
                  <div class="bid-name">
                    <span v-if="b === detailBids[0]" class="bid-crown">👑</span>
                    👤 {{ b.memberName }}
                  </div>
                  <div class="bid-price">
                    {{ formatPrice(b.biddingPrice) }} {{ b.currency }}
                  </div>
                  <div class="bid-time">{{ formatTime(b.joinTime) }}</div>
                  <button
                    v-if="detailIsMine && detailListing.status === 'OPEN'"
                    class="btn-pick"
                    @click="
                      selectBuyerForm.userName = b.memberName;
                      submitSelectBuyer(detailListing.listingCode)
                    "
                  >
                    選 TA
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <!-- 自己的單 -->
            <template v-if="detailIsMine && detailListing.status === 'OPEN'">
              <button class="btn-cancel-mod" @click="cancelListing(detailListing.listingCode)">
                撤單
              </button>
              <button class="btn-edit-mod" @click="onEdit(detailListing)">編輯</button>
            </template>

            <!-- 自己的單 + 待結帳 -->
            <template v-else-if="detailIsMine && detailListing.status === 'WAIT_PAY'">
              <button
                class="btn-confirm-wallet"
                :disabled="submitting"
                @click="confirmFromWallet(detailListing.listingCode)"
              >
                💳 錢包扣款
              </button>
              <button
                class="btn-confirm-game"
                :disabled="submitting"
                @click="confirmByGame(detailListing.listingCode)"
              >
                🎮 遊戲內付款
              </button>
            </template>

            <!-- 別人的單 + 固定價 + OPEN -->
            <template
              v-else-if="
                !detailIsMine &&
                detailListing.status === 'OPEN' &&
                detailListing.listingType === 'FIXED_PRICE'
              "
            >
              <button class="btn-cancel-mod" @click="closeDetail">關閉</button>
              <button
                class="btn-buy"
                :disabled="submitting"
                @click="openBuyModal(detailListing.currency)"
              >
                💰 立即購買
              </button>
            </template>

            <!-- 別人的單 + 競標 + OPEN -->
            <template
              v-else-if="
                !detailIsMine &&
                detailListing.status === 'OPEN' &&
                detailListing.listingType === 'BIDDING'
              "
            >
              <button class="btn-cancel-mod" @click="closeDetail">關閉</button>
              <button class="btn-bid" @click="openBidModal(detailListing)">🎯 我要出價</button>
            </template>

            <template v-else>
              <button class="btn-cancel-mod" @click="closeDetail">關閉</button>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- ============================================
         Modal: 開新掛單
         ============================================ -->
    <div v-if="showOpenModal" class="modal-mask" @click.self="showOpenModal = false">
      <div class="modal-card form-modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">📤 開新掛單</div>
            <div class="modal-sub-text">填寫資訊後送出,即可上架到市場</div>
          </div>
          <button class="close-x" @click="showOpenModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="field">
            <label>道具</label>
            <SearchableSelect
              v-model="openForm.itemId"
              :options="itemOptions"
              placeholder="選擇要掛賣的道具"
            />
            <div v-if="itemOptions.length === 0" class="field-hint warn">
              ⚠ 你的道具庫是空的,先到「📦 道具庫」建立一個
            </div>
          </div>

          <div class="field">
            <label>掛單類型</label>
            <div class="seg-toggle">
              <button
                type="button"
                :class="{ active: openForm.type === 0 }"
                @click="openForm.type = 0"
              >
                💰 固定價
              </button>
              <button
                type="button"
                :class="{ active: openForm.type === 1 }"
                @click="openForm.type = 1"
              >
                🎯 競標
              </button>
            </div>
          </div>

          <div class="field">
            <label>{{ openForm.type === 0 ? '訂價' : '起標價' }}</label>
            <input
              v-model="openForm.price"
              type="number"
              inputmode="decimal"
              placeholder="輸入金額"
              class="text-input"
            />
          </div>

          <div class="field">
            <label>幣別</label>
            <SearchableSelect
              v-model="openForm.currency"
              :options="currencyOptions"
              placeholder="選擇幣別"
            />
          </div>

          <div class="field">
            <label>
              期限 (分鐘)
              <span class="field-required" v-if="openForm.type === 1">必填</span>
              <span class="field-optional" v-else>選填,留空表示不限期</span>
            </label>
            <input
              v-model="openForm.durationMins"
              type="number"
              inputmode="numeric"
              placeholder="例如 60 = 1 小時 / 1440 = 1 天"
              class="text-input"
            />
          </div>

          <div class="field">
            <label>備註 (選填)</label>
            <textarea
              v-model="openForm.remark"
              rows="3"
              placeholder="例如:可面交、限會員購買..."
              class="text-input"
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel-mod" @click="showOpenModal = false">取消</button>
          <button
            class="btn-confirm-mod"
            :disabled="submitting"
            @click="submitOpenListing"
          >
            {{ submitting ? '送出中…' : '上架' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================
         Modal: 編輯掛單
         ============================================ -->
    <div v-if="showEditModal" class="modal-mask" @click.self="showEditModal = false">
      <div class="modal-card form-modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">✏️ 編輯掛單</div>
            <div class="modal-sub-text">
              {{ editForm.onlyRemark ? '已有人出價,只能修改備註' : '修改價格、幣別、期限或備註' }}
            </div>
          </div>
          <button class="close-x" @click="showEditModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="field" v-if="!editForm.onlyRemark">
            <label>價格</label>
            <input
              v-model="editForm.price"
              type="number"
              inputmode="decimal"
              class="text-input"
            />
          </div>

          <div class="field" v-if="!editForm.onlyRemark">
            <label>幣別</label>
            <SearchableSelect
              v-model="editForm.currency"
              :options="currencyOptions"
              placeholder="選擇幣別"
            />
          </div>

          <div class="field" v-if="!editForm.onlyRemark">
            <label>期限 (分鐘,留空不改)</label>
            <input
              v-model="editForm.durationMins"
              type="number"
              inputmode="numeric"
              class="text-input"
            />
          </div>

          <div class="field">
            <label>備註</label>
            <textarea
              v-model="editForm.remark"
              rows="3"
              class="text-input"
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel-mod" @click="showEditModal = false">取消</button>
          <button class="btn-confirm-mod" :disabled="submitting" @click="submitEditListing">
            {{ submitting ? '更新中…' : '儲存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================
         Modal: 建立道具
         ============================================ -->
    <div
      v-if="showCreateItemModal"
      class="modal-mask"
      @click.self="showCreateItemModal = false"
    >
      <div class="modal-card form-modal small-modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">📦 新增道具</div>
            <div class="modal-sub-text">建立後即可拿來開掛單</div>
          </div>
          <button class="close-x" @click="showCreateItemModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="field">
            <label>道具名稱</label>
            <input
              v-model="createItemForm.itemName"
              type="text"
              placeholder="例如:龍之鑽石"
              class="text-input"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel-mod" @click="showCreateItemModal = false">取消</button>
          <button class="btn-confirm-mod" :disabled="submitting" @click="submitCreateItem">
            {{ submitting ? '建立中…' : '建立' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================
         Modal: 出價
         ============================================ -->
    <div v-if="showBidModal && detailListing" class="modal-mask" @click.self="showBidModal = false">
      <div class="modal-card form-modal small-modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">🎯 出價</div>
            <div class="modal-sub-text">{{ detailListing.itemName }}</div>
          </div>
          <button class="close-x" @click="showBidModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="bid-current">
            目前最高:
            <strong>
              {{
                formatPrice(detailListing.currentPrice ?? detailListing.startPrice)
              }}
              {{ detailListing.currency }}
            </strong>
          </div>

          <div class="field">
            <label>出價金額</label>
            <input
              v-model="bidForm.price"
              type="number"
              inputmode="decimal"
              placeholder="必須高於目前最高"
              class="text-input"
            />
          </div>

          <div class="field">
            <label>使用幣別</label>
            <SearchableSelect
              v-model="bidForm.currency"
              :options="myWalletOptions.length > 0 ? myWalletOptions : currencyOptions"
              placeholder="選擇幣別"
            />
            <div class="field-hint">幣別不同時系統會自動換算</div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel-mod" @click="showBidModal = false">取消</button>
          <button
            class="btn-confirm-mod"
            :disabled="submitting"
            @click="submitBid(detailListing.listingCode)"
          >
            {{ submitting ? '送出中…' : '送出出價' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================
         Modal: 立刻買 (固定價選付款幣別)
         ============================================ -->
    <div v-if="showBuyModal && detailListing" class="modal-mask" @click.self="showBuyModal = false">
      <div class="modal-card form-modal small-modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">💰 立即購買</div>
            <div class="modal-sub-text">{{ detailListing.itemName }}</div>
          </div>
          <button class="close-x" @click="showBuyModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="buy-summary">
            售價: <strong>{{ formatPrice(detailListing.fixedPrice) }} {{ detailListing.currency }}</strong>
          </div>

          <div class="field">
            <label>使用幣別付款</label>
            <SearchableSelect
              v-model="buyForm.currency"
              :options="myWalletOptions.length > 0 ? myWalletOptions : currencyOptions"
              placeholder="選擇付款幣別"
            />
            <div class="field-hint">
              幣別不同時系統會用公會匯率換算,送出後系統會試圖凍結你的餘額,
              <br />等賣家確認後才會真正扣款
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel-mod" @click="showBuyModal = false">取消</button>
          <button
            class="btn-confirm-mod"
            :disabled="submitting"
            @click="submitBuy(detailListing.listingCode)"
          >
            {{ submitting ? '送出中…' : '確認購買' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================
         Modal: 結標選人 (BIDDING 自選)
         ============================================ -->
    <div
      v-if="showSelectBuyerModal && detailListing"
      class="modal-mask"
      @click.self="showSelectBuyerModal = false"
    >
      <div class="modal-card form-modal small-modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">🏆 結標選人</div>
            <div class="modal-sub-text">指定一位出價者為得標人</div>
          </div>
          <button class="close-x" @click="showSelectBuyerModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="field">
            <label>得標者</label>
            <div class="bid-pick-list" v-if="detailHasBids">
              <button
                v-for="b in detailBids"
                :key="b.id"
                type="button"
                class="bid-pick-item"
                :class="{ active: selectBuyerForm.userName === b.memberName }"
                @click="selectBuyerForm.userName = b.memberName"
              >
                <span class="bid-pick-name">👤 {{ b.memberName }}</span>
                <span class="bid-pick-price">
                  {{ formatPrice(b.biddingPrice) }} {{ b.currency }}
                </span>
              </button>
            </div>
            <div v-else class="field-hint warn">沒有任何人出價,無法結標</div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel-mod" @click="showSelectBuyerModal = false">取消</button>
          <button
            class="btn-confirm-mod"
            :disabled="submitting || !selectBuyerForm.userName"
            @click="submitSelectBuyer(detailListing.listingCode)"
          >
            {{ submitting ? '結標中…' : '確認結標' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== Page Layout ===== */
.pm-page {
  padding: 24px;
  color: #e2e8f0;
  min-height: 100vh;
}

/* ===== Header ===== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.header-icon {
  font-size: 2.2rem;
  filter: drop-shadow(0 0 8px rgba(var(--c-light-rgb), 0.6));
}
.page-title {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  color: var(--c-light);
  text-shadow:
    0 0 6px rgba(var(--c-light-rgb), 0.45),
    0 0 16px rgba(var(--c-deep-rgb), 0.35);
}
.page-sub {
  font-size: 0.78rem;
  color: #64748b;
  margin: 2px 0 0;
}
.btn-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 20px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  font-size: 0.9rem;
  line-height: 1;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(var(--c-deep-rgb), 0.3);
  box-sizing: border-box;
}
.btn-add:hover {
  filter: brightness(1.08);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(var(--c-deep-rgb), 0.45);
}

/* ===== Stats Row ===== */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  padding: 14px 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  overflow: hidden;
}
.stat-card.flash::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at top right,
    rgba(var(--c-deep-rgb), 0.18),
    transparent 70%
  );
  pointer-events: none;
}
.stat-label {
  font-size: 0.72rem;
  color: #94a3b8;
  letter-spacing: 0.4px;
}
.stat-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: #f1f5f9;
}
.stat-value.gold {
  color: var(--c-light);
}
.stat-value.warn {
  color: #f87171;
}
.stat-value.buy {
  color: #a5b4fc;
}

/* ===== Tabs ===== */
.seg-tabs {
  display: flex;
  align-items: center;
  height: 48px;
  background-color: #14161f;
  padding: 4px;
  border-radius: 10px;
  margin-bottom: 16px;
  gap: 4px;
  border: 1px solid #24263a;
  box-sizing: border-box;
  overflow: hidden;
}
.seg-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 38px;        /* 48 - 8 padding - 2 border = 38, 完全填滿 */
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: 7px;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  box-sizing: border-box;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
}
.seg-btn:hover {
  color: #fff;
}
.seg-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
}

/* ===== Sub Tabs (我的交易內部分頁) ===== */
.sub-tabs {
  display: flex;
  align-items: center;
  height: 42px;
  background-color: #14161f;
  padding: 4px;
  border-radius: 9px;
  gap: 4px;
  margin-bottom: 16px;
  border: 1px solid #24263a;
  box-sizing: border-box;
  overflow: hidden;
}
.sub-tab-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 32px;       /* 42 - 8 padding - 2 border = 32, 完全填滿 */
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
}
.sub-tab-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.04);
}
.sub-tab-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
}
.sub-tab-btn.active:hover {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
}
.sub-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: rgba(var(--c-deep-rgb), 0.18);
  color: var(--c-light);
  border: 1px solid rgba(var(--c-deep-rgb), 0.4);
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
}
.sub-tab-btn.active .sub-tab-badge {
  background: rgba(15, 17, 26, 0.25);
  color: var(--c-on);
  border-color: rgba(15, 17, 26, 0.4);
}

/* ===== Toolbar ===== */
.toolbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
  margin-bottom: 16px;
}
.search-input {
  width: 100%;
  height: 40px;
  padding: 0 14px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  color: #fff;
  font-size: 0.92rem;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.search-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.type-chips {
  display: flex;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 34px;
  padding: 0 14px;
  background: #14161f;
  border: 1px solid #2e3147;
  border-radius: 999px;
  color: #94a3b8;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  box-sizing: border-box;
}
.chip:hover {
  border-color: #3a3f5c;
  color: #e2e8f0;
}
.chip.active {
  background: rgba(var(--c-light-rgb), 0.14);
  border-color: var(--c-light);
  color: var(--c-light);
}

/* ===== Empty Card ===== */
.empty-card {
  background: rgba(22, 24, 34, 0.6);
  border: 1px dashed #24263a;
  padding: 60px 20px;
  border-radius: 12px;
  text-align: center;
  margin-bottom: 16px;
}
.empty-icon {
  font-size: 2.4rem;
  margin-bottom: 8px;
  filter: grayscale(0.3);
}
.empty-text {
  color: #64748b;
  font-size: 0.92rem;
}

/* ===== Listing Cards (Market) ===== */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.listing-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.18s;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.listing-card:hover {
  border-color: rgba(var(--c-light-rgb), 0.4);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}
.listing-card.bidding {
  border-top: 3px solid #a855f7;
}
.listing-card.mine {
  border-color: rgba(var(--c-light-rgb), 0.4);
  background: linear-gradient(180deg, rgba(var(--c-light-rgb), 0.08) 0%, rgba(22, 24, 34, 0.95) 100%);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.card-item-name {
  font-size: 1rem;
  font-weight: 700;
  color: #f1f5f9;
  flex: 1;
  min-width: 0;
  word-break: break-word;
}
.type-badge {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}
.badge-fixed {
  background: rgba(var(--c-light-rgb), 0.16);
  color: var(--c-light);
  border: 1px solid rgba(var(--c-light-rgb), 0.3);
}
.badge-bid {
  background: rgba(168, 85, 247, 0.18);
  color: #d8b4fe;
  border: 1px solid rgba(168, 85, 247, 0.4);
}
.card-price-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.price-num {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--c-light);
  text-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.35);
}
.price-curr {
  font-size: 0.85rem;
  color: var(--c-deep);
  font-weight: 700;
}
.price-caption {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: -4px;
}
.card-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.78rem;
  color: #94a3b8;
  flex-wrap: wrap;
}
.meta-item {
  white-space: nowrap;
}
.meta-item.urgent {
  color: #f87171;
}
.card-remark {
  font-size: 0.75rem;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.03);
  padding: 6px 10px;
  border-radius: 6px;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
  white-space: pre-wrap;
}
.mine-tag {
  position: absolute;
  top: -8px;
  right: 12px;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  letter-spacing: 0.5px;
}

/* ===== My Listings ===== */
.section-h {
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
  margin: 24px 0 10px;
  letter-spacing: 0.4px;
}
.section-h:first-child {
  margin-top: 0;
}
.my-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.my-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.my-card.waitpay {
  border-color: rgba(239, 68, 68, 0.5);
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.08) 0%, rgba(22, 24, 34, 0.95) 100%);
}
.my-card.history {
  opacity: 0.78;
}
.my-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.my-name {
  font-size: 0.98rem;
  font-weight: 700;
  color: #f1f5f9;
}
.status-chip {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}
.status-open {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.3);
}
.status-waitpay {
  background: rgba(239, 68, 68, 0.18);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
  animation: pulse-warn 2s infinite;
}
.status-completed {
  background: rgba(var(--c-light-rgb), 0.16);
  color: #a5b4fc;
  border: 1px solid rgba(var(--c-light-rgb), 0.3);
}
.status-canceled {
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.3);
}
.status-expired {
  background: rgba(239, 68, 68, 0.14);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
@keyframes pulse-warn {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}
.my-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.my-info-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  gap: 8px;
}
.info-label {
  color: #64748b;
  font-size: 0.78rem;
}
.info-val {
  color: #e2e8f0;
  font-weight: 600;
}
.info-val.gold {
  color: var(--c-light);
}
.warn-text {
  font-size: 0.78rem;
  color: #f87171;
}
.my-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.my-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 12px;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1;
  border-radius: 7px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  box-sizing: border-box;
}
.btn-secondary-sm {
  background: #2a2d3e;
  color: #e2e8f0;
}
.btn-secondary-sm:hover {
  background: #3a3f5c;
}
.btn-edit-sm {
  background: rgba(var(--c-light-rgb), 0.18);
  color: #a5b4fc;
  border: 1px solid rgba(var(--c-light-rgb), 0.4) !important;
}
.btn-edit-sm:hover {
  background: rgba(var(--c-light-rgb), 0.3);
}
.btn-danger-sm {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.4) !important;
}
.btn-danger-sm:hover {
  background: rgba(239, 68, 68, 0.3);
}
.btn-finalize {
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #fff;
}
.btn-bid-sm {
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #fff;
}
.btn-bid-sm:hover {
  filter: brightness(1.08);
}
.btn-confirm-wallet {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
}
.btn-confirm-wallet:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(0.6);
}
.btn-confirm-game {
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.4) !important;
}
.btn-confirm-game:hover {
  background: rgba(34, 197, 94, 0.3);
}

/* ===== Item Library ===== */
.items-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.items-hint {
  font-size: 0.82rem;
  color: #94a3b8;
}
.btn-add-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 16px;
  background: rgba(var(--c-light-rgb), 0.16);
  border: 1px solid rgba(var(--c-light-rgb), 0.4);
  color: #a5b4fc;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  box-sizing: border-box;
}
.btn-add-secondary:hover {
  background: rgba(var(--c-light-rgb), 0.28);
}
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.item-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.item-icon-wrap {
  font-size: 1.6rem;
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px rgba(var(--c-light-rgb), 0.4));
}
.item-content {
  flex: 1;
  min-width: 0;
}
.item-name-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 2px;
  word-break: break-word;
}
.item-meta {
  font-size: 0.7rem;
  color: #64748b;
}

/* ===== Modals ===== */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
}
.modal-card {
  background: rgba(22, 24, 34, 0.98);
  border: 1px solid #2e3147;
  border-radius: 16px;
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
}
.detail-modal {
  max-width: 600px;
}
.form-modal {
  max-width: 480px;
}
.small-modal {
  max-width: 420px;
}
.modal-header {
  padding: 18px 20px;
  border-bottom: 1px solid #2e3147;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.modal-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--c-light);
}
.modal-sub-text {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-top: 4px;
}
.modal-sub {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.close-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex-shrink: 0;
  box-sizing: border-box;
}
.close-x:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}
.modal-body {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid #2e3147;
  display: flex;
  align-items: stretch;
  gap: 10px;
  background: rgba(15, 17, 26, 0.5);
}
.modal-footer button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 9px;
  border: none;
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  box-sizing: border-box;
}
.btn-cancel-mod {
  background: transparent;
  border: 1px solid #2e3147 !important;
  color: #94a3b8;
}
.btn-cancel-mod:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
}
.btn-confirm-mod {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
}
.btn-confirm-mod:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}
.btn-confirm-mod:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-edit-mod {
  background: rgba(var(--c-light-rgb), 0.2);
  color: #a5b4fc;
  border: 1px solid rgba(var(--c-light-rgb), 0.4) !important;
}
.btn-buy {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
}
.btn-bid {
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #fff;
  font-weight: 800;
}

/* ===== Detail Info ===== */
.detail-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.info-card {
  background: #0f111a;
  border: 1px solid #24263a;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-card.price-info {
  grid-column: 1 / -1;
  border-color: rgba(var(--c-light-rgb), 0.3);
  background: linear-gradient(180deg, #0f111a 0%, #1a1d2e 100%);
}
.big-price {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--c-light);
  text-shadow: 0 0 10px rgba(var(--c-light-rgb), 0.4);
}
.big-price-curr {
  font-size: 0.92rem;
  color: var(--c-deep);
  margin-left: 4px;
}
.remark-text {
  font-size: 0.85rem;
  color: #cbd5e1;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* ===== Bid Section ===== */
.bid-section {
  background: #0f111a;
  border: 1px solid #24263a;
  border-radius: 10px;
  padding: 14px;
}
.bid-section-h {
  font-size: 0.88rem;
  font-weight: 700;
  color: #d8b4fe;
  margin-bottom: 10px;
}
.bid-empty {
  text-align: center;
  padding: 20px;
  color: #64748b;
  font-size: 0.85rem;
}
.bid-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}
.bid-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 7px;
  font-size: 0.82rem;
}
.bid-row.top {
  background: rgba(168, 85, 247, 0.12);
  border: 1px solid rgba(168, 85, 247, 0.3);
}
.bid-name {
  color: #e2e8f0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.bid-crown {
  font-size: 0.9rem;
}
.bid-price {
  color: var(--c-light);
  font-weight: 700;
  white-space: nowrap;
}
.bid-time {
  color: #64748b;
  font-size: 0.72rem;
  white-space: nowrap;
}
.btn-pick {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  border: none;
  color: #fff;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  box-sizing: border-box;
}
.btn-pick:hover {
  filter: brightness(1.1);
}

/* ===== Form Fields ===== */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 0.82rem;
  color: #e2e8f0;
  font-weight: 600;
  display: flex;
  gap: 8px;
  align-items: center;
}
.field-required {
  font-size: 0.7rem;
  color: #f87171;
  background: rgba(239, 68, 68, 0.12);
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 700;
}
.field-optional {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 500;
}
.field-hint {
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.4;
}
.field-hint.warn {
  color: #f87171;
}
.text-input {
  width: 100%;
  padding: 10px 12px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 9px;
  color: #fff;
  font-size: 0.92rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.text-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
textarea.text-input {
  resize: vertical;
  min-height: 70px;
}
.seg-toggle {
  display: flex;
  align-items: center;
  height: 44px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 9px;
  padding: 3px;
  gap: 3px;
  box-sizing: border-box;
  overflow: hidden;
}
.seg-toggle button {
  flex: 1 1 0;
  min-width: 0;
  height: 36px;       /* 44 - 6 padding - 2 border = 36, 完全填滿 */
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  box-sizing: border-box;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
}
.seg-toggle button.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
}

/* ===== Bid / Buy Modal ===== */
.bid-current,
.buy-summary {
  padding: 12px 14px;
  background: rgba(var(--c-light-rgb), 0.08);
  border: 1px solid rgba(var(--c-light-rgb), 0.25);
  border-radius: 9px;
  font-size: 0.88rem;
  color: #e2e8f0;
}
.buy-summary strong,
.bid-current strong {
  color: var(--c-light);
  font-weight: 800;
}

/* ===== Pick Buyer ===== */
.bid-pick-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
}
.bid-pick-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 14px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  font-family: inherit;
  box-sizing: border-box;
}
.bid-pick-item:hover {
  border-color: #3a3f5c;
}
.bid-pick-item.active {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.1);
}
.bid-pick-name {
  color: #e2e8f0;
  font-weight: 600;
  font-size: 0.9rem;
}
.bid-pick-price {
  color: var(--c-light);
  font-weight: 700;
  font-size: 0.88rem;
}

/* ===== RWD ===== */
@media (max-width: 768px) {
  .pm-page { padding: 16px 12px; }
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .stat-card { padding: 10px 12px; }
  .stat-value { font-size: 1.3rem; }
  .card-grid { grid-template-columns: 1fr; }
  .detail-info { grid-template-columns: 1fr; }
  .bid-row {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'name price'
      'time pick';
  }
  .bid-name { grid-area: name; }
  .bid-price { grid-area: price; }
  .bid-time { grid-area: time; }
  .btn-pick { grid-area: pick; }
}
</style>
