<script setup lang="ts">
import { useAuction } from '@/composables/createGuild.ts'
import { useRouter } from 'vue-router'

const {
  newCurrency,
  removeCurrency,
  addCurrency,
  submit,
  form,
  submitting,
  needExchangeRate,
  accountMode,
} = useAuction()
const router = useRouter()

const onCurrencyKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    addCurrency()
  }
}
</script>

<template>
  <div class="cg-page">
    <div class="cg-card">
      <!-- Header -->
      <div class="cg-header">
        <div class="cg-icon">🛡️</div>
        <h1 class="cg-title">建立你的血盟</h1>
        <p class="cg-sub">設定基本資訊與會長帳戶，三分鐘完成</p>
      </div>

      <!-- 帳號模式切換:建立新帳號 / 用現有帳號 -->
      <div class="cg-mode-tabs">
        <button
          type="button"
          class="cg-mode-btn"
          :class="{ active: accountMode === 'new' }"
          @click="accountMode = 'new'"
        >
          建立新帳號
        </button>
        <button
          type="button"
          class="cg-mode-btn"
          :class="{ active: accountMode === 'existing' }"
          @click="accountMode = 'existing'"
        >
          用現有帳號
        </button>
      </div>
      <p class="cg-mode-hint">
        {{
          accountMode === 'existing'
            ? '已經有帳號了?用現有帳號密碼直接開新血盟,不必再辦一個帳號'
            : '第一次使用?建立一個新帳號成為這個血盟的會長'
        }}
      </p>

      <!-- 雙欄表單區 -->
      <div class="cg-grid">
        <!-- 左欄：公會資訊 + 幣別 -->
        <div class="cg-col">
      <!-- Step 1: 公會基本資訊 -->
      <section class="cg-section">
        <div class="cg-section-head">
          <span class="cg-step">1</span>
          <h3>公會基本資訊</h3>
        </div>

        <div class="cg-field">
          <label>公會名稱 <span class="required">*</span></label>
          <input v-model="form.guildName" placeholder="例如：神聖血盟" class="cg-input" />
        </div>

        <div v-if="accountMode === 'new'" class="cg-field">
          <label>會長遊戲名稱 <span class="required">*</span></label>
          <input
            v-model="form.creatorGameName"
            placeholder="輸入會長的遊戲角色名稱"
            class="cg-input"
          />
          <p class="cg-hint">未來會以此名稱顯示於成員列表中</p>
        </div>
      </section>

      <!-- Step 2: 分紅幣別 -->
      <section class="cg-section">
        <div class="cg-section-head">
          <span class="cg-step">2</span>
          <h3>分紅幣別與匯率</h3>
        </div>

        <div class="cg-field">
          <label>新增幣別 <span class="required">*</span></label>
          <div class="cg-currency-input">
            <input
              v-model="newCurrency"
              placeholder="例如：元寶、天幣、寶石"
              class="cg-input"
              @keydown="onCurrencyKeydown"
            />
            <button type="button" class="cg-btn-add" @click="addCurrency">+ 新增</button>
          </div>
          <p class="cg-hint">至少新增一種，按 Enter 也可快速新增</p>
        </div>

        <!-- 已新增的幣別 -->
        <div v-if="form.currencies.length > 0" class="cg-currency-tags">
          <span
            v-for="(c, index) in form.currencies"
            :key="index"
            class="cg-tag"
            :class="{ base: c === form.baseCurrency }"
          >
            <span v-if="c === form.baseCurrency" class="cg-tag-badge">基準</span>
            {{ c }}
            <span class="cg-tag-x" @click="removeCurrency(index)">✕</span>
          </span>
        </div>

        <!-- 基準幣（多種幣才需要選） -->
        <div v-if="form.currencies.length >= 2" class="cg-field">
          <label>基準幣種 <span class="required">*</span></label>
          <div class="cg-base-grid">
            <label
              v-for="c in form.currencies"
              :key="c"
              class="cg-base-chip"
              :class="{ active: form.baseCurrency === c }"
            >
              <input v-model="form.baseCurrency" :value="c" type="radio" name="baseCurrency" />
              <span>{{ c }}</span>
            </label>
          </div>
          <p class="cg-hint">作為計價單位的主要貨幣（如：元寶）</p>
        </div>

        <!-- 匯率 -->
        <div v-if="needExchangeRate" class="cg-field">
          <label>匯率 <span class="required">*</span></label>
          <div class="cg-rate-row">
            <span class="cg-rate-label">1 {{ form.baseCurrency || '基準幣' }} =</span>
            <input
              v-model.number="form.exchangeRate"
              type="number"
              min="1"
              placeholder="100"
              class="cg-input cg-rate-input"
            />
            <span class="cg-rate-label">其他幣別</span>
          </div>
          <p class="cg-hint">
            例：1 {{ form.baseCurrency || '元寶' }} = 100 天幣，請輸入 <strong>100</strong>
          </p>
        </div>
      </section>
        </div>

        <!-- 右欄：會長帳戶 -->
        <div class="cg-col">
      <!-- Step 3: 會長帳戶 -->
      <section class="cg-section">
        <div class="cg-section-head">
          <span class="cg-step">3</span>
          <h3>會長帳戶</h3>
        </div>

        <div class="cg-field">
          <label>帳號 <span class="required">*</span></label>
          <input
            v-model="form.account"
            :placeholder="accountMode === 'existing' ? '輸入你現有的帳號' : '設定登入帳號'"
            class="cg-input"
            autocomplete="username"
          />
        </div>

        <div v-if="accountMode === 'new'" class="cg-field">
          <label>電子郵件 <span class="required">*</span></label>
          <input
            v-model="form.email"
            placeholder="example@mail.com"
            type="email"
            class="cg-input"
            autocomplete="email"
          />
          <p class="cg-hint">忘記密碼時會寄送重設連結到此信箱</p>
        </div>

        <div class="cg-field">
          <label>密碼 <span class="required">*</span></label>
          <input
            v-model="form.password"
            type="password"
            :placeholder="accountMode === 'existing' ? '輸入你現有的密碼' : '至少 6 碼'"
            class="cg-input"
            autocomplete="new-password"
          />
        </div>

        <div v-if="accountMode === 'new'" class="cg-field">
          <label>確認密碼 <span class="required">*</span></label>
          <input
            v-model="form.passwordConfirm"
            type="password"
            placeholder="再次輸入密碼"
            class="cg-input"
            :class="{
              'cg-input-error':
                form.passwordConfirm && form.password !== form.passwordConfirm,
            }"
            autocomplete="new-password"
          />
          <p
            v-if="form.passwordConfirm && form.password !== form.passwordConfirm"
            class="cg-hint cg-error"
          >
            兩次密碼不一致
          </p>
        </div>

        <p v-if="accountMode === 'existing'" class="cg-hint">
          用現有帳號開新血盟,你會直接成為這個血盟的會長,原本的血盟不受影響
        </p>

        <div class="cg-field">
          <label>推薦碼 <span class="optional">(可選)</span></label>
          <input
            v-model="form.referralCode"
            placeholder="若有推廣人提供的代碼,請填入"
            class="cg-input"
          />
          <p class="cg-hint">透過推廣人介紹建立可在此填入,沒有可空白</p>
        </div>
      </section>
        </div>
      </div>

      <!-- Submit -->
      <div class="cg-actions">
        <button type="button" class="cg-btn-cancel" @click="router.replace('/login')">
          返回登入
        </button>
        <button type="button" class="cg-btn-submit" :disabled="submitting" @click="submit">
          {{ submitting ? '建立中...' : '🛡️ 建立血盟' }}
        </button>
      </div>

      <p class="cg-tip">💡 公會公告可以在進入血盟後於「血盟設置」中編輯</p>
    </div>
  </div>
</template>

<style scoped>
.cg-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 24px;
  background: transparent;
}

.cg-card {
  width: 100%;
  max-width: 920px;
  padding: 36px 40px 32px;
  background: rgba(22, 24, 34, 0.95);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

/* 雙欄表單 */
.cg-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  margin-bottom: 8px;
}
.cg-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* === 統一設計變數 === */
/*
  字體階層: 1.5 / 1 / 0.95 / 0.85 / 0.78 rem
  顏色階層: #fff / #e2e8f0 / #94a3b8 / #64748b
  主色: var(--c-light) (金) + linear-gradient(135deg, var(--c-light), var(--c-deep))
*/

/* Header */
.cg-header {
  text-align: center;
  margin-bottom: 28px;
}
.cg-icon {
  font-size: 2.4rem;
  margin-bottom: 8px;
  filter: drop-shadow(0 0 10px rgba(var(--c-light-rgb), 0.5));
}
.cg-title {
  margin: 0 0 6px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.cg-sub {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

/* 帳號模式切換 — 父 48 / 子 38 / flex:1 1 0 */
.cg-mode-tabs {
  display: flex;
  height: 48px;
  padding: 5px;
  gap: 5px;
  margin: 0 auto;
  max-width: 360px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 12px;
  box-sizing: border-box;
}
.cg-mode-btn {
  flex: 1 1 0;
  height: 100%;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 700;
  font-family: inherit;
  letter-spacing: 0.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: all 0.15s;
}
.cg-mode-btn:hover {
  color: #e2e8f0;
}
.cg-mode-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
}
.cg-mode-hint {
  margin: 8px 0 20px;
  text-align: center;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.4;
}

/* Section */
.cg-section {
  background: rgba(15, 17, 26, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  padding: 20px 18px 18px;
}
.cg-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.cg-step {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-size: 0.78rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cg-section-head h3 {
  margin: 0;
  font-size: 1rem;
  color: #e2e8f0;
  font-weight: 700;
}

/* Fields */
.cg-field {
  margin-bottom: 14px;
}
.cg-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.85rem;
  color: #e2e8f0;
  font-weight: 600;
}
.required {
  color: #f87171;
  margin-left: 2px;
}
.optional {
  color: #64748b;
  font-weight: 500;
  font-size: 0.78rem;
  margin-left: 4px;
}

.cg-input {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.15s;
  box-sizing: border-box;
}
.cg-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.cg-input::placeholder {
  color: #475569;
}
.cg-input-error {
  border-color: #ef4444;
}
.cg-input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.cg-hint {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.4;
}
.cg-hint.cg-error {
  color: #f87171;
}
.cg-hint strong {
  color: var(--c-light);
}

/* Currency input + add button */
.cg-currency-input {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.cg-currency-input .cg-input {
  flex: 1;
  min-width: 0;
  margin: 0;
}
.cg-btn-add {
  height: 42px;
  padding: 0 18px;
  margin: 0;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(var(--c-deep-rgb), 0.25);
}
.cg-btn-add:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

/* Currency tags */
.cg-currency-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 16px;
}
.cg-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #1e2233;
  border: 1px solid #3a3f5c;
  border-radius: 20px;
  color: #e2e8f0;
  font-size: 0.85rem;
  font-weight: 600;
}
.cg-tag.base {
  background: rgba(var(--c-light-rgb), 0.1);
  border-color: rgba(var(--c-light-rgb), 0.4);
  color: var(--c-light);
}
.cg-tag-badge {
  font-size: 0.78rem;
  padding: 1px 6px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border-radius: 10px;
  font-weight: 800;
}
.cg-tag-x {
  cursor: pointer;
  color: #ff6c6c;
  font-size: 0.85rem;
  padding: 0 2px;
  transition: transform 0.15s;
}
.cg-tag-x:hover {
  transform: scale(1.2);
}

/* Base currency selector */
.cg-base-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cg-base-chip {
  cursor: pointer;
}
.cg-base-chip input {
  display: none;
}
.cg-base-chip span {
  display: inline-block;
  padding: 8px 16px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.15s;
}
.cg-base-chip input:checked + span {
  background: rgba(var(--c-light-rgb), 0.12);
  border-color: var(--c-light);
  color: var(--c-light);
}

/* Exchange rate */
.cg-rate-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cg-rate-label {
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
}
.cg-rate-input {
  flex: 1;
  text-align: center;
  font-weight: 700;
  color: var(--c-light);
  min-width: 0;
}

/* Actions — 兩顆按鈕同高同字級,只用顏色 + 寬度比區分主次 */
.cg-actions {
  display: flex;
  gap: 14px;
  margin-top: 24px;
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
}
.cg-btn-cancel,
.cg-btn-submit {
  height: 48px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.5px;
}
.cg-btn-cancel {
  flex: 1;
  background: #1e2233;
  border: 1px solid #3a3f5c;
  color: #e2e8f0;
}
.cg-btn-cancel:hover {
  background: #2a2f44;
  color: #fff;
  border-color: #555a78;
}
.cg-btn-submit {
  flex: 2;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  border: none;
  color: var(--c-on);
  font-weight: 800;
  box-shadow: 0 6px 20px rgba(var(--c-deep-rgb), 0.3);
}
.cg-btn-submit:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(var(--c-deep-rgb), 0.4);
}
.cg-btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cg-tip {
  margin: 16px 0 0;
  text-align: center;
  font-size: 0.78rem;
  color: #64748b;
}

/* RWD */
@media (max-width: 768px) {
  .cg-card {
    padding: 28px 22px 24px;
  }
  .cg-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .cg-actions {
    max-width: none;
  }
}
@media (max-width: 480px) {
  .cg-page {
    padding: 24px 12px;
  }
  .cg-card {
    padding: 24px 16px 20px;
  }
  .cg-title {
    font-size: 1.25rem;
  }
  .cg-rate-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .cg-rate-label {
    text-align: center;
    font-size: 0.78rem;
  }
}
</style>
