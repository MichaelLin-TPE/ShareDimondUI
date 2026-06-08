<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuction } from '@/composables/treasureCare.ts'
import SearchableSelect from '@/components/SearchableSelect.vue'
import RemarkPickerModal from '@/components/RemarkPickerModal.vue'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import { useAuthStore } from '@/stores/auth.ts'
import {
  REMARK_WAREHOUSE,
  REMARK_ON_ME,
  buildGiveRemark,
  type RemarkChoice,
} from '@/composables/remarkOptions.ts'

const {
  auctions,
  formatTime,
  showModal,
  handleSubmit,
  itemName,
  itemOptions,
  bossName,
  bossOptions,
  basePrice,
  remark,
  handleItemChange,
  openTicket,
  handlePeopleCount,
  showPeopleList,
  submitRemark,
  openAddTreasureDialog,
  handleDeleteItem,
  showAddTreasureDialog,
  addItemName,
  handlePersonClick,
  loading,
  error,
  addTreasure,
  showAddBossDialog,
  handleJoinItem,
  balance,
  formatTimestamp,
  selectedCurrency,
  selectedType,
  addBossName,
  addBoss,
  getJoinList,
  openAddBossDialog,
  updateTreasureItem,
  deleteTreasureItem,
  updateBoss,
  deleteBoss,
  showQuickModal,
  quickHistory,
  quickLoading,
  quickBusyKey,
  openQuickTicket,
  quickResubmit,
  removeQuickEntry,
} = useAuction()

// 標示「自己尚未繳交」的單子 — 開單者是我且備註不是已繳倉庫
const auth = useAuthStore()
const myName = computed(() => auth.member?.userName ?? '')
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

// 開單表單的備註 — 預設「在我身上」,改用統一選項
const sharedLists = useSharedListsStore()
const memberOptions = computed(() =>
  sharedLists.members.map((m) => ({ value: m.memberName, label: m.memberName })),
)
const openRemarkChoice = ref<RemarkChoice>('onme')
const openGiveMember = ref('')
watch([openRemarkChoice, openGiveMember], () => {
  if (openRemarkChoice.value === 'warehouse') remark.value = REMARK_WAREHOUSE
  else if (openRemarkChoice.value === 'give') remark.value = buildGiveRemark(openGiveMember.value)
  else remark.value = REMARK_ON_ME
})
watch(
  () => showModal.value,
  (open) => {
    if (!open) return
    sharedLists.loadMembers()
    openRemarkChoice.value = 'onme'
    openGiveMember.value = ''
    remark.value = REMARK_ON_ME
  },
)

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

// === WS 推送即時動畫 (跟 StatCard 同 pattern,必須在 useAuction() 之後避免 TDZ) ===
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

interface ItemOpt { itemId: string; itemName: string }
interface BossOpt { bossId: string; bossName: string }
const itemSelectOptions = computed(() =>
  (itemOptions.value as ItemOpt[]).map((it) => ({ value: it.itemId, label: it.itemName })),
)
const bossSelectOptions = computed(() =>
  (bossOptions.value as BossOpt[]).map((b) => ({ value: b.bossId, label: b.bossName })),
)
const onItemChange = (v: string) => {
  itemName.value = v
  handleItemChange()
}

// 管理彈窗 — 用統一的 { id, name } 結構簡化 template 的 union type 問題
const manageList = computed<{ id: string; name: string }[]>(() => {
  if (showAddBossDialog.value) {
    return (bossOptions.value as BossOpt[]).map((b) => ({ id: b.bossId, name: b.bossName }))
  }
  return (itemOptions.value as ItemOpt[]).map((i) => ({ id: i.itemId, name: i.itemName }))
})

// 管理彈窗:正在編輯的列(itemId / bossId),以及暫存的編輯名稱
const editingId = ref('')
const editingName = ref('')

const startEdit = (id: string, name: string) => {
  editingId.value = id
  editingName.value = name
}
const cancelEdit = () => {
  editingId.value = ''
  editingName.value = ''
}
const saveEditTreasure = async () => {
  if (!editingName.value.trim()) return
  const ok = await updateTreasureItem(editingId.value, editingName.value.trim())
  if (ok) cancelEdit()
}
const saveEditBoss = async () => {
  if (!editingName.value.trim()) return
  const ok = await updateBoss(editingId.value, editingName.value.trim())
  if (ok) cancelEdit()
}
const closeManageDialog = () => {
  showAddBossDialog.value = false
  showAddTreasureDialog.value = false
  cancelEdit()
}
</script>

<template>
  <div class="whole_page">
    <div class="dash-card-head">
      <h3 class="page-title">
        寶物分紅參與

        <div class="tooltip-wrapper">
          <font-awesome-icon :icon="['far', 'circle-question']" class="info-icon" />
          <div class="tooltip-content">
            <strong>💰 寶物分紅與申報須知</strong>
            1. <b>建立帳單：</b>掉落寶物後請立即進行開單。<br />
            2. <b>標註持有人：</b>備註註明保管人，以便會計與倉庫追蹤。<br />
            3. <b>及時交接：</b>請儘速將物品轉交倉庫或會計。<br />
            4. <b>確認權益：</b>參與成員請務必點擊「我有參與 +1」。
          </div>
        </div>

        <span>(共 {{ auctions.length }} 件)</span>
        <span class="live-dot" :class="{ 'is-pulsing': liveTick > 0 }" :key="liveTick" title="即時連線中" aria-hidden="true"></span>
      </h3>
      <div class="header-btns">
        <button class="btn-top open" @click="openTicket">開單</button>
        <button class="btn-top" @click="openQuickTicket" title="從最近的開單紀錄一鍵重送">快速</button>
        <button class="btn-top add" @click="openAddTreasureDialog">道具</button>
        <button class="btn-top add" @click="openAddBossDialog">首領</button>
      </div>
    </div>

    <div class="auction-container">
      <TransitionGroup tag="div" name="card-flip" class="auction-grid">
        <div
          v-for="item in auctions"
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
              class="tool-btn"
              v-show="item.showDeleteTicket"
              @click="openRemarkPicker(item)"
              title="備註"
              aria-label="備註"
            >
              ✎
            </button>
            <button
              class="tool-btn del"
              v-show="item.showDeleteTicket"
              @click="handleDeleteItem(item)"
              title="撤單"
              aria-label="撤單"
            >
              ✕
            </button>
          </div>
          <div class="item-main">
            <div class="item-name gold">{{ item.itemName }}</div>
            <div class="boss-tag">首領：{{ item.bossName }}</div>
          </div>
          <div class="divider"></div>
          <div class="info-body">
            <div class="info-row row-secondary">
              <span class="label">開單者</span><span class="value">{{ item.ticketOwerName }}</span>
            </div>
            <div class="info-row" v-for="c in item.treasureCurrencyList" :key="c.currency">
              <span class="label">{{ c.currency }}價格</span
              ><span class="value gold">{{ Number(c.amount).toLocaleString() }}</span>
            </div>
            <div class="info-row row-secondary">
              <span class="label">種類</span><span class="value">{{ item.treasureType }}</span>
            </div>
            <div class="info-row row-secondary">
              <span class="label">備註</span
              ><span class="value-remark">{{ item.remark || '無' }}</span>
            </div>
          </div>
          <button
            class="join-btn"
            :class="{ joined: item.joinButtonDisable }"
            @click="handleJoinItem(item)"
          >
            {{ item.joinButtonDisable ? '已參與 (撤銷)' : '我有參與 +1' }}
          </button>
          <button class="expand-toggle" @click="toggleExpand(item.treasureCode)">
            <span v-if="isExpanded(item.treasureCode)">收起細節 ⌃</span>
            <span v-else>展開細節 ⌄</span>
          </button>
          <div class="card-footer" @click="handlePeopleCount(item)">
            <span>⏳ {{ formatTime(item.remainSeconds) }}</span>
            <span>👥 {{ item.treasureAttendanceList.length }} 人</span>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <Teleport to="body">
      <div v-if="showPeopleList" class="ot-modal">
        <div class="ot-modal__mask" @click="showPeopleList = false"></div>
        <div class="ot-modal__panel ot-modal__panel--people" role="dialog">
          <button class="ot-modal__close" type="button" @click="showPeopleList = false">×</button>
          <div class="ot-modal__head">
            <h2>參與名單</h2>
            <p>點擊成員可管理其參與資格</p>
          </div>
          <ul class="ot-people-list">
            <li
              v-for="(data, index) in getJoinList()"
              :key="index"
              class="ot-people-item"
              @click="handlePersonClick(data)"
            >
              <span class="ot-people-name">👤 {{ data.userName }}</span>
              <span class="ot-people-time">{{ formatTimestamp(data.joinTime) }}</span>
            </li>
          </ul>
          <button class="ot-btn ot-btn--cancel" style="width: 100%;" @click="showPeopleList = false">
            關閉
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showModal" class="ot-modal">
        <div class="ot-modal__mask" @click="showModal = false"></div>
        <div class="ot-modal__panel" role="dialog">
          <button class="ot-modal__close" type="button" @click="showModal = false">×</button>
          <div class="ot-modal__head">
            <h2>創建拍賣清單</h2>
            <p>請填寫詳細寶物資訊</p>
          </div>

          <form @submit.prevent="handleSubmit" class="ot-modal__form">
            <div class="ot-field">
              <label>寶物名稱</label>
              <SearchableSelect
                :model-value="itemName"
                @update:model-value="onItemChange"
                :options="itemSelectOptions"
                placeholder="輸入關鍵字搜尋寶物..."
              />
            </div>

            <div class="ot-field">
              <label>首領名稱</label>
              <SearchableSelect
                v-model="bossName"
                :options="bossSelectOptions"
                placeholder="輸入關鍵字搜尋首領..."
              />
            </div>

            <div class="ot-field">
              <label>分紅幣種</label>
              <div class="ot-chips">
                <label v-for="item in balance.balanceList" :key="item.currency" class="ot-chip">
                  <input
                    type="radio"
                    v-model="selectedCurrency"
                    :value="item.currency"
                    name="ot-currency"
                  />
                  <span>{{ item.currency }}</span>
                </label>
              </div>
            </div>

            <div class="ot-field">
              <label>開單種類</label>
              <div class="ot-chips ot-chips--two">
                <label class="ot-chip">
                  <input type="radio" v-model="selectedType" value="bid" name="ot-type" />
                  <span>競標模式</span>
                </label>
                <label class="ot-chip">
                  <input type="radio" v-model="selectedType" value="fixed" name="ot-type" />
                  <span>固定金額</span>
                </label>
              </div>
            </div>

            <div class="ot-field">
              <label>起始底價</label>
              <div class="ot-input-wrap">
                <input type="number" v-model.number="basePrice" required placeholder="0" />
                <span class="ot-suffix">{{ selectedCurrency || 'G' }}</span>
              </div>
            </div>

            <div class="ot-field">
              <label>備註(道具去向)</label>
              <div class="ot-chips">
                <label class="ot-chip">
                  <input
                    type="radio"
                    v-model="openRemarkChoice"
                    value="warehouse"
                    name="ot-remark"
                  />
                  <span>🏰 已繳倉庫</span>
                </label>
                <label class="ot-chip">
                  <input type="radio" v-model="openRemarkChoice" value="onme" name="ot-remark" />
                  <span>🧍 在我身上</span>
                </label>
                <label class="ot-chip">
                  <input type="radio" v-model="openRemarkChoice" value="give" name="ot-remark" />
                  <span>🎁 道具給 XXX 了</span>
                </label>
              </div>
              <SearchableSelect
                v-if="openRemarkChoice === 'give'"
                v-model="openGiveMember"
                :options="memberOptions"
                placeholder="輸入關鍵字搜尋會員..."
                style="margin-top: 10px"
              />
            </div>

            <p v-if="error" class="ot-error">{{ error }}</p>

            <div class="ot-actions">
              <button type="button" class="ot-btn ot-btn--cancel" @click="showModal = false">
                取消
              </button>
              <button type="submit" class="ot-btn ot-btn--submit" :disabled="loading">
                {{ loading ? '提交中...' : '確認開單' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showQuickModal" class="ot-modal">
        <div class="ot-modal__mask" @click="showQuickModal = false"></div>
        <div class="ot-modal__panel ot-modal__panel--quick" role="dialog">
          <button class="ot-modal__close" type="button" @click="showQuickModal = false">×</button>
          <div class="ot-modal__head">
            <h2>快速開單</h2>
            <p>點「送出」即重送一模一樣的開單請求</p>
          </div>

          <div v-if="quickHistory.length === 0" class="qk-empty">
            <span class="qk-empty-icon">🗒️</span>
            <p>還沒有開單紀錄,先用「開單」建立第一筆,之後就能在這裡一鍵重送。</p>
          </div>

          <ul v-else class="qk-list">
            <li v-for="(entry, idx) in quickHistory" :key="idx" class="qk-item">
              <div class="qk-info">
                <div class="qk-title-row">
                  <span class="qk-item-name">{{ entry.itemLabel }}</span>
                  <span class="qk-type" :class="entry.type === 0 ? 'is-bid' : 'is-fixed'">
                    {{ entry.type === 0 ? '競標' : '固定' }}
                  </span>
                </div>
                <div class="qk-meta">
                  <span>👑 {{ entry.bossLabel }}</span>
                  <span class="qk-price">{{ Number(entry.lowestPrice).toLocaleString() }} {{ entry.currency }}</span>
                </div>
                <div class="qk-remark">📝 {{ entry.remark || '無' }}</div>
              </div>
              <div class="qk-actions">
                <button
                  type="button"
                  class="qk-submit"
                  :disabled="quickLoading"
                  @click="quickResubmit(entry)"
                >
                  {{ quickBusyKey === `${entry.itemName}|${entry.bossName}` ? '送出中…' : '送出' }}
                </button>
                <button
                  type="button"
                  class="qk-remove"
                  title="從紀錄移除"
                  :disabled="quickLoading"
                  @click="removeQuickEntry(entry)"
                >
                  ✕
                </button>
              </div>
            </li>
          </ul>

          <button type="button" class="ot-btn ot-btn--cancel qk-close" @click="showQuickModal = false">
            關閉
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showAddBossDialog || showAddTreasureDialog" class="ot-modal">
        <div class="ot-modal__mask" @click="closeManageDialog"></div>
        <div class="ot-modal__panel ot-modal__panel--mini ot-mgmt" role="dialog">
          <button class="ot-modal__close" type="button" @click="closeManageDialog">×</button>
          <div class="ot-modal__head">
            <h2>{{ showAddBossDialog ? '管理首領' : '管理道具' }}</h2>
            <p>新增、改名、刪除</p>
          </div>

          <!-- 新增區 -->
          <div class="mgmt-add-row">
            <input
              v-if="showAddBossDialog"
              v-model="addBossName"
              type="text"
              placeholder="輸入新首領名稱"
              class="mgmt-input"
            />
            <input
              v-else
              v-model="addItemName"
              type="text"
              placeholder="輸入新道具名稱"
              class="mgmt-input"
            />
            <button
              type="button"
              class="mgmt-add-btn"
              :disabled="loading"
              @click="showAddBossDialog ? addBoss() : addTreasure()"
            >
              + 新增
            </button>
          </div>

          <p v-if="error" class="ot-error">{{ error }}</p>

          <!-- 列表 -->
          <div class="mgmt-list-head">
            <span class="mgmt-list-title">
              {{ showAddBossDialog ? '已建立的首領' : '已建立的道具' }}
            </span>
            <span class="mgmt-list-count">{{ manageList.length }} 項</span>
          </div>

          <ul class="mgmt-list">
            <li v-for="opt in manageList" :key="opt.id" class="mgmt-row">
              <template v-if="editingId === opt.id">
                <input
                  v-model="editingName"
                  type="text"
                  class="mgmt-input mgmt-input--inline"
                  @keyup.enter="showAddBossDialog ? saveEditBoss() : saveEditTreasure()"
                  @keyup.esc="cancelEdit"
                />
                <button
                  type="button"
                  class="mgmt-icon-btn mgmt-confirm"
                  title="儲存"
                  @click="showAddBossDialog ? saveEditBoss() : saveEditTreasure()"
                >
                  ✓
                </button>
                <button
                  type="button"
                  class="mgmt-icon-btn mgmt-cancel"
                  title="取消"
                  @click="cancelEdit"
                >
                  ✕
                </button>
              </template>
              <template v-else>
                <span class="mgmt-name">{{ opt.name }}</span>
                <button
                  type="button"
                  class="mgmt-icon-btn mgmt-edit"
                  title="改名"
                  @click="startEdit(opt.id, opt.name)"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  class="mgmt-icon-btn mgmt-del"
                  title="刪除"
                  @click="
                    showAddBossDialog
                      ? deleteBoss(opt.id, opt.name)
                      : deleteTreasureItem(opt.id, opt.name)
                  "
                >
                  🗑
                </button>
              </template>
            </li>
            <li v-if="manageList.length === 0" class="mgmt-empty">
              還沒有任何項目
            </li>
          </ul>

          <button
            type="button"
            class="ot-btn ot-btn--cancel mgmt-close"
            @click="closeManageDialog"
          >
            關閉
          </button>
        </div>
      </div>
    </Teleport>

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
  transition: color 0.2s;
}

.info-icon:hover {
  color: #4a90e2; /* 滑鼠移上去變色 */
}

/* 提示框本體 */
.tooltip-content {
  visibility: hidden;
  width: 320px; /* 增加寬度，文字才不會擠在一起 */
  background-color: rgba(0, 0, 0, 0.9); /* 稍微加深背景色增加對比 */
  color: #fff;
  text-align: left;
  padding: 15px; /* 增加內距，讓文字有呼吸空間 */
  border-radius: 8px; /* 圓角加大一點點，看起來更現代 */

  /* 關鍵字體調整 */
  font-size: 15px; /* 放大字體 */
  line-height: 1.6; /* 增加行高，閱讀長文案才不吃力 */
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

.whole_page {
  padding: 20px;
  color: #e2e8f0;
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
.dash-card-head h3,
.page-title {
  font-size: 1.1rem;
  font-weight: normal;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}
.dash-card-head .header-btns {
  margin-left: auto;
}

.page-title span {
  /* 副標題（共幾件）也微調一下顏色與大小 */
  font-size: 0.8rem;
  font-weight: normal;
  color: #64748b;
  letter-spacing: 0;
}
/* page-title 內的 live-dot 不要被上面 .page-title span 套 */
.page-title .live-dot {
  font-size: 0;
}

/* === LIVE 即時連線小綠點 (跟 StatCard 同 spec) === */
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
  vertical-align: middle;
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

/* === TransitionGroup: 兩階段插入動畫 (跟 StatCard 同 spec) === */
.card-flip-enter-from {
  opacity: 0;
  transform: scale(0.4);
}
.card-flip-enter-to {
  opacity: 1;
  transform: scale(1);
}
.card-flip-enter-active {
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
.card-flip-leave-from {
  opacity: 1;
  transform: scale(1);
}
.card-flip-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
.card-flip-leave-active {
  position: absolute;
  transition:
    opacity 0.24s ease-out,
    transform 0.28s ease-out;
}
.card-flip-move {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* === WS 推送時,有變動的卡片邊緣亮一下 === */
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
  .auction-card.just-updated,
  .card-flip-enter-active {
    animation: none;
  }
  .card-flip-enter-active,
  .card-flip-leave-active,
  .card-flip-move {
    transition: none;
  }
}
.header-btns {
  display: flex;
  gap: 8px;
}

.btn-top {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #00d4ff;
  cursor: pointer;
}

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
  /* 預設隱藏 secondary 行,展開後才顯示 */
  .auction-card:not(.is-expanded) .row-secondary {
    display: none;
  }
}

.auction-card {
  background: #161822;
  border: 1px solid #2d3047;
  border-radius: 16px;
  padding: 20px;
  position: relative;
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
@media (max-width: 640px) {
  .auction-card {
    padding: 14px 14px 16px;
    border-radius: 14px;
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
  }
  .item-name {
    font-size: 1.05rem !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
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
  .info-row span:last-child {
    min-width: 0;
    word-break: break-word;
    text-align: right;
  }
  .join-btn {
    height: 42px !important;
    font-size: 0.92rem !important;
  }
}
.item-name {
  font-size: 1.25rem;
  margin-bottom: 4px;
}
.boss-tag {
  font-size: 0.85rem;
  color: #94a3b8;
}
.divider {
  height: 1px;
  background: #2d3047;
  margin: 12px 0;
}
.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.9rem;
}
.label {
  color: #64748b;
}
.gold {
  color: var(--c-light);
  font-weight: bold;
}
.join-btn {
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
.joined {
  background: #334155;
  color: var(--c-on);
}
.card-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
  font-size: 0.8rem;
  color: #64748b;
  cursor: pointer;
}

/* 彈窗樣式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
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
.modal-subtitle {
  font-size: 0.85rem;
  color: #64748b;
}

.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}

.styled-select,
.styled-input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 12px;
  border-radius: 10px;
  font-size: 0.95rem;
  box-sizing: border-box;
}
.textarea {
  height: 60px;
  resize: none;
}
.input-wrapper {
  position: relative;
}
.input-suffix {
  position: absolute;
  right: 12px;
  top: 12px;
  color: var(--c-light);
  font-weight: bold;
}

.radio-card-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.radio-card-group.binary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
  padding: 8px;
  border-radius: 8px;
  text-align: center;
  font-size: 0.85rem;
  color: #94a3b8;
  transition: 0.2s;
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
.error-msg {
  color: #ef4444;
  font-size: 0.8rem;
  text-align: center;
  margin-top: 8px;
}

.card-tools {
  position: absolute;
  top: 5px;
  right: 15px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

/* 基礎按鈕：採用深色玻璃質感 */
.tool-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
  color: #94a3b8;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 備註按鈕 Hover：呈現專案主色調(紫色)的發光感 */
.tool-btn:hover {
  background: rgba(180, 110, 255, 0.15);
  border-color: #b46eff;
  color: #e2e8f0;
  box-shadow: 0 0 10px rgba(180, 110, 255, 0.3);
}

/* 撤單按鈕 Hover：呈現警告色(紅色) */
.tool-btn.del:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #fca5a5;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
}

/* 點擊時的反饋縮放 */
.tool-btn:active {
  transform: scale(0.95);
}

/* icon 化後 2 顆按鈕約 60px 寬,留小餘裕 */
.item-main {
  padding-right: 64px;
}

/* Modal 樣式保持原本邏輯但微調 */
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
.close-btn,
.modal-footer {
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

/* 4. 針對底部按鈕固定位置 */
.close-btn,
.modal-footer {
  flex-shrink: 0; /* 防止按鈕被壓縮 */
  margin-top: auto;
}
</style>

<!-- 新版開單彈窗：不用 scoped，因為 Teleport 到 body 外面 scoped 會失效 -->
<style>
.ot-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}
.ot-modal__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  /* ⚠ 故意不用 backdrop-filter，避免兩層 blur 造成合成延遲 */
}
.ot-modal__panel {
  position: relative;
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 16px;
  width: 100%;
  max-width: 460px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 28px 24px 24px;
  color: #f1f5f9;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
}
.ot-modal__close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}
.ot-modal__close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}
.ot-modal__head {
  text-align: center;
  margin-bottom: 18px;
}
.ot-modal__head h2 {
  margin: 0 0 4px;
  font-size: 1.3rem;
  color: #f8fafc;
  font-weight: 700;
}
.ot-modal__head p {
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
}
.ot-modal__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ot-field label {
  display: block;
  font-size: 0.82rem;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}
.ot-field select,
.ot-field textarea,
.ot-field input[type='number'],
.ot-field input[type='text']:not(.ss-input) {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.92rem;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s;
}
.ot-field select:focus,
.ot-field textarea:focus,
.ot-field input[type='number']:focus,
.ot-field input[type='text']:not(.ss-input):focus {
  border-color: #b46eff;
}
.ot-field textarea {
  height: 56px;
  resize: none;
  font-family: inherit;
}
.ot-input-wrap {
  position: relative;
}
.ot-suffix {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--c-light);
  font-weight: bold;
  font-size: 0.9rem;
  pointer-events: none;
}
.ot-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ot-chips--two {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.ot-chip {
  cursor: pointer;
  flex: 1;
  min-width: 0;
}
.ot-chip input {
  display: none;
}
.ot-chip span {
  display: block;
  background: #0f172a;
  border: 1px solid #334155;
  padding: 9px 8px;
  border-radius: 8px;
  text-align: center;
  font-size: 0.85rem;
  color: #94a3b8;
  transition: all 0.12s;
}
.ot-chip input:checked + span {
  border-color: #b46eff;
  background: rgba(180, 110, 255, 0.12);
  color: #fff;
}
.ot-error {
  color: #ef4444;
  font-size: 0.82rem;
  text-align: center;
  margin: 0;
}
.ot-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
.ot-btn {
  border: none;
  padding: 12px;
  border-radius: 10px;
  font-weight: bold;
  font-size: 0.95rem;
  cursor: pointer;
  transition: filter 0.15s, opacity 0.15s;
}
.ot-btn--cancel {
  flex: 1;
  background: #334155;
  color: #f1f5f9;
}
.ot-btn--cancel:hover {
  background: #475569;
}
.ot-btn--submit {
  flex: 2;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  color: var(--c-on);
}
.ot-btn--submit:hover:not(:disabled) {
  filter: brightness(1.08);
}
.ot-btn--submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 參與名單 Panel 變體 */
.ot-modal__panel--people {
  max-width: 400px;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}
.ot-people-list {
  list-style: none;
  padding: 0;
  margin: 0 0 14px 0;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}
.ot-people-list::-webkit-scrollbar {
  width: 6px;
}
.ot-people-list::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
.ot-people-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  background: #27293d;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.ot-people-item:hover {
  background: #2f3248;
}
.ot-people-name {
  font-size: 0.9rem;
  color: #f1f5f9;
  font-weight: 500;
}
.ot-people-time {
  font-size: 0.78rem;
  color: #94a3b8;
}

/* 新增道具 / 首領 Mini Panel 變體 */
.ot-modal__panel--mini {
  max-width: 360px;
}

/* === 快速開單 Panel === */
.ot-modal__panel--quick {
  max-width: 440px;
  display: flex;
  flex-direction: column;
  max-height: 86vh;
}
.qk-list {
  list-style: none;
  padding: 0;
  margin: 0 0 14px;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}
.qk-list::-webkit-scrollbar {
  width: 6px;
}
.qk-list::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
.qk-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 12px 14px;
  transition: border-color 0.15s;
}
.qk-item:hover {
  border-color: var(--c-light);
}
.qk-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.qk-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.qk-item-name {
  font-size: 0.98rem;
  font-weight: 800;
  color: #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qk-type {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
}
.qk-type.is-bid {
  background: rgba(180, 110, 255, 0.16);
  color: #c4a0ff;
  border: 1px solid rgba(180, 110, 255, 0.4);
}
.qk-type.is-fixed {
  background: rgba(34, 197, 94, 0.14);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.4);
}
.qk-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.82rem;
  color: #94a3b8;
  min-width: 0;
}
.qk-meta > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qk-price {
  flex-shrink: 0;
  color: var(--c-light);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.qk-remark {
  font-size: 0.78rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qk-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.qk-submit {
  height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  color: var(--c-on);
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
  transition: filter 0.15s, opacity 0.15s;
  font-family: inherit;
}
.qk-submit:hover:not(:disabled) {
  filter: brightness(1.1);
}
.qk-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.qk-remove {
  width: 30px;
  height: 40px;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
  font-family: inherit;
}
.qk-remove:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
}
.qk-remove:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.qk-empty {
  text-align: center;
  padding: 36px 16px;
  color: #94a3b8;
}
.qk-empty-icon {
  font-size: 2.2rem;
  display: block;
  margin-bottom: 10px;
}
.qk-empty p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}
.qk-close {
  width: 100%;
}

/* === 管理彈窗 (道具 / 首領) === */
.ot-mgmt {
  max-width: 440px;
}
.mgmt-add-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}
.mgmt-input {
  width: 100%;
  height: 46px;
  margin: 0;
  padding: 0 14px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  color: #f1f5f9;
  font-size: 1rem;
  line-height: 1;
  outline: none;
  box-sizing: border-box;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  font-family: inherit;
}
.mgmt-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.mgmt-input--inline {
  height: 36px;
  font-size: 0.92rem;
  border-radius: 8px;
}
.mgmt-add-btn {
  width: 100%;
  height: 44px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  box-shadow: 0 4px 14px rgba(var(--c-deep-rgb), 0.3);
}
.mgmt-add-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}
.mgmt-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mgmt-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 4px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.mgmt-list-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.mgmt-list-count {
  font-size: 0.78rem;
  color: #64748b;
}

.mgmt-list {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(15, 17, 26, 0.5);
}
.mgmt-list::-webkit-scrollbar {
  width: 6px;
}
.mgmt-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
}

.mgmt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.mgmt-row:last-child {
  border-bottom: none;
}
.mgmt-row:hover {
  background: rgba(255, 255, 255, 0.02);
}
.mgmt-name {
  flex: 1;
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mgmt-icon-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  font-family: inherit;
  box-sizing: border-box;
}
.mgmt-icon-btn.mgmt-edit:hover {
  background: rgba(var(--c-light-rgb), 0.12);
  border-color: rgba(var(--c-light-rgb), 0.4);
}
.mgmt-icon-btn.mgmt-del:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}
.mgmt-icon-btn.mgmt-confirm {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.4);
  color: #86efac;
  font-weight: 800;
}
.mgmt-icon-btn.mgmt-cancel {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: #94a3b8;
}

.mgmt-empty {
  padding: 24px 12px;
  text-align: center;
  color: #64748b;
  font-size: 0.85rem;
  font-style: italic;
}

.mgmt-close {
  width: 100%;
}
</style>
