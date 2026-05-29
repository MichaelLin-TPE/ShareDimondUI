<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuction } from '@/composables/statCard.ts'
import { useAuthStore } from '@/stores/auth.ts'
import SearchableSelect from '@/components/SearchableSelect.vue'
import RemarkPickerModal from '@/components/RemarkPickerModal.vue'
import { REMARK_WAREHOUSE } from '@/composables/remarkOptions.ts'

const {
  auctions,
  formatTime,
  handleStatus,
  handlePersonClick,
  handleSubmit,
  submitRemark,
  handleDeleteItem,
  canSubmit,
  showPeopleList,
  getJoinList,
  formatTimestamp,
  handlePeopleCount,
  authStore,
  selectedBuyCurrency,
  submitAssign,
  showAssignModal,
  selectedMemberId,
  selectedTreasure,
  showCurrencyModal,
  handleStorageChange,
  formatEventTime,
  handleConfirmBuy,
  openCurrencyModal,
  currentBuyItem, // 👉 需要在 composable 中新增這個 ref 來記錄當前點擊的物品
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

// 道具名稱搜尋
const filterItem = ref('')
const itemOptions = computed(() => {
  const seen = new Set<string>()
  const list: { value: string; label: string }[] = []
  for (const a of auctions.value) {
    const name = (a as { itemName: string }).itemName
    if (name && !seen.has(name)) {
      seen.add(name)
      list.push({ value: name, label: name })
    }
  }
  return list.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'))
})
const filteredAuctions = computed(() => {
  if (!filterItem.value) return auctions.value
  return auctions.value.filter(
    (a) => (a as { itemName: string }).itemName === filterItem.value,
  )
})
function clearItemFilter() {
  filterItem.value = ''
}

// === WS 推送即時動畫 ===
// 1) recentlyUpdated: 哪些卡片剛收到 WS 更新 (price/bidder/status 變化),用來打發光 ring
// 2) liveTick: WS 任何更新就 +1,標題旁的綠點靠它 pulse
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
        // 加進 set 觸發 ring 動畫,1.4 秒後移除
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

// 手機卡片展開狀態 (PC 永遠展開)
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
</script>

<template>
  <div class="whole_page">
    <div class="dash-card-head">
      <h3>正在競拍 共 {{ filteredAuctions.length }} 件競拍中道具</h3>
      <span class="live-dot" :class="{ 'is-pulsing': liveTick > 0 }" :key="liveTick" title="即時連線中" aria-hidden="true"></span>
      <div class="tooltip-wrapper">
        <font-awesome-icon :icon="['far', 'circle-question']" class="info-icon" />
        <div class="tooltip-content">
          <strong>🔨 競拍道具參與須知</strong>
          1. <b>競拍時限：</b>每件物品皆有專屬倒數計時，時間結束即結標。<br />
          2. <b>自動流標：</b>若無人出價，物品將自動進入下一輪倒數，且<b>起標價格不變</b>。<br />
          3. <b>出價模式：</b>分為「直購價（固定金額）」與「價高者得（競標）」兩種模式。<br />
          4. <b>防壓秒保護：</b>倒數一分鐘內若有人出價，時間將重置回一分鐘，直至無人加價。<br />
          5. <b>優先參與權：</b>首輪僅限「參與分紅者」競拍；若流標，次輪起才開放全體成員。<br />
          6. <b>誠信守則：</b>出價後<b>不可收回</b>。嚴禁惡意出價，違者將依規定懲處。
        </div>
      </div>
    </div>

    <div v-if="itemOptions.length > 0" class="sc-search-row">
      <SearchableSelect
        class="sc-search-input"
        v-model="filterItem"
        :options="itemOptions"
        placeholder="搜尋道具名稱"
      />
      <button
        v-if="filterItem"
        type="button"
        class="sc-clear-btn"
        title="清除"
        aria-label="清除"
        @click="clearItemFilter"
      >
        ✕
      </button>
    </div>

    <div class="auction-container">
      <div v-if="filteredAuctions.length === 0" class="sc-empty">
        沒有符合「{{ filterItem }}」的道具
      </div>
      <TransitionGroup tag="div" name="card-flip" class="auction-grid">
        <div
          v-for="item in filteredAuctions"
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
            <div class="boss-name">BOSS: {{ item.bossName }}</div>
          </div>

          <div class="divider"></div>

          <div class="info-section">
            <div class="info-row row-secondary">
              <span class="label">開單時間</span>
              <span class="value">{{ formatEventTime(item.createDate) }}</span>
            </div>
            <div class="info-row row-secondary">
              <span class="label">開單者</span>
              <span class="value">{{ item.ticketOwerName }}</span>
            </div>
            <div
              class="info-row row-secondary"
              v-for="c in item.treasureCurrencyList"
              :key="c.currency"
            >
              <span class="label">{{ c.currency }}價格</span>
              <span class="value gold">{{ Number(c.amount).toLocaleString() }}</span>
            </div>
            <div v-if="item.treasureType === 'BID'" class="info-row highlight">
              <span class="label">目前最高價</span>
              <span class="value-price"
                >{{ Number(item.currentPrice).toLocaleString() }} {{ item.currency }}</span
              >
            </div>
          </div>

          <div class="bidder-section">
            <template v-if="item.treasureType === 'RANDOM_BUYER'">
              <div class="info-row">
                <span class="label">競標名單</span>
                <span class="value-text">{{ item.biddingMemberContent || '無' }}</span>
              </div>
            </template>
            <template v-else>
              <div class="info-row">
                <span class="label">最高出價者</span>
                <span class="value">{{ item.biddingName || '尚未有人出價' }}</span>
              </div>
            </template>
            <div class="info-row row-secondary">
              <span class="label">備註</span>
              <span class="value-remark">{{ item.remark || '無備註' }}</span>
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

          <div v-if="item.treasureType !== 'RANDOM_BUYER'" class="bid-input-box">
            <input
              type="number"
              v-model.number="item.biddingPrice"
              min="0"
              class="price-input"
              placeholder="輸入競標金額"
            />
          </div>

          <button
            class="submit-btn"
            :class="{
              'btn-verify-get-item':
                !item.checkFromRepository && authStore.member?.role === 'MEMBER',
              'btn-assign-gem': !item.isBidding && item.assignByLeader,
              'btn-verify-gem':
                !item.isBidding && !item.assignByLeader && item.canVerifyBiddingTicket,
            }"
            :disabled="canSubmit(item)"
            @click="
              item.treasureType === 'RANDOM_BUYER' && item.isBidding && item.canBid
                ? openCurrencyModal(item)
                : handleSubmit(item)
            "
          >
            <span v-if="item.isBidding">
              <template v-if="!item.canBid">尚未參與,無法競標</template>
              <template v-else-if="item.treasureType === 'RANDOM_BUYER'">我要標此物品</template>
              <template v-else>確認出價</template>
            </span>
            <span v-else-if="item.disableSubmitButton">競標已結束</span>
            <span v-else-if="item.assignByLeader">指定得標者</span>
            <span v-else-if="item.canVerifyBiddingTicket">派發獎金</span>
          </button>

          <div class="card-footer" @click="handlePeopleCount(item)">
            <span class="timer">⏳ {{ formatTime(item.remainSeconds) }}</span>
            <span class="people">👥 {{ item.treasureAttendanceList.length }}人</span>
            <span class="status-tag">{{ handleStatus(item.status) }}</span>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div v-if="showCurrencyModal" class="modal-overlay" @click.self="showCurrencyModal = false">
      <div class="modal-card mini">
        <div class="modal-header">
          <h2 class="modal-title">請選擇購買幣別</h2>
        </div>

        <div class="form-group" style="margin-top: 20px">
          <div class="radio-card-group">
            <label
              v-for="c in currentBuyItem?.treasureCurrencyList"
              :key="c.currency"
              class="radio-card"
            >
              <input
                type="radio"
                v-model="selectedBuyCurrency"
                :value="c.currency"
                name="buyCurrency"
              />
              <div class="radio-content" style="padding: 12px">
                <div style="font-size: 1rem; margin-bottom: 4px">{{ c.currency }}</div>
                <div class="gold" style="font-weight: bold">
                  {{ Number(c.amount).toLocaleString() }}
                </div>
              </div>
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-submit" @click="handleConfirmBuy">我要標!</button>
          <button class="btn-cancel" @click="showCurrencyModal = false">取消</button>
        </div>
      </div>
    </div>
    <div v-if="showPeopleList" class="show-people-list" @click.self="showPeopleList = false">
      <div class="boss-container">
        <h2 class="boss-title">參與名單</h2>
        <ul class="people-list">
          <li
            v-for="(data, index) in getJoinList()"
            :key="index"
            class="person-item"
            @click="handlePersonClick(data)"
          >
            <div class="person-info">
              <span class="person-name">👤 {{ data.userName }} </span>
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
          道具：<span class="gold">{{ selectedTreasure?.itemName }}</span>
        </div>
        <div class="people-list">
          <div v-if="!selectedTreasure?.biddingMemberList?.length" class="empty-hint">
            目前無人參與競標
          </div>
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

/* === LIVE 即時連線小綠點 (WS push 時 pulse,key 變動觸發 re-mount 重播動畫) === */
.live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-left: 6px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
  position: relative;
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

/* === TransitionGroup: 兩階段插入動畫 === */
/* 注意: 必須用 .auction-card.card-flip-* 雙 class 把 specificity 拉到 0,2,0,
   不然會被下面 `.auction-card { transition: all 0.3s ease }` 的 cascade 蓋掉。
   Phase 1 (0~280ms): siblings 滑去新位置,空格可見 (新卡片 opacity 0 + scale 0.4)
   Phase 2 (280ms~880ms): 新卡片 elastic scale + fade in + glow ring 同時實體化 */
.auction-card.card-flip-enter-from {
  opacity: 0;
  transform: scale(0.4);
}
.auction-card.card-flip-enter-to {
  opacity: 1;
  transform: scale(1);
}
.auction-card.card-flip-enter-active {
  transition:
    opacity 0.5s ease-out 0.28s,
    transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.28s;
  animation: card-materialize-glow 1.2s ease-out 0.28s;
}
@keyframes card-materialize-glow {
  0%,
  30% {
    box-shadow: 0 0 0 0 rgba(var(--c-light-rgb), 0);
  }
  60% {
    box-shadow:
      0 0 0 2px rgba(var(--c-light-rgb), 0.6),
      0 0 28px 6px rgba(var(--c-light-rgb), 0.42);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--c-light-rgb), 0);
  }
}

.auction-card.card-flip-leave-from {
  opacity: 1;
  transform: scale(1);
}
.auction-card.card-flip-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
.auction-card.card-flip-leave-active {
  position: absolute;
  transition:
    opacity 0.24s ease-out,
    transform 0.28s ease-out;
}
.auction-card.card-flip-move {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* === WS 推送時,有變動的卡片邊緣亮一下 (主題色 ring) === */
.auction-card.just-updated {
  animation: card-update-pulse 1.4s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes card-update-pulse {
  0% {
    box-shadow:
      0 0 0 0 rgba(var(--c-light-rgb), 0),
      0 0 0 0 rgba(var(--c-light-rgb), 0);
    border-color: var(--c-mid);
  }
  20% {
    box-shadow:
      0 0 0 2px rgba(var(--c-light-rgb), 0.55),
      0 0 18px 4px rgba(var(--c-light-rgb), 0.32);
    border-color: var(--c-light);
  }
  100% {
    box-shadow:
      0 0 0 0 rgba(var(--c-light-rgb), 0),
      0 0 0 0 rgba(var(--c-light-rgb), 0);
    border-color: #2d3047;
  }
}

/* 系統設「減少動畫」的人就讓動畫消失 */
@media (prefers-reduced-motion: reduce) {
  .live-dot.is-pulsing,
  .auction-card.just-updated,
  .auction-card.card-flip-enter-active {
    animation: none;
  }
  .auction-card.card-flip-enter-active,
  .auction-card.card-flip-leave-active,
  .auction-card.card-flip-move {
    transition: none;
  }
}

/* === 道具搜尋欄 — 抄 BiddingManagement 暴力對齊範本 (44px + flex-start + !important) === */
.sc-search-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 0 16px;
}
.sc-search-input {
  flex: 1;
  min-width: 0;
  max-width: 360px;
  height: 38px;
  display: block;
  vertical-align: top;
}
.sc-search-input :deep(.ss-trigger) {
  height: 38px !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}
/* 清除鈕 — icon-only 38x38 方塊,PC / 手機共用 */
.sc-clear-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
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
.sc-clear-btn:hover {
  border-color: #3a3f5c;
  color: #fff;
  background: #14171f;
}
.sc-empty {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed #2e3147;
  border-radius: 12px;
  margin-bottom: 16px;
}
/* 手機: 搜尋欄滿版 (按鈕 PC/手機同尺寸,不需重設) */
@media (max-width: 640px) {
  .sc-search-row {
    gap: 8px;
  }
  .sc-search-input {
    max-width: none;
  }
}

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

/* 核心：Grid 排版，自動換行，一排約 3-4 個 */
.auction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  width: 100%;
}

/* 手機: 單欄 + 卡片精華模式 (展開細節用按鈕切) */
@media (max-width: 640px) {
  .auction-grid {
    grid-template-columns: 1fr;
    gap: 12px;
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
.auction-card.mine-unsubmitted {
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

/* 展開按鈕 — 預設手機才顯示,PC 自動隱藏 */
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

/* 手機卡片精華模式: padding 縮小 + 隱藏 secondary 行 + 展開按鈕顯示 */
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
  .item-main {
    margin-bottom: 10px;
    min-width: 0;
  }
  .item-main.has-tools {
    padding-right: 64px; /* icon 化後 2 顆按鈕 + gap 約 60px,留 4 餘裕 */
  }
  .item-name {
    font-size: 1.05rem;
    line-height: 1.3;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .boss-name {
    font-size: 0.78rem;
  }
  .divider {
    margin-bottom: 10px;
  }
  .info-row {
    font-size: 0.85rem;
    margin-bottom: 7px;
    gap: 8px;
    min-width: 0;
  }
  .info-row .label {
    flex-shrink: 0;
  }
  .info-row .value,
  .info-row .value-text,
  .info-row .value-remark,
  .info-row .value-price {
    min-width: 0;
    word-break: break-word;
    text-align: right;
  }
  /* 目前最高價區塊放大顯示 (mobile highlight) */
  .info-row.highlight {
    margin-top: 6px;
    padding: 8px 10px;
    background: rgba(var(--c-light-rgb), 0.08);
    border-radius: 8px;
  }
  .info-row.highlight .label {
    font-weight: 700;
  }
  .info-row.highlight .value-price {
    font-size: 1rem;
    font-weight: 800;
    color: var(--c-light);
  }
  /* 主按鈕 (我要標) */
  .submit-btn {
    height: 42px;
    font-size: 0.92rem;
  }
  /* 展開按鈕顯示 */
  .expand-toggle {
    display: block;
  }
  /* 預設隱藏 secondary 行,展開後才顯示 */
  .auction-card:not(.is-expanded) .row-secondary {
    display: none;
  }
}

.auction-card:hover {
  border-color: var(--c-mid);
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
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
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
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

/* 有備註/撤單按鈕時,留右側空間避免長名字被蓋住 (icon 化後縮小) */
.item-main.has-tools {
  padding-right: 70px;
}

.item-name {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 4px;
  word-break: break-word;
}

.gold {
  color: var(--c-light);
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
.value {
  color: #f1f5f9;
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
.submit-btn span {
  font-weight: bold;
}
/* 按鈕 */
.submit-btn {
  width: 100%;
  height: 44px;
  margin-top: 12px;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep)) !important;
  /* 注意：使用這個顏色時，按鈕文字如果原本是白色，建議改成深色 (例如 #1e1e24) 會更清晰 */
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
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep)) !important;
  /* 注意：使用這個顏色時，按鈕文字如果原本是白色，建議改成深色 (例如 #1e1e24) 會更清晰 */
  color: var(--c-on) !important;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: filter 0.2s;
}

.submit-btn.btn-verify-gem {
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep)) !important;
  /* 注意：使用這個顏色時，按鈕文字如果原本是白色，建議改成深色 (例如 #1e1e24) 會更清晰 */
  color: var(--c-on) !important;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: filter 0.2s;
}

.btn-verify-get-item {
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep)) !important;
  /* 注意：使用這個顏色時，按鈕文字如果原本是白色，建議改成深色 (例如 #1e1e24) 會更清晰 */
  color: var(--c-on) !important;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: filter 0.2s;
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

/* Modal 共用樣式 */
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

.modal-card {
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.modal-header {
  text-align: center;
  margin-bottom: 20px;
}
.modal-title {
  font-size: 1.4rem;
  color: #f8fafc;
  margin-bottom: 4px;
}

/* 👇 補齊你原本寫在 TreasureCard 裡的 Radio 樣式 👇 */
.radio-card-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.radio-card {
  cursor: pointer;
  flex: 1;
}
.radio-card input {
  display: none;
}
.radio-content {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  text-align: center;
  color: #94a3b8;
  transition: all 0.2s;
}
.radio-card input:checked + .radio-content {
  border-color: #b46eff;
  background: rgba(180, 110, 255, 0.1);
  color: #fff;
}

.modal-footer {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}
.btn-submit {
  flex: 2;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep)) !important;
  color: var(--c-on);
  border: none;
  padding: 12px;
  border-radius: 10px;
  font-weight: bold;
  cursor: pointer;
}
.btn-cancel {
  flex: 1;
  background: #334155;
  color: #f1f5f9;
  border: none;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
}

.close-btn {
  width: 100%;
  height: 40px;
}

.boss-container {
  background: #1e1e2e;
  height: 60%;
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #334155;
  display: flex;
  flex-direction: column;
}

.boss-title {
  text-align: center;
  color: #fff;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.people-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 15px;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}

.people-list::-webkit-scrollbar {
  width: 6px;
}
.people-list::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 10px;
}

.close-btn,
.modal-footer {
  flex-shrink: 0;
  margin-top: auto;
}
.person-item {
  background: #27293d;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}
.gold {
  color: var(--c-light);
  font-weight: bold;
}
.person-item.is-selected {
  border: 1px solid var(--c-mid);
  background: rgba(var(--c-light-rgb), 0.1);
}
</style>

<style>
/* SweetAlert2 自定義 (無 scoped) */
.custom-swal-actions {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px;
}
.custom-swal-confirm {
  background: var(--c-mid) !important;
}
</style>
