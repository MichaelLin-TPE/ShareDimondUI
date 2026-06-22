<script setup lang="ts">
import { useAuction } from '@/composables/clanSetting.ts'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const {
  handleSave,
  handleSaveRate,
  handleUpdateBalance,
  // 拉霸機
  slotConfig,
  slotSaving,
  saveSlotConfig,
  // 骰寶
  diceEnabled,
  diceSaving,
  saveDiceConfig,
  settings,
  selectedCurrency,
  clanCurrencies,
  toggleCurrency,
  balance,
  balanceAction,
  balanceAmount,
  balanceRemark,
  // Discord
  discordWebhookUrl,
  discordSaving,
  discordTesting,
  saveDiscordWebhook,
  testDiscordWebhook,
  // 血盟改名
  clanNameInput,
  savingClanName,
  handleSaveClanName,
  // 血盟清 0
  resetting,
  handleResetClan,
} = useAuction()

// ───── 血盟清 0 防呆 ─────
const authStore = useAuthStore()
const clanName = computed(() => authStore.member?.clanName ?? '')
const showResetModal = ref(false)
const resetConfirmInput = ref('')
const resetConfirmMatched = computed(
  () => !!clanName.value && resetConfirmInput.value.trim() === clanName.value,
)

const openResetModal = () => {
  resetConfirmInput.value = ''
  showResetModal.value = true
}
const closeResetModal = () => {
  if (resetting.value) return
  showResetModal.value = false
}
const onConfirmReset = async () => {
  if (!resetConfirmMatched.value || resetting.value) return
  const ok = await handleResetClan(resetConfirmInput.value.trim())
  if (ok) {
    showResetModal.value = false
    // 清完後重新拉資料
    setTimeout(() => window.location.reload(), 800)
  }
}

// 給 dropdown 用的可選幣別清單：
// 1. 優先用後端 /clan-currencies 的資料（可區分 enabled/disabled）
// 2. 若還沒拿到，fallback 到 balance store 的 balanceList（讓畫面不會空白）
const enabledCurrencies = computed<{ currencyName: string }[]>(() => {
  if (clanCurrencies.value.length > 0) {
    return clanCurrencies.value
      .filter((c) => c.enabled)
      .map((c) => ({ currencyName: c.currencyName }))
  }
  return (balance.balanceList || []).map((b) => ({ currencyName: b.currency }))
})

// 拉霸機：彩金池抽水用「百分比」呈現給會長（後端存 0~0.1 小數）
const rakePercent = computed<number>({
  get: () => Math.round((slotConfig.value.rakeRate ?? 0) * 100),
  set: (v: number) => {
    slotConfig.value.rakeRate = (Number(v) || 0) / 100
  },
})
</script>

<template>
  <div class="cs-page">
    <!-- Header -->
    <header class="cs-header">
      <h1 class="cs-title">🛡️ 血盟設置</h1>
      <p class="cs-sub">管理公會核心規則、幣別與金庫</p>
    </header>

    <div class="cs-grid">
      <!-- ─── 血盟名稱 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">🏷️</span>
          <div>
            <h3>血盟名稱</h3>
            <p>會顯示在側邊欄、成員列表、登入頁與通知等所有地方</p>
          </div>
        </div>
        <div class="cs-input-wrap">
          <input
            v-model="clanNameInput"
            class="cs-input"
            maxlength="30"
            placeholder="輸入新的血盟名稱"
          />
        </div>
        <div class="cs-actions">
          <button
            class="cs-btn-primary"
            :disabled="savingClanName"
            @click="handleSaveClanName"
          >
            <span v-if="!savingClanName">💾 儲存血盟名稱</span>
            <span v-else>儲存中…</span>
          </button>
        </div>
      </section>

      <!-- ─── 公告 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">📢</span>
          <div>
            <h3>血盟公告</h3>
            <p>盟友登入後會看到的歡迎訊息</p>
          </div>
        </div>
        <textarea
          v-model="settings.announcement"
          placeholder="輸入想對盟友說的話..."
          class="cs-textarea"
          rows="4"
        ></textarea>
        <div class="cs-actions">
          <button class="cs-btn-primary" @click="handleSave">💾 儲存公告</button>
        </div>
      </section>

      <!-- ─── 競標規則 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">⚔️</span>
          <div>
            <h3>競標規則</h3>
            <p>調整參與時間、競標時長與分潤比例</p>
          </div>
        </div>

        <div class="cs-fields-2col">
          <div class="cs-field">
            <label>參與時間</label>
            <div class="cs-input-wrap">
              <input
                v-model.number="settings.participationMinutes"
                type="number"
                class="cs-input"
                min="1"
              />
              <span class="cs-suffix">分鐘</span>
            </div>
            <p class="cs-hint">開單後可參與「+1 分紅」的時間長度</p>
          </div>

          <div class="cs-field">
            <label>競標時間</label>
            <div class="cs-input-wrap">
              <input
                v-model.number="settings.auctionMinutes"
                type="number"
                class="cs-input"
                min="1"
              />
              <span class="cs-suffix">分鐘</span>
            </div>
            <p class="cs-hint">參與時間結束後，競標出價的時間</p>
          </div>

          <div class="cs-field">
            <label>血盟基金抽成</label>
            <div class="cs-input-wrap">
              <input
                v-model.number="settings.fundPercentage"
                type="number"
                class="cs-input"
                min="0"
                max="100"
              />
              <span class="cs-suffix">%</span>
            </div>
            <p class="cs-hint">每次分紅自動撥入血盟金庫的比例</p>
          </div>

          <div class="cs-field">
            <label>固定金額單得標方式</label>
            <div
              class="cs-toggle"
              :class="{ active: settings.autoDecideWinner }"
              @click="settings.autoDecideWinner = !settings.autoDecideWinner"
            >
              <div class="cs-toggle-track">
                <div class="cs-toggle-handle"></div>
              </div>
              <span class="cs-toggle-text">
                {{ settings.autoDecideWinner ? '🎲 系統自動決定' : '✋ 手動分配' }}
              </span>
            </div>
            <p class="cs-hint">
              {{
                settings.autoDecideWinner
                  ? '到時間後系統隨機抽出得標者'
                  : '會長/幹部手動指定得標者'
              }}
            </p>
          </div>
        </div>

        <div class="cs-actions">
          <button class="cs-btn-primary" @click="handleSave">💾 儲存競標規則</button>
        </div>
      </section>

      <!-- ─── 拉霸機設定 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">🎰</span>
          <div>
            <h3>拉霸機設定</h3>
            <p>玩家當莊，每注抽水進彩金池</p>
          </div>
        </div>

        <div class="cs-fields-2col">
          <div class="cs-field">
            <label>開放拉霸機</label>
            <div
              class="cs-toggle"
              :class="{ active: slotConfig.enabled }"
              @click="slotConfig.enabled = !slotConfig.enabled"
            >
              <div class="cs-toggle-track">
                <div class="cs-toggle-handle"></div>
              </div>
              <span class="cs-toggle-text">
                {{ slotConfig.enabled ? '🎰 已開放' : '🚫 已關閉' }}
              </span>
            </div>
            <p class="cs-hint">關閉後成員無法拉霸</p>
          </div>

          <div class="cs-field">
            <label>一次下注額</label>
            <div class="cs-input-wrap">
              <input v-model.number="slotConfig.betAmount" type="number" class="cs-input" min="1" />
              <span class="cs-suffix">{{ slotConfig.currency || '基準幣' }}</span>
            </div>
            <p class="cs-hint">每拉一次扣的金額</p>
          </div>

          <div class="cs-field">
            <label>彩金池抽水</label>
            <div class="cs-input-wrap">
              <input v-model.number="rakePercent" type="number" class="cs-input" min="0" max="10" />
              <span class="cs-suffix">%</span>
            </div>
            <p class="cs-hint">
              每注不論輸贏抽 {{ rakePercent }}% 進彩金池（供抽獎），其餘由玩家與莊家對賭（上限 10%）
            </p>
          </div>

          <div class="cs-field">
            <label>單次最高賠付</label>
            <div class="cs-input-wrap">
              <input v-model.number="slotConfig.maxPayout" type="number" class="cs-input" min="1" />
              <span class="cs-suffix">{{ slotConfig.currency || '基準幣' }}</span>
            </div>
            <p class="cs-hint">單次中獎賠付上限，封頂頭獎風險</p>
          </div>

          <div class="cs-field">
            <label>理論返還率 (RTP)</label>
            <div class="cs-input-wrap">
              <input
                :value="slotConfig.rtp ? (slotConfig.rtp * 100).toFixed(1) : '—'"
                type="text"
                class="cs-input"
                disabled
              />
              <span class="cs-suffix">%</span>
            </div>
            <p class="cs-hint">由賠率表決定（玩家長期拿回比例），不可調</p>
          </div>
        </div>

        <div class="cs-actions">
          <button class="cs-btn-primary" :disabled="slotSaving" @click="saveSlotConfig">
            {{ slotSaving ? '儲存中…' : '💾 儲存拉霸設定' }}
          </button>
        </div>
      </section>

      <!-- ─── 骰寶設定 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">🎲</span>
          <div>
            <h3>骰寶設定</h3>
            <p>猜點數遊戲。與拉霸<b>共用莊家與彩金池</b>，下注額/抽水/上限沿用上方拉霸設定</p>
          </div>
        </div>

        <div class="cs-fields-2col">
          <div class="cs-field">
            <label>開放骰寶</label>
            <div
              class="cs-toggle"
              :class="{ active: diceEnabled }"
              @click="diceEnabled = !diceEnabled"
            >
              <div class="cs-toggle-track">
                <div class="cs-toggle-handle"></div>
              </div>
              <span class="cs-toggle-text">
                {{ diceEnabled ? '🎲 已開放' : '🚫 已關閉' }}
              </span>
            </div>
            <p class="cs-hint">擲出豹子(三同)獨得整個彩金池</p>
          </div>
        </div>

        <div class="cs-actions">
          <button class="cs-btn-primary" :disabled="diceSaving" @click="saveDiceConfig">
            {{ diceSaving ? '儲存中…' : '💾 儲存骰寶設定' }}
          </button>
        </div>
      </section>

      <!-- ─── 幣別管理 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">💱</span>
          <div>
            <h3>幣別管理</h3>
            <p>啟用/關閉幣別，並設定基準幣與匯率</p>
          </div>
        </div>

        <!-- 幣別列表 -->
        <div class="cs-currency-list">
          <div
            v-for="item in clanCurrencies"
            :key="item.currencyName"
            class="cs-currency-item"
            :class="{ disabled: !item.enabled, base: item.baseCurrency }"
          >
            <div class="cs-currency-left">
              <span class="cs-currency-name">{{ item.currencyName }}</span>
              <span v-if="item.baseCurrency" class="cs-currency-badge base">基準</span>
              <span v-else-if="!item.enabled" class="cs-currency-badge off">已關閉</span>
              <span v-else class="cs-currency-badge on">啟用中</span>
            </div>
            <button
              class="cs-toggle-btn"
              :class="{ on: item.enabled, off: !item.enabled }"
              :disabled="item.baseCurrency"
              :title="item.baseCurrency ? '基準幣無法關閉，請先變更基準幣' : ''"
              @click="toggleCurrency(item)"
            >
              <span class="cs-toggle-dot"></span>
            </button>
          </div>

          <div v-if="clanCurrencies.length === 0" class="cs-empty">
            尚無幣別資料
          </div>
        </div>

        <div class="cs-divider"></div>

        <!-- 基準幣 + 匯率 -->
        <div class="cs-fields-2col">
          <div class="cs-field">
            <label>基準幣別</label>
            <select v-model="settings.baseCurrency" class="cs-input">
              <option v-for="c in enabledCurrencies" :key="c.currencyName" :value="c.currencyName">
                {{ c.currencyName }}
              </option>
            </select>
            <p class="cs-hint">作為計價單位的主要貨幣</p>
          </div>

          <div class="cs-field">
            <label>匯率</label>
            <div class="cs-rate-row">
              <span class="cs-rate-label">1 {{ settings.baseCurrency || '基準' }} =</span>
              <input
                v-model.number="settings.exchangeRate"
                type="number"
                class="cs-input cs-rate-input"
                min="1"
                placeholder="100"
              />
              <span class="cs-rate-label">其他幣別</span>
            </div>
            <p class="cs-hint">非基準幣兌換時的固定比例</p>
          </div>
        </div>

        <div class="cs-actions">
          <button class="cs-btn-primary" @click="handleSaveRate">💾 儲存幣別與匯率</button>
        </div>
      </section>

      <!-- ─── 金庫調整 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">🏦</span>
          <div>
            <h3>金庫調整</h3>
            <p>手動增減血盟金庫餘額（會記錄事件）</p>
          </div>
        </div>

        <div class="cs-fields-3col">
          <div class="cs-field">
            <label>選擇幣別</label>
            <select v-model="selectedCurrency" class="cs-input">
              <option value="" disabled>請選擇</option>
              <option v-for="c in enabledCurrencies" :key="c.currencyName" :value="c.currencyName">
                {{ c.currencyName }}
              </option>
            </select>
          </div>

          <div class="cs-field">
            <label>調整方式</label>
            <div class="cs-action-toggle">
              <button
                class="cs-action-btn"
                :class="{ active: balanceAction === 'add' }"
                @click="balanceAction = 'add'"
              >
                ➕ 增加
              </button>
              <button
                class="cs-action-btn minus"
                :class="{ active: balanceAction === 'minus' }"
                @click="balanceAction = 'minus'"
              >
                ➖ 扣除
              </button>
            </div>
          </div>

          <div class="cs-field">
            <label>金額</label>
            <div class="cs-input-wrap">
              <input
                v-model.number="balanceAmount"
                type="number"
                class="cs-input"
                min="1"
                placeholder="0"
              />
              <span class="cs-suffix">{{ selectedCurrency || '幣別' }}</span>
            </div>
          </div>
        </div>

        <div class="cs-field">
          <label>調整原因 <span class="cs-required">*</span></label>
          <input
            v-model="balanceRemark"
            type="text"
            class="cs-input"
            placeholder="例如：補入活動分紅、發獎勵等"
          />
        </div>

        <div class="cs-actions">
          <button class="cs-btn-primary" @click="handleUpdateBalance">💸 確認調整</button>
        </div>
      </section>

      <!-- ─── Discord 整合 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">💬</span>
          <div>
            <h3>Discord 推送</h3>
            <p>開單 / 結算 / 掛單 / 成交事件自動推到血盟 Discord 頻道</p>
          </div>
        </div>

        <div class="cs-field">
          <label>Webhook URL</label>
          <input
            v-model="discordWebhookUrl"
            type="text"
            class="cs-input"
            placeholder="https://discord.com/api/webhooks/..."
            spellcheck="false"
          />
          <p class="cs-hint">
            在 Discord 頻道設定 → 整合 → Webhook → 建立新 Webhook,複製 URL 貼上來
          </p>
        </div>

        <div class="cs-actions discord-actions">
          <button
            class="cs-btn-secondary"
            @click="testDiscordWebhook"
            :disabled="discordTesting || !discordWebhookUrl"
          >
            {{ discordTesting ? '測試中...' : '🧪 測試發送' }}
          </button>
          <button
            class="cs-btn-primary"
            @click="saveDiscordWebhook"
            :disabled="discordSaving"
          >
            {{ discordSaving ? '儲存中...' : '💾 儲存 Discord 設定' }}
          </button>
        </div>
      </section>

      <!-- ─── 危險區:血盟清 0 ─── -->
      <section class="cs-card cs-card--full cs-danger">
        <div class="cs-card-head">
          <span class="cs-card-icon">⚠️</span>
          <div>
            <h3 class="cs-danger-title">危險區 — 血盟清 0</h3>
            <p>把整個血盟還原到「剛成立」的狀態,只保留血盟與成員名單</p>
          </div>
        </div>

        <ul class="cs-danger-list">
          <li>所有幣別的金庫餘額歸 0 (含凍結餘額)</li>
          <li>所有成員錢包餘額歸 0 (含凍結與累積額)</li>
          <li>刪除所有 掛賣道具 / 競標單 / 提領審查單</li>
          <li>刪除所有事件 LOG / 操作紀錄 / 通知</li>
          <li>保留:血盟本身、成員名單、幣別設定、Boss/Treasure 設定</li>
        </ul>

        <p class="cs-danger-warn">
          ⚠️ 此操作無法復原,執行後所有交易記錄都會永久消失
        </p>

        <div class="cs-actions">
          <button class="cs-btn-danger" @click="openResetModal">
            🧨 血盟清 0
          </button>
        </div>
      </section>
    </div>

    <!-- 防呆 Modal -->
    <Teleport to="body">
      <div v-if="showResetModal" class="rc-modal">
        <div class="rc-modal__mask" @click="closeResetModal"></div>
        <div class="rc-modal__panel" role="dialog">
          <div class="rc-modal__icon">🧨</div>
          <h3 class="rc-modal__title">確認血盟清 0?</h3>
          <p class="rc-modal__sub">此操作無法復原,請務必確認</p>

          <div class="rc-modal__highlight">
            <div class="rc-modal__row">
              <span class="rc-modal__row-label">血盟名稱</span>
              <span class="rc-modal__row-val">{{ clanName }}</span>
            </div>
          </div>

          <ul class="rc-modal__list">
            <li>所有幣別金庫 & 成員錢包餘額歸 0</li>
            <li>掛賣 / 競標 / 審查單全部刪除</li>
            <li>所有 LOG / 事件紀錄全部刪除</li>
          </ul>

          <p class="rc-modal__hint">
            請輸入血盟名稱「<b>{{ clanName }}</b>」以確認:
          </p>
          <input
            v-model="resetConfirmInput"
            type="text"
            class="rc-modal__input"
            :class="{ ok: resetConfirmMatched }"
            :placeholder="clanName"
            spellcheck="false"
            @keyup.enter="onConfirmReset"
          />

          <div class="rc-modal__actions">
            <button
              class="rc-modal__btn cancel"
              :disabled="resetting"
              @click="closeResetModal"
            >
              取消
            </button>
            <button
              class="rc-modal__btn danger"
              :disabled="!resetConfirmMatched || resetting"
              @click="onConfirmReset"
            >
              {{ resetting ? '清 0 中...' : '確定清 0' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cs-page {
  padding: 32px 20px 48px;
  max-width: 980px;
  margin: 0 auto;
  color: #e2e8f0;
}

/* Header */
.cs-header {
  margin-bottom: 28px;
}
.cs-title {
  margin: 0 0 4px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--c-light);
  text-shadow:
    0 0 6px rgba(var(--c-light-rgb), 0.45),
    0 0 16px rgba(var(--c-deep-rgb), 0.35);
}
.cs-sub {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

/* Grid */
.cs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.cs-card--full {
  grid-column: 1 / -1;
}

/* Card */
.cs-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 18px;
  padding: 24px;
}
.cs-card-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.cs-card-icon {
  font-size: 1.6rem;
  filter: drop-shadow(0 0 6px rgba(var(--c-light-rgb), 0.45));
}
.cs-card-head h3 {
  margin: 0 0 2px;
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
}
.cs-card-head p {
  margin: 0;
  font-size: 0.78rem;
  color: #64748b;
}

/* Fields */
.cs-field {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}
.cs-field label {
  font-size: 0.85rem;
  color: #e2e8f0;
  margin-bottom: 6px;
  font-weight: 600;
}
.cs-required {
  color: #f87171;
}
.cs-fields-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 8px;
}
.cs-fields-3col {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

/* Inputs */
.cs-input,
.cs-textarea {
  width: 100%;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  padding: 0 14px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
  font-family: inherit;
  height: 44px;
  line-height: 42px;
}
.cs-input::placeholder,
.cs-textarea::placeholder {
  color: #475569;
}
.cs-input:focus,
.cs-textarea:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.cs-textarea {
  resize: none;
  margin-bottom: 14px;
  height: auto;
  min-height: 90px;
  line-height: 1.5;
  padding: 12px 14px;
}
select.cs-input {
  cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, #94a3b8 50%),
    linear-gradient(135deg, #94a3b8 50%, transparent 50%);
  background-position: calc(100% - 18px) center, calc(100% - 13px) center;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 32px;
}
.cs-input-wrap {
  position: relative;
}
.cs-suffix {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 600;
  pointer-events: none;
}
.cs-hint {
  margin: 4px 0 0;
  font-size: 0.7rem;
  color: #64748b;
  line-height: 1.4;
}

/* Toggle (open/manual) */
.cs-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 0 14px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  height: 44px;
  box-sizing: border-box;
}
.cs-toggle-track {
  width: 42px;
  height: 22px;
  background: #2e3147;
  border-radius: 100px;
  position: relative;
  transition: background 0.25s;
  flex-shrink: 0;
}
.cs-toggle.active .cs-toggle-track {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  box-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.35);
}
.cs-toggle-handle {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: left 0.25s;
}
.cs-toggle.active .cs-toggle-handle {
  left: 23px;
}
.cs-toggle-text {
  color: #e2e8f0;
  font-size: 0.85rem;
  font-weight: 600;
}

/* Currency list */
.cs-currency-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.cs-currency-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 12px;
  transition: all 0.15s;
}
.cs-currency-item.base {
  border-color: rgba(var(--c-light-rgb), 0.4);
  background: rgba(var(--c-light-rgb), 0.05);
}
.cs-currency-item.disabled {
  opacity: 0.55;
  background: #0a0c14;
}
.cs-currency-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cs-currency-name {
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.5px;
}
.cs-currency-item.disabled .cs-currency-name {
  text-decoration: line-through;
  color: #64748b;
}
.cs-currency-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.cs-currency-badge.base {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
}
.cs-currency-badge.on {
  background: rgba(var(--c-light-rgb), 0.14);
  color: var(--c-light);
  border: 1px solid rgba(var(--c-light-rgb), 0.4);
}
.cs-currency-badge.off {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

/* Toggle button (currency on/off) */
.cs-toggle-btn {
  width: 50px;
  height: 26px;
  border-radius: 100px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.25s;
  padding: 0;
}
.cs-toggle-btn.on {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  box-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.35);
}
.cs-toggle-btn.off {
  background: #3a3f5c;
}
.cs-toggle-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.cs-toggle-dot {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: left 0.25s;
}
.cs-toggle-btn.on .cs-toggle-dot {
  left: 27px;
}

.cs-empty {
  text-align: center;
  padding: 24px;
  color: #64748b;
  font-size: 0.85rem;
}

.cs-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 18px 0 18px;
}

/* Rate row */
.cs-rate-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cs-rate-label {
  color: #94a3b8;
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}
.cs-rate-input {
  flex: 1;
  text-align: center;
  font-weight: 700;
  color: var(--c-light);
  min-width: 0;
}

/* Action toggle (add/minus) — 用明確 height 確保按鈕一定在框內 */
.cs-action-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  padding: 3px;
  height: 44px;
  box-sizing: border-box;
  overflow: hidden;
}
.cs-action-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 36px; /* 44(總) - 2(border) - 6(padding) = 36，剛好填滿 */
  margin: 0;
  border: 0;
  outline: 0;
  border-radius: 7px;
  background: transparent;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
  line-height: 1;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
}
.cs-action-btn.active {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
}
.cs-action-btn.minus.active {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

/* Actions — 提交按鈕滿版 */
.cs-actions {
  margin-top: 18px;
}
.cs-btn-primary {
  width: 100%;
  height: 48px;
  padding: 0 24px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(var(--c-deep-rgb), 0.3);
  transition: all 0.2s;
  font-family: inherit;
}
.cs-btn-primary:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(var(--c-deep-rgb), 0.4);
}
.cs-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: none;
  transform: none;
}

/* Discord 設定區的 secondary 按鈕 (測試發送) */
.cs-btn-secondary {
  width: 100%;
  height: 48px;
  padding: 0 24px;
  border: 1px solid #2e3147;
  border-radius: 12px;
  background: transparent;
  color: #cbd5e1;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.18s;
  font-family: inherit;
}
.cs-btn-secondary:hover:not(:disabled) {
  border-color: var(--c-mid);
  color: #fff;
  background: rgba(var(--c-light-rgb), 0.08);
}
.cs-btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Discord actions: 兩顆按鈕並排 */
.cs-actions.discord-actions {
  display: flex;
  gap: 10px;
}
.cs-actions.discord-actions .cs-btn-secondary,
.cs-actions.discord-actions .cs-btn-primary {
  flex: 1;
}
@media (max-width: 600px) {
  .cs-actions.discord-actions {
    flex-direction: column;
  }
}

/* 危險區 */
.cs-card.cs-danger {
  border-color: rgba(239, 68, 68, 0.4);
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.06), rgba(22, 24, 34, 0.95) 60%);
}
.cs-danger-title {
  color: #f87171 !important;
  letter-spacing: 0.5px;
}
.cs-danger-list {
  margin: 0 0 14px;
  padding: 14px 18px 14px 32px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  color: #cbd5e1;
  font-size: 0.86rem;
  line-height: 1.7;
}
.cs-danger-list li::marker {
  color: #f87171;
}
.cs-danger-warn {
  margin: 0 0 4px;
  font-size: 0.82rem;
  color: #fca5a5;
  font-weight: 600;
  line-height: 1.5;
}
.cs-btn-danger {
  width: 100%;
  height: 48px;
  padding: 0 24px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.35);
  transition: all 0.2s;
  font-family: inherit;
}
.cs-btn-danger:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(239, 68, 68, 0.5);
}
.cs-btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: none;
  transform: none;
}

/* 防呆 Modal */
.rc-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.rc-modal__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(2px);
}
.rc-modal__panel {
  position: relative;
  background: #1a1f2e;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 20px;
  padding: 28px 24px 22px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 20px 60px rgba(239, 68, 68, 0.18), 0 20px 50px rgba(0, 0, 0, 0.6);
  text-align: center;
  animation: rc-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
}
@keyframes rc-pop {
  from { opacity: 0; transform: scale(0.92) translateY(8px); }
  to { opacity: 1; transform: scale(1); }
}
.rc-modal__icon {
  font-size: 2.4rem;
  margin-bottom: 6px;
}
.rc-modal__title {
  margin: 0 0 4px;
  font-size: 1.2rem;
  font-weight: 800;
  color: #f87171;
  letter-spacing: 1px;
}
.rc-modal__sub {
  margin: 0 0 14px;
  font-size: 0.8rem;
  color: #94a3b8;
}
.rc-modal__highlight {
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 12px;
  margin-bottom: 14px;
}
.rc-modal__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.88rem;
}
.rc-modal__row-label {
  color: #94a3b8;
}
.rc-modal__row-val {
  color: #fff;
  font-weight: 700;
  word-break: break-all;
}
.rc-modal__list {
  text-align: left;
  margin: 0 0 14px;
  padding: 10px 14px 10px 26px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.7;
}
.rc-modal__list li::marker {
  color: #f87171;
}
.rc-modal__hint {
  margin: 0 0 8px;
  font-size: 0.82rem;
  color: #cbd5e1;
  text-align: left;
}
.rc-modal__hint b {
  color: #f87171;
  font-weight: 800;
}
.rc-modal__input {
  width: 100%;
  height: 44px;
  background: #0f111a;
  border: 1.5px solid #2e3147;
  border-radius: 10px;
  padding: 0 14px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  margin-bottom: 16px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.rc-modal__input:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}
.rc-modal__input.ok {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}
.rc-modal__actions {
  display: flex;
  gap: 10px;
}
.rc-modal__btn {
  flex: 1;
  height: 44px;
  border: 0;
  border-radius: 12px;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.rc-modal__btn.cancel {
  background: #1e2233;
  color: #e2e8f0;
  border: 1px solid #3a3f5c;
}
.rc-modal__btn.cancel:hover:not(:disabled) {
  background: #2a2f44;
  color: #fff;
  border-color: #555a78;
}
.rc-modal__btn.danger {
  flex: 1.4;
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  color: #fff;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
}
.rc-modal__btn.danger:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(239, 68, 68, 0.5);
}
.rc-modal__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: none;
  transform: none;
}

/* RWD */
@media (max-width: 768px) {
  .cs-page { padding: 20px 12px 32px; }
  .cs-header { margin-left: 48px; }
  .cs-fields-2col,
  .cs-fields-3col {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .cs-card { padding: 18px 16px; }
}
</style>
