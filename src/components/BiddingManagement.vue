<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuction } from '@/composables/BiddingManageMent.ts'
import SearchableSelect from '@/components/SearchableSelect.vue'
import RemarkPickerModal from '@/components/RemarkPickerModal.vue'
import { REMARK_WAREHOUSE } from '@/composables/remarkOptions.ts'

// 手機卡片展開狀態
const expandedCards = ref<Set<string>>(new Set())
function toggleExpand(code: string) {
  const next = new Set(expandedCards.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  expandedCards.value = next
}
function isExpanded(code: string): boolean {
  return expandedCards.value.has(code)
}

const {
  auctions,
  formatTime,
  handleStatus,
  handleSubmit,
  groupedAuctionsList,
  submitRemark,
  handleDeleteItem,
  canSubmit,
  showPeopleList,
  getJoinList,
  formatTimestamp,
  handleSubmitFromWallet,
  handlePeopleClick,
  authStore,
  handlePeopleCount,
  submitAssign,
  showAssignModal,
  selectedMemberId,
  handleStorageChange,
  selectedTreasure,
  showDiceModal,
  diceLoading,
  diceAnimating,
  diceTreasure,
  diceRoundLabel,
  diceVisibleRolls,
  diceWinnerName,
  diceFinalPrice,
  diceCurrency,
  diceDone,
  openDiceAssign,
  closeDiceModal,
} = useAuction()

// 標示「自己尚未繳交」的單子 — 開單者是我且備註不是已繳倉庫
const myName = computed(() => authStore.member?.userName ?? '')
function isMyUnsubmitted(item: { ticketOwerName?: string; remark?: string }) {
  return (
    !!myName.value &&
    item.ticketOwerName === myName.value &&
    (item.remark || '').trim() !== REMARK_WAREHOUSE
  )
}

// 備註選項彈窗
type AuctionItem = (typeof auctions.value)[number]
const showRemarkPicker = ref(false)
const remarkTarget = ref<AuctionItem | null>(null)
function openRemarkPicker(item: AuctionItem) {
  remarkTarget.value = item
  showRemarkPicker.value = true
}
function onRemarkConfirm(value: string) {
  if (remarkTarget.value) submitRemark(remarkTarget.value, value)
}

// === WS 推送即時動畫 (必須在 useAuction() 之後,否則 auctions TDZ) ===
const recentlyUpdated = ref<Set<string>>(new Set())
const liveTick = ref(0)
const lastSnapshot = new Map<string, string>()

interface AuctionRow {
  treasureCode: string
  currentPrice?: number
  biddingName?: string
  biddingMemberContent?: string
  status?: string
}
const snapshotOf = (a: AuctionRow): string =>
  `${a.currentPrice ?? ''}|${a.biddingName ?? ''}|${a.biddingMemberContent ?? ''}|${a.status ?? ''}`

watch(
  () => (auctions.value as AuctionRow[]).map((a) => snapshotOf(a)).join('§'),
  () => {
    let anyChanged = false
    for (const a of auctions.value as AuctionRow[]) {
      const code = a.treasureCode
      const curr = snapshotOf(a)
      const prev = lastSnapshot.get(code)
      if (prev !== undefined && prev !== curr) {
        anyChanged = true
        const next = new Set(recentlyUpdated.value)
        next.add(code)
        recentlyUpdated.value = next
        setTimeout(() => {
          const after = new Set(recentlyUpdated.value)
          after.delete(code)
          recentlyUpdated.value = after
        }, 1400)
      }
      lastSnapshot.set(code, curr)
    }
    if (anyChanged) liveTick.value++
  },
  { immediate: true },
)

interface GroupItem {
  treasureCode: string
  itemName: string
  currency: string
  currentPrice: number
  biddingName: string
}

const summaryTotals = (items: GroupItem[]) => {
  const totals: Record<string, number> = {}
  for (const it of items) {
    if (!it.currentPrice || !it.currency) continue
    totals[it.currency] = (totals[it.currency] || 0) + Number(it.currentPrice)
  }
  return totals
}

const itemNameCounts = (items: GroupItem[]) => {
  const counts: Record<string, number> = {}
  for (const it of items) {
    counts[it.itemName] = (counts[it.itemName] || 0) + 1
  }
  return Object.entries(counts).map(([name, count]) => ({ name, count }))
}

const isAssigned = (title: string) => !title.includes('尚未分配')
// 「尚未分配」群組是管理員必看的審核工作,需置頂 + 永遠展開 + 醒目樣式
const isUrgent = (title: string) => title.includes('尚未分配')

// === 折疊式 group + 搜尋 ===
// 預設「全部摺疊」(待結算多人時逐個展開查看才不會一次看到滿屏資訊)
// 紀錄哪些被「展開」(預設空集合 = 全摺起)
const expandedGroups = ref<Set<string>>(new Set())
function toggleGroup(title: string) {
  // 「尚未分配」一律保持展開 (管理員必看),不允許折疊
  if (isUrgent(title)) return
  const next = new Set(expandedGroups.value)
  if (next.has(title)) next.delete(title)
  else next.add(title)
  expandedGroups.value = next
}
function isGroupExpanded(title: string): boolean {
  // 「尚未分配」永遠視為展開
  if (isUrgent(title)) return true
  return expandedGroups.value.has(title)
}

// 搜尋過濾 (依得標人姓名/group title)
const filterUser = ref<string>('')
const userOptions = computed(() => {
  const list = groupedAuctionsList.value ?? []
  return list.map((g) => ({
    value: g.title,
    label: `${g.title} (${(g.items ?? []).length})`,
  }))
})
const filteredGroups = computed(() => {
  const list = groupedAuctionsList.value ?? []
  const filtered = filterUser.value
    ? list.filter((g) => g.title === filterUser.value)
    : list
  // 「尚未分配」永遠排第一,讓管理員不用滾去找
  return [...filtered].sort((a, b) => {
    if (isUrgent(a.title)) return -1
    if (isUrgent(b.title)) return 1
    return 0
  })
})
function clearFilter() {
  filterUser.value = ''
}
</script>

<template>
  <div class="whole_page">
    <div class="dash-card-head">
      <h3>待分配單 共 {{ auctions.length }} 件待分配道具</h3>
      <span class="live-dot" :class="{ 'is-pulsing': liveTick > 0 }" :key="liveTick" title="即時連線中" aria-hidden="true"></span>
      <div class="tooltip-wrapper">
        <font-awesome-icon :icon="['far', 'circle-question']" class="info-icon" />
        <div class="tooltip-content">
          <strong>📋 待分配區作業須知</strong>
          1. <b>狀態轉換：</b>物品一旦有人標中，競標單將自動轉為「待分配單」。<br />
          2. <b>得標判定：</b>若有複數出價者，管理員可手動指定得標人，或由系統自動判定。<br />
          3. <b>收款方式：</b>管理員可依情況選擇「帳戶餘額扣款」或「遊戲內直接取款」。<br />
          4. <b>分紅結算：</b>管理員截標後，系統將依設定比例發放分紅予參與成員，並提撥公積金。<br />
          5. <b>物品交付：</b>確認收到款項後，請管理員務必將結案物品確實交付予得標人。
        </div>
      </div>
    </div>

    <!-- 搜尋: SearchableSelect 直接當 flex child,避免中間 wrapper 造成對齊偏差
         抄 .balance-row 的「兩個結構對等的 children」pattern -->
    <div v-if="userOptions.length > 0" class="bm-search-row">
      <SearchableSelect
        v-model="filterUser"
        :options="userOptions"
        placeholder="🔍 搜尋得標人..."
        class="bm-search-input"
      />
      <button
        v-if="filterUser"
        type="button"
        class="bm-clear-btn"
        title="清除"
        aria-label="清除"
        @click="clearFilter"
      >
        ✕
      </button>
    </div>

    <div class="auction-container">
      <div
        v-for="group in filteredGroups"
        :key="group.title"
        class="group-wrapper"
        :class="{
          'is-expanded': isGroupExpanded(group.title),
          'is-urgent': isUrgent(group.title),
        }"
      >
        <div
          class="group-head"
          :class="{ 'is-urgent-head': isUrgent(group.title) }"
          @click="toggleGroup(group.title)"
          :role="isUrgent(group.title) ? 'heading' : 'button'"
          :tabindex="isUrgent(group.title) ? -1 : 0"
        >
          <h4 class="group-title">
            <span v-if="isUrgent(group.title)" class="urgent-icon" aria-hidden="true">🚨</span>
            <span v-else class="group-chevron">▾</span>
            {{ isUrgent(group.title) ? '待審核分配 — 請管理員處理' : group.title }}
          </h4>
          <div v-if="isAssigned(group.title)" class="group-summary">
            <span class="sum-count">共 {{ (group.items ?? []).length }} 件</span>
            <span
              v-for="(amt, ccy) in summaryTotals((group.items ?? []) as GroupItem[])"
              :key="String(ccy)"
              class="sum-amount"
            >
              {{ ccy }}<span class="sum-amount-num">{{ amt.toLocaleString() }}</span>
            </span>
          </div>
          <div v-else class="group-summary urgent-summary">
            <span class="urgent-badge">⚠️ {{ (group.items ?? []).length }} 件等待審核</span>
          </div>
        </div>

        <!-- 折疊容器 - 用 CSS grid-template-rows 0fr↔1fr trick 做絲滑 height 動畫 -->
        <div class="collapse-wrap">
          <div class="collapse-inner">
            <div v-if="isAssigned(group.title)" class="group-items-preview">
              <span
                v-for="entry in itemNameCounts((group.items ?? []) as GroupItem[])"
                :key="entry.name"
                class="item-chip"
                :title="entry.name"
              >
                {{ entry.name }}<span v-if="entry.count > 1" class="item-chip-count">×{{ entry.count }}</span>
              </span>
            </div>

            <div class="auction-grid">
          <div
            v-for="item in group.items"
            :key="item.treasureCode"
            class="auction-card"
            :class="{
              'is-expanded': isExpanded(item.treasureCode),
              'just-updated': recentlyUpdated.has(item.treasureCode),
              'mine-unsubmitted': isMyUnsubmitted(item),
            }"
          >
            <div class="card-tools">
              <button
                class="tool-btn remark"
                v-show="item.showDeleteTicket"
                @click="openRemarkPicker(item)"
                title="備註"
                aria-label="備註"
              >
                ✎
              </button>
              <button
                class="tool-btn delete"
                v-show="item.showDeleteTicket"
                @click="handleDeleteItem(item)"
                title="撤單"
                aria-label="撤單"
              >
                ✕
              </button>
            </div>

            <div class="item-main" :class="{ 'has-tools': item.showDeleteTicket }">
              <div class="item-name gold">{{ item.itemName }}</div>
              <div class="boss-name">頭目：{{ item.bossName }}</div>
            </div>

            <div class="divider"></div>

            <div class="info-section">
              <div class="info-row row-secondary">
                <span class="label">開單者</span>
                <span class="value">{{ item.ticketOwerName }}</span>
              </div>
              <div
                class="info-row row-secondary"
                v-for="c in item.treasureCurrencyList"
                :key="c.currency"
              >
                <span class="label">{{ c.currency }}價格</span
                ><span class="value">{{ Number(c.amount).toLocaleString() }}</span>
              </div>
              <div v-if="item.biddingName != '尚未有得標者'" class="info-row highlight">
                <span class="label">最終價格</span>
                <span class="value gold"
                  >{{ Number(item.currentPrice).toLocaleString() }} {{ item.currency }}</span
                >
              </div>
            </div>

            <!-- 競爭者清單 — 多人競標同一張時,讓所有會員清楚看見對手是誰 -->
            <div
              v-if="item.biddingMemberList && item.biddingMemberList.length > 1"
              class="competitors-section"
            >
              <div class="competitors-label">
                🎯 競爭名單 ({{ item.biddingMemberList.length }} 人爭奪中)
              </div>
              <div class="bidder-chips">
                <span
                  v-for="(m, idx) in item.biddingMemberList"
                  :key="`${item.treasureCode}-${m.userName}-${idx}`"
                  class="bidder-chip"
                  :class="{ 'is-me': m.userName === authStore.member?.userName }"
                >
                  {{ m.userName === authStore.member?.userName ? `🫵 你 (${m.userName})` : `👤 ${m.userName}` }}
                </span>
              </div>
              <div v-if="item.assignByLeader" class="competitors-hint">
                等待會長/幹部指定得標者
              </div>
            </div>

            <div class="bidder-section">
              <div class="info-row">
                <span class="label">得標者</span>
                <span class="value gold">{{ item.biddingName }}</span>
              </div>
              <div class="info-row row-secondary">
                <span class="label">備註</span>
                <span class="value-remark">{{ item.remark }}</span>
              </div>
              <div class="info-row row-secondary">
                <span class="label">確認存倉</span>
                <div
                  v-if="authStore.member?.role == 'LEADER' || authStore.member?.role == 'OFFICER'"
                  class="value-action"
                >
                  <input
                    type="checkbox"
                    v-model="item.checkFromRepository"
                    class="small-checkbox"
                    @change="handleStorageChange(item)"
                  />
                </div>
                <span v-else class="value-remark">{{
                  item.checkFromRepository ? '確認存倉' : '尚未存倉'
                }}</span>
              </div>
            </div>

            <button class="expand-toggle" @click="toggleExpand(item.treasureCode)">
              <span v-if="isExpanded(item.treasureCode)">收起細節 ⌃</span>
              <span v-else>展開細節 ⌄</span>
            </button>

            <div class="action-wrapper">
              <button
                class="submit-btn wallet-btn"
                v-if="item.canVerifyBiddingTicket && item.hasEnoughMoneyToBuy"
                :disabled="canSubmit(item)"
                @click="handleSubmitFromWallet(item)"
              >
                從錢包扣除並派發
              </button>
            </div>
            <button
              class="submit-btn"
              :class="{
                'btn-assign-gem': !item.isBidding && item.assignByLeader,
                'btn-verify-gem':
                  !item.isBidding && !item.assignByLeader && item.canVerifyBiddingTicket,
              }"
              :disabled="canSubmit(item)"
              @click="handleSubmit(item)"
            >
              <span v-if="item.isBidding">確認出價</span>
              <span v-else-if="item.disableSubmitButton">分配結束</span>
              <span v-else-if="item.assignByLeader">指定得標者</span>
              <span v-else-if="item.canVerifyBiddingTicket">取得帳款並派發獎金</span>
            </button>

            <!-- 手動分配模式(assignByLeader)才出現:讓系統骰點決定得標者 -->
            <button
              v-if="!item.isBidding && item.assignByLeader"
              class="submit-btn dice-btn"
              @click="openDiceAssign(item)"
            >
              🎲 由系統指定得標者
            </button>

            <div class="card-footer" @click="handlePeopleCount(item)">
              <span class="timer">⏳ {{ formatTime(item.remainSeconds) }}</span>
              <span class="people">👥 {{ item.treasureAttendanceList.length }}人</span>
              <span class="status-tag">{{ handleStatus(item.status) }}</span>
            </div>
          </div>
            </div><!-- /.auction-grid -->
          </div><!-- /.collapse-inner -->
        </div><!-- /.collapse-wrap -->
      </div><!-- /.group-wrapper -->
    </div>

    <div v-if="showPeopleList" class="show-people-list" @click.self="showPeopleList = false">
      <div class="boss-container">
        <h2 class="boss-title">參與名單</h2>
        <ul class="people-list">
          <li
            v-for="(data, index) in getJoinList()"
            :key="index"
            class="person-item"
            @click="handlePeopleClick(data)"
          >
            <div class="person-info">
              <span class="person-name">👤 {{ data.userName }}</span>
              <span class="join-time"> , {{ formatTimestamp(data.joinTime) }}</span>
            </div>
          </li>
        </ul>
        <button class="close-btn" @click="showPeopleList = false">關閉</button>
      </div>
    </div>

    <div class="modal-overlay" v-if="showAssignModal" @click.self="showAssignModal = false">
      <div class="boss-container assign-modal">
        <div class="boss-title">會長指定得標</div>
        <div class="target-item-info">
          道具：<span class="gold-class gold">{{ selectedTreasure?.itemName }}</span>
        </div>
        <div class="people-list">
          <div
            v-for="member in selectedTreasure?.biddingMemberList"
            :key="member.userName"
            class="person-item"
            :class="{ 'is-selected': selectedMemberId === member.userName }"
            @click="selectedMemberId = member.userName"
          >
            <div class="member-info">
              <span class="member-name">{{ member.userName }}</span>
              <span class="check-icon" v-if="selectedMemberId === member.userName">✔</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="confirm-btn" @click="submitAssign">確認得標</button>
          <button class="cancel-btn" @click="showAssignModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 系統骰點指定得標者 -->
    <div class="modal-overlay dice-overlay" v-if="showDiceModal" @click.self="closeDiceModal">
      <div class="boss-container dice-modal">
        <div class="dice-head">
          <div class="boss-title">🎲 系統骰點分配</div>
          <div class="dice-sub" v-if="diceTreasure">
            道具：<span class="gold">{{ diceTreasure.itemName }}</span>
          </div>
        </div>

        <div v-if="diceLoading" class="dice-loading">
          <div class="dice-spinner">🎲</div>
          <p>骰子準備中…</p>
        </div>

        <template v-else>
          <div class="dice-round-label">{{ diceRoundLabel }}</div>

          <div class="dice-arena">
            <div
              v-for="(r, i) in diceVisibleRolls"
              :key="i"
              class="dice-player"
              :class="{ 'is-top': r.isTop, 'is-winner': diceDone && r.isTop }"
            >
              <div class="dice-cube" :class="{ rolling: r.rolling }">
                <span>{{ r.rolling ? '🎲' : r.value }}</span>
              </div>
              <div class="dice-name">{{ r.userName }}</div>
            </div>
          </div>

          <transition name="dice-winner">
            <div v-if="diceDone" class="dice-result">
              <div class="dice-trophy">🏆</div>
              <div class="dice-winner-name">{{ diceWinnerName }} 得標！</div>
              <div class="dice-price">成交價 {{ Number(diceFinalPrice).toLocaleString() }} {{ diceCurrency }}</div>
              <p class="dice-note">已指定得標者並凍結金額，請再到「取得帳款並派發獎金」完成分紅。</p>
            </div>
          </transition>

          <button
            class="close-btn dice-close"
            :disabled="diceAnimating"
            @click="closeDiceModal"
          >
            {{ diceAnimating ? '骰點中…' : '關閉' }}
          </button>
        </template>
      </div>
    </div>

    <RemarkPickerModal
      v-model="showRemarkPicker"
      :current="remarkTarget?.remark"
      @confirm="onRemarkConfirm"
    />
  </div>
</template>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
  cursor: help;
}

.info-icon {
  color: #999;
  transition: all 0.2s; /* 讓大小變化也能有過渡效果 */

  /* 調整大小 */
  font-size: 20px; /* 你可以設定 px, rem 或 em */
  cursor: pointer;

  /* 如果覺得圖示跟文字沒對齊，可以加這個 */
  vertical-align: middle;
}

.info-icon:hover {
  color: #4a90e2;
  transform: scale(1.1); /* 額外小技巧：滑鼠移上去稍微放大 1.1 倍，動感更強 */
}

/* 提示框本體 */
.tooltip-content {
  visibility: hidden;
  width: 350px; /* 增加寬度，文字才不會擠在一起 */
  background-color: rgba(15, 15, 15, 0.95); /* 稍微加深背景色增加對比 */
  color: #fff;
  text-align: left;
  padding: 15px; /* 增加內距，讓文字有呼吸空間 */
  border-radius: 8px; /* 圓角加大一點點，看起來更現代 */

  /* 關鍵字體調整 */
  font-size: 15px; /* 放大字體 */
  line-height: 1.7; /* 增加行高，閱讀長文案才不吃力 */
  font-weight: normal;
  letter-spacing: 0.5px; /* 微調字距 */

  /* 定位 */
  position: absolute;
  bottom: 140%; /* 調整距離問號的高度 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 999; /* 確保在最上層 */

  /* 動畫 */
  opacity: 0;
  transition: all 0.3s ease;
  pointer-events: none; /* 防止滑鼠滑進去提示框時閃爍 */
  border: 1px solid #444; /* 加一個細邊框，更有質感 */
}

/* 小箭頭 */
.tooltip-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -8px; /* 箭頭加大一點點 */
  border-width: 8px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent;
}
.tooltip-content strong {
  color: var(--c-light); /* 給標題一個顯眼的顏色，例如金色 */
  font-size: 17px; /* 標題再大一點 */
  display: block;
  margin-bottom: 8px;
}

/* 滑鼠移入 wrapper 時顯示 content */
.tooltip-wrapper:hover .tooltip-content {
  visibility: visible;
  opacity: 1;
  transform: translateX(-50%) translateY(-5px); /* 向上浮動的效果 */
}

/* -------------------------------------- */
/* 新增：群組標題相關樣式 (加在原本 CSS 的最上方) */
/* -------------------------------------- */
/* === 搜尋欄 — 暴力對齊版 ===
   兩個 flex children 都明確 height 44px,vertical-align top + 強制 :deep 內側 trigger */
.bm-search-row {
  display: flex;
  align-items: flex-start; /* 兩 child 都從頂部 y=0 開始,不依賴 stretch 計算 */
  gap: 10px;
  margin-bottom: 16px;
}
.bm-search-input {
  flex: 1;
  min-width: 0;
  max-width: 360px;
  height: 38px; /* 強制 .ss-select 根高度 (跟手機同大小,視覺更精簡) */
  display: block;
  vertical-align: top;
}
/* :deep 強制 SearchableSelect 內部 .ss-trigger 也 38px 滿版 */
.bm-search-input :deep(.ss-trigger) {
  height: 38px !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}
/* 清除鈕 — icon-only 38x38 方塊,PC / 手機共用 (使用者覺得有「清除」文字版太大) */
.bm-clear-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;                       /* = .bm-search-input height,絕對對齊 */
  margin: 0;
  padding: 0;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 9px;
  color: #cbd5e1;
  font-size: 0.95rem;
  font-weight: 700;
  font-family: inherit;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  box-sizing: border-box;
  vertical-align: top;
}
.bm-clear-btn:hover {
  border-color: #3a3f5c;               /* = .ss-trigger:hover 邊框 */
  color: #fff;
  background: #14171f;
}
/* 手機: 搜尋欄滿版 (按鈕本身 PC/手機同尺寸,不需重設) */
@media (max-width: 640px) {
  .bm-search-row {
    gap: 8px;
  }
  .bm-search-input {
    max-width: none;
  }
}

.group-wrapper {
  margin-bottom: 12px; /* 預設摺疊間距小 */
  transition: margin-bottom 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}
.group-wrapper.is-expanded {
  margin-bottom: 40px; /* 展開時間距變大 */
}

/* === 絲滑折疊動畫: CSS grid 0fr ↔ 1fr trick === */
.collapse-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.38s cubic-bezier(0.4, 0, 0.2, 1);
}
.group-wrapper.is-expanded .collapse-wrap {
  grid-template-rows: 1fr;
}
.collapse-inner {
  overflow: hidden;
  min-height: 0;
  /* 內容淡入 + 微微下滑進場 */
  opacity: 0;
  transform: translateY(-6px);
  transition:
    opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}
.group-wrapper.is-expanded .collapse-inner {
  opacity: 1;
  transform: translateY(0);
  transition-delay: 0.06s; /* 等高度開始撐開後再淡入,更有層次 */
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding: 10px 12px;
  border-radius: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition:
    background 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    border-bottom-color 0.32s cubic-bezier(0.4, 0, 0.2, 1),
    border-bottom-width 0.32s cubic-bezier(0.4, 0, 0.2, 1),
    margin-bottom 0.32s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  margin-bottom: 0;
}
.group-head:hover {
  background: rgba(var(--c-light-rgb), 0.06);
}
.group-head:active {
  background: rgba(var(--c-light-rgb), 0.1);
}
.group-wrapper.is-expanded .group-head {
  margin-bottom: 8px;
  border-bottom: 2px solid rgba(var(--c-light-rgb), 0.35);
}
/* 箭頭旋轉動畫 (用單一 ▾ 字元 + transform) */
.group-chevron {
  display: inline-block;
  width: 14px;
  margin-right: 6px;
  color: var(--c-light);
  font-size: 0.95rem;
  transform: rotate(-90deg); /* 預設摺疊指右 */
  transform-origin: center;
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}
.group-wrapper.is-expanded .group-chevron {
  transform: rotate(0deg); /* 展開指下 */
}
.group-title {
  color: var(--c-light);
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin: 0;
  display: flex;
  align-items: center;
}

/* 群組總計區 */
.group-summary {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.sum-count {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 700;
}
.sum-amount {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: linear-gradient(135deg, rgba(var(--c-light-rgb), 0.22), rgba(var(--c-deep-rgb), 0.12));
  border: 1px solid rgba(var(--c-light-rgb), 0.55);
  color: var(--c-light);
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 0 0 1px rgba(var(--c-light-rgb), 0.15);
}
.sum-amount-num {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.3px;
}

/* === 「尚未分配」緊急樣式 — 永遠置頂 + 強制展開 + 橘色脈動邊框 === */
.group-wrapper.is-urgent {
  margin-bottom: 32px;
  border: 2px solid rgba(245, 158, 11, 0.55);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(245, 158, 11, 0.08), transparent 60%),
    rgba(22, 24, 34, 0.5);
  box-shadow:
    0 0 0 4px rgba(245, 158, 11, 0.12),
    0 8px 24px rgba(0, 0, 0, 0.35);
  padding: 4px;
  animation: urgent-pulse 2.4s ease-in-out infinite;
}
@keyframes urgent-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 4px rgba(245, 158, 11, 0.12),
      0 8px 24px rgba(0, 0, 0, 0.35);
  }
  50% {
    box-shadow:
      0 0 0 8px rgba(245, 158, 11, 0.05),
      0 8px 32px rgba(245, 158, 11, 0.18);
  }
}
.is-urgent .group-head.is-urgent-head {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(239, 68, 68, 0.10));
  border-bottom: 2px solid rgba(245, 158, 11, 0.45);
  cursor: default; /* 不允許折疊 */
  margin-bottom: 8px;
}
.is-urgent .group-head.is-urgent-head:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(239, 68, 68, 0.10));
}
.is-urgent .group-title {
  color: #fbbf24;
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}
.urgent-icon {
  display: inline-block;
  margin-right: 8px;
  font-size: 1.05rem;
  animation: urgent-shake 1.6s cubic-bezier(.36,.07,.19,.97) infinite;
  transform-origin: center;
}
@keyframes urgent-shake {
  0%, 100% { transform: translateX(0) rotate(0); }
  10% { transform: translateX(-2px) rotate(-6deg); }
  20% { transform: translateX(2px) rotate(6deg); }
  30% { transform: translateX(-1px) rotate(-3deg); }
  40% { transform: translateX(1px) rotate(3deg); }
  50%, 100% { transform: translateX(0) rotate(0); }
}
.urgent-summary {
  display: inline-flex;
  align-items: center;
}
.urgent-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 16px;
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: #fff;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}
@media (prefers-reduced-motion: reduce) {
  .group-wrapper.is-urgent { animation: none; }
  .urgent-icon { animation: none; }
}

/* 道具 chips 預覽列 */
.group-items-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.item-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(var(--c-light-rgb), 0.1);
  border: 1px solid rgba(var(--c-light-rgb), 0.35);
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--c-light);
  white-space: nowrap;
  max-width: 240px;
  overflow: hidden;
}
.item-chip-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  padding: 0 8px;
  height: 22px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 800;
  font-family: 'Consolas', 'Monaco', monospace;
  box-shadow: 0 2px 6px rgba(var(--c-deep-rgb), 0.35);
}

/* -------------------------------------- */
/* 以下為你原本的 CSS，完全未作更動 */
/* -------------------------------------- */

/* Checkbox 外層容器，確保垂直置中 */
.value-action {
  display: flex;
  align-items: center;
  justify-content: flex-end; /* 如果你的 value 通常靠右對齊，用這個 */
}

/* 小巧的 Checkbox 樣式 */
.small-checkbox {
  width: 16px; /* 控制框框大小 */
  height: 16px; /* 控制框框大小 */
  cursor: pointer;
  margin: 0;

  /* UX 小細節：讓打勾時的顏色符合你暗黑 UI 的主色調 */
  accent-color: var(--c-light);

  /* 如果是在手機上，稍微加一點過渡效果會更滑順 */
  transition: transform 0.1s ease;
}

.small-checkbox:active {
  transform: scale(0.9); /* 點擊時微縮的按壓回饋 */
}
/* 頁面基礎設定 */
.whole_page {
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.dash-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  position: relative;
  padding-left: 8px;
}
.dash-card-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  background: var(--c-mid);
  border-radius: 2px;
}
.dash-card-head h3 {
  font-size: 1.1rem;
  font-weight: normal;
  letter-spacing: 0.5px;
  margin: 0;
}

/* === LIVE 即時連線小綠點 (WS push 觸發 pulse) === */
.live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-left: 6px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
  flex-shrink: 0;
  align-self: center;
}
.live-dot.is-pulsing {
  animation: live-pulse 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes live-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    transform: scale(1);
  }
  60% {
    box-shadow: 0 0 0 14px rgba(34, 197, 94, 0);
    transform: scale(1.4);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
    transform: scale(1);
  }
}

/* === WS 推送時,有變動的卡片亮一下 (主題色 ring) === */
.auction-card.just-updated {
  animation: card-update-pulse 1.4s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes card-update-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--c-light-rgb), 0);
    border-color: var(--c-mid);
  }
  20% {
    box-shadow:
      0 0 0 2px rgba(var(--c-light-rgb), 0.55),
      0 0 18px 4px rgba(var(--c-light-rgb), 0.32);
    border-color: var(--c-light);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--c-light-rgb), 0);
    border-color: #2d3047;
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-dot.is-pulsing,
  .auction-card.just-updated {
    animation: none;
  }
}

/* 核心：Grid 排版，自動換行，一排約 3-4 個 */
.auction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  width: 100%;
}

/* 手機: 單欄精華模式 */
@media (max-width: 640px) {
  .auction-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

/* 展開按鈕 — 預設手機才顯示 */
.expand-toggle {
  display: none;
  width: 100%;
  margin-top: 10px;
  padding: 8px 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}
.expand-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--c-light);
}
@media (max-width: 640px) {
  .expand-toggle {
    display: block;
  }
  .auction-card:not(.is-expanded) .row-secondary {
    display: none;
  }
}

/* 卡片美化 */
.auction-card {
  position: relative;
  background: #161822;
  border: 1px solid #2d3047;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}
/* 自己尚未繳交的單子 — 明顯線框,方便會員一眼找到 */
.auction-card.mine-unsubmitted,
.auction-card.mine-unsubmitted:hover {
  border: 2px dashed #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}
.auction-card.mine-unsubmitted::before {
  content: '📦 我的待繳';
  position: absolute;
  top: -11px;
  left: 14px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #f59e0b;
  color: #1a1305;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  z-index: 1;
}

.auction-card:hover {
  border-color: var(--c-mid);
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
}

@media (max-width: 640px) {
  .auction-card {
    padding: 14px 14px 16px;
    border-radius: 14px;
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
  }
  .auction-card:hover {
    transform: none;
  }
  .item-name {
    font-size: 1.05rem !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .boss-name,
  .boss-tag {
    font-size: 0.78rem !important;
  }
  .info-row {
    font-size: 0.85rem !important;
    margin-bottom: 7px !important;
    gap: 8px;
    min-width: 0;
  }
  .info-row .label {
    flex-shrink: 0;
  }
  .info-row .gold,
  .info-row .value,
  .info-row span:last-child {
    min-width: 0;
    word-break: break-word;
    text-align: right;
  }
  .info-row.highlight {
    margin-top: 6px;
    padding: 8px 10px;
    background: rgba(var(--c-light-rgb), 0.08);
    border-radius: 8px;
  }
  .info-row.highlight .gold {
    font-size: 1rem;
    font-weight: 800;
  }
  .submit-btn,
  .confirm-btn {
    height: 42px !important;
    font-size: 0.92rem !important;
  }
}

/* 工具按鈕區 */
.card-tools {
  position: absolute;
  top: 5px;
  right: 15px;
  display: flex;
  gap: 8px;
}

.tool-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.tool-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
}
.tool-btn.delete:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.35);
}

/* 物品與來源 */
.item-main {
  margin-bottom: 15px;
}

/* 有備註/撤單按鈕時,留右側空間避免長名字被蓋住 */
.item-main.has-tools {
  padding-right: 64px;
}

.item-name {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 4px;
  word-break: break-word;
}
.value {
  color: #f1f5f9;
}
.gold {
  color: var(--c-light);
  font-weight: bold;
}

.boss-name {
  font-size: 0.85rem;
  color: #94a3b8;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 15px;
}

/* 欄位資訊 */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.label {
  color: #64748b;
}

.highlight .value-price {
  color: #10b981;
  font-weight: bold;
  font-size: 1.1rem;
}

.value-text,
.value-remark {
  color: #888;
  font-size: 0.85rem;
  max-width: 60%;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 出價輸入 */
.bid-input-box {
  margin-top: auto;
  padding-top: 15px;
}

.price-input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  color: #fff;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  box-sizing: border-box;
}

/* 按鈕 */
.submit-btn {
  width: 100%;
  height: 44px;
  margin-top: 12px;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep)) !important;
  color: var(--c-on);
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: filter 0.2s;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #334155;
}

.submit-btn.btn-assign-gem {
  background: linear-gradient(135deg, #9f1239, #be123c) !important;
  color: white;
}

.submit-btn.btn-verify-gem {
  background: linear-gradient(135deg, #0e7490, #155e75) !important;
  color: white;
}

/* 系統骰點按鈕 — 放在「指定得標者」下面,用主題漸層區隔 */
.submit-btn.dice-btn {
  margin-top: 8px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep)) !important;
  color: var(--c-on);
}
.submit-btn.dice-btn:hover {
  filter: brightness(1.08);
}

/* === 骰骰子 Modal === */
.dice-modal {
  height: auto;
  max-height: 88vh;
  max-width: 440px;
  overflow-y: auto;
}
.dice-head {
  flex-shrink: 0;
  margin-bottom: 8px;
}
.dice-head .boss-title {
  margin-bottom: 6px;
}
.dice-sub {
  text-align: center;
  font-size: 0.88rem;
  color: #94a3b8;
}
.dice-sub .gold {
  color: var(--c-light);
  font-weight: 700;
}
.dice-loading {
  text-align: center;
  padding: 40px 0 30px;
  color: #94a3b8;
}
.dice-spinner {
  font-size: 3rem;
  animation: dice-shake 0.5s linear infinite;
}
.dice-round-label {
  text-align: center;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--c-light);
  min-height: 1.2em;
  margin-bottom: 14px;
  letter-spacing: 0.5px;
}
.dice-arena {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px 18px;
  padding: 6px 0 18px;
}
.dice-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: transform 0.2s;
}
.dice-player.is-top {
  transform: translateY(-4px);
}
.dice-cube {
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  font-weight: 900;
  color: #f8fafc;
  background: #0f172a;
  border: 2px solid #334155;
  border-radius: 12px;
  box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.4);
}
.dice-cube.rolling {
  animation: dice-shake 0.45s linear infinite;
  color: var(--c-light);
}
.dice-cube:not(.rolling) {
  animation: dice-pop 0.3s ease-out;
}
.dice-player.is-top .dice-cube {
  border-color: var(--c-light);
  color: var(--c-light);
  box-shadow: 0 0 14px rgba(var(--c-light-rgb), 0.6);
}
.dice-player.is-winner .dice-cube {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  animation: dice-winner-glow 1s ease-in-out infinite;
}
.dice-name {
  font-size: 0.78rem;
  color: #cbd5e1;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dice-player.is-top .dice-name {
  color: var(--c-light);
  font-weight: 700;
}
@keyframes dice-shake {
  0% { transform: translateY(0) rotate(0); }
  25% { transform: translateY(-6px) rotate(-18deg); }
  50% { transform: translateY(0) rotate(14deg); }
  75% { transform: translateY(-4px) rotate(-8deg); }
  100% { transform: translateY(0) rotate(0); }
}
@keyframes dice-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes dice-winner-glow {
  0%, 100% { box-shadow: 0 0 12px rgba(var(--c-light-rgb), 0.5); }
  50% { box-shadow: 0 0 26px 4px rgba(var(--c-light-rgb), 0.85); }
}
.dice-result {
  text-align: center;
  padding: 8px 0 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 6px;
}
.dice-trophy {
  font-size: 2.4rem;
  animation: dice-pop 0.4s ease-out;
}
.dice-winner-name {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--c-light);
  margin-top: 4px;
}
.dice-price {
  font-size: 0.9rem;
  color: #e2e8f0;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.dice-note {
  font-size: 0.74rem;
  color: #64748b;
  line-height: 1.5;
  margin: 10px 0 0;
}
.dice-close {
  margin-top: 14px;
}
.dice-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dice-winner-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.dice-winner-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

/* 底部數據 */
.card-footer {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #64748b;
  cursor: pointer;
}

.card-footer:hover {
  color: var(--c-mid);
}

/* Modal 樣式保持原本邏輯但微調 */
.show-people-list,
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.close-btn {
  width: 100%;
  height: 40px;
}

.boss-container {
  background: #1e1e2e;
  height: 60%; /* 保持你原本要求的 60% 高度 */
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #334155;

  /* 新增：使用 flex 佈局，讓內部組件可以自動撐開與收縮 */
  display: flex;
  flex-direction: column;
}

/* 2. 針對標題固定位置 */
.boss-title {
  text-align: center;
  color: #fff;
  margin-bottom: 20px;
  flex-shrink: 0; /* 防止標題被壓縮 */
}

/* 3. 關鍵：針對名單區域設定滾動 */
.people-list {
  flex: 1; /* 佔據彈窗內扣除標題與按鈕後的剩餘所有空間 */
  overflow-y: auto; /* 內容超過時顯示垂直滾動軸 */
  margin-bottom: 15px;
  padding-right: 8px; /* 預留空間給滾動軸，防止擋住文字 */

  /* 優化滾動軸樣式（選配，讓它更有質感） */
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}

/* 針對 Chrome, Safari 的滾動軸優化 */
.people-list::-webkit-scrollbar {
  width: 6px;
}
.people-list::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 10px;
}

/* 4. 針對底部按鈕固定位置 */
.close-btn {
  flex-shrink: 0; /* 防止按鈕被壓縮 */
  margin-top: auto;
}
.person-item {
  background: #27293d;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.person-item.is-selected {
  border: 1px solid var(--c-mid);
  background: rgba(var(--c-light-rgb), 0.1);
}

/* --- 彈窗底部按鈕區域升級 --- */
.modal-footer {
  display: flex;
  gap: 12px; /* 按鈕之間的間距 */
  margin-top: 24px; /* 與上方名單的距離 */
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.05); /* 輕微的分割線 */
  flex-shrink: 0; /* 防止按鈕區塊被壓縮 */
}

/* 按鈕基礎共用樣式 */
.modal-footer button {
  flex: 1; /* 兩個按鈕平分寬度 */
  height: 42px; /* 統一高度 */
  border-radius: 8px; /* 圓角 */
  font-weight: 600; /* 粗體字 */
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease; /* 流暢的過場動畫 */
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
}

/* 確認得標按鈕：遊戲風格漸層與發光 */
.confirm-btn {
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep)) !important; /* 藍紫漸層 */
  color: #ffffff;
  border: none;
  box-shadow: 0 4px 15px rgba(var(--c-light-rgb), 0.3); /* 深藍色發光 */
}

.confirm-btn:hover {
  filter: brightness(1.1); /* 懸停時變亮 */
  box-shadow: 0 6px 20px rgba(var(--c-light-rgb), 0.5); /* 加強發光 */
  transform: translateY(-1px); /* 微微上浮 */
}

/* 取消按鈕：低調深色 */
.cancel-btn {
  background: #2d3047; /* 深色背景，與卡片呼應 */
  color: #94a3b8; /* 較暗的文字顏色 */
  border: 1px solid #3f425b; /* 細邊框 */
}

.cancel-btn:hover {
  background: #3f425b; /* 懸停時稍微變亮 */
  color: #f1f5f9; /* 文字變亮 */
  border-color: #4b5563;
}

/* 按鈕點擊時的縮放反饋 */
.modal-footer button:active {
  transform: scale(0.96) translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* 針對「指定得標」彈窗的特殊修正（如果是 BiddingManageMent.vue） */
.assign-modal .target-item-info {
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  text-align: center;
  font-size: 0.9rem;
  color: #888;
}

/* ===== 競爭者清單 — 讓所有會員清楚看到對手 ===== */
.competitors-section {
  margin: 12px 0;
  padding: 12px 14px;
  background: linear-gradient(
    135deg,
    rgba(var(--c-light-rgb), 0.06),
    rgba(var(--c-deep-rgb), 0.04)
  );
  border: 1px solid rgba(var(--c-light-rgb), 0.18);
  border-radius: 12px;
}
.competitors-label {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--c-light);
  letter-spacing: 0.3px;
  margin-bottom: 10px;
}
.bidder-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.bidder-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 11px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  font-size: 0.82rem;
  color: #e2e8f0;
  font-weight: 600;
  line-height: 1.4;
  transition: all 0.15s;
}
.bidder-chip.is-me {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  border-color: var(--c-light);
  color: var(--c-on);
  font-weight: 800;
  box-shadow: 0 2px 10px rgba(var(--c-deep-rgb), 0.35);
}
.competitors-hint {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
  font-size: 0.76rem;
  color: #94a3b8;
  text-align: center;
}
</style>
