<script setup lang="ts">
// 神盾天堂預約創角(使用者 2026-10-03)。
// 桌機:照遊戲客戶端的創角畫面(CreateUI.xml 的座標與原圖)在 800x600 的舞台上重現,舞台整個等比縮放。
// 手機:800x600 縮到手機寬度按鈕會小到按不到,改用直式排版,圖與規則完全相同。
// 規則(初始值、上限、可分配點數)由後端給;初期能力值獎勵是遊戲伺服器的實際數值(src/data/aegis/prereg.ts)。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AgPage from './ui/AgPage.vue'
import { AG_CLASSES } from '@/data/aegis/classes'
import { BONUS_LABELS, BONUS_TABLE, CLASS_INTRO, CLASS_PRESETS, GAUGE_LABELS, GAUGE_TABLE } from '@/data/aegis/prereg'
import {
  ApiError, changePassword, checkLogin, checkName, createCharacter, deleteCharacter, fetchRules, fetchStats,
  login, logout, register, restoreSession, session, type Rules,
} from './prereg/api'

const UI = '/aegis/prereg/ui/'
const CLS_NAMES = ['君主', '騎士', '妖精', '法師', '黑暗妖精']
const STAT_LATIN = ['STR', 'DEX', 'CON', 'WIS', 'CHA', 'INT']

const rules = ref<Rules | null>(null)
const totalAccounts = ref<number | null>(null)
const loadError = ref('')

// ---------- 登入 / 註冊 ----------
const authMode = ref<'register' | 'login'>('register')
const fLogin = ref('')
const fPassword = ref('')
const fPassword2 = ref('')
const authBusy = ref(false)
const authError = ref('')
const loginHint = ref<{ ok: boolean; message: string } | null>(null)
let loginTimer = 0

watch([fLogin, authMode], () => {
  loginHint.value = null
  window.clearTimeout(loginTimer)
  if (authMode.value !== 'register' || fLogin.value.trim().length < 4) return
  const v = fLogin.value
  loginTimer = window.setTimeout(async () => {
    try {
      const r = await checkLogin(v)
      if (v === fLogin.value) loginHint.value = r
    } catch { /* 即時提示失敗不擋人,送出時後端還會再驗 */ }
  }, 450)
})

async function submitAuth() {
  authError.value = ''
  if (authMode.value === 'register' && fPassword.value !== fPassword2.value) {
    authError.value = '兩次輸入的密碼不一樣'
    return
  }
  authBusy.value = true
  try {
    if (authMode.value === 'register') await register(fLogin.value, fPassword.value)
    else await login(fLogin.value, fPassword.value)
    fPassword.value = ''
    fPassword2.value = ''
  } catch (e) {
    authError.value = e instanceof ApiError ? e.message : '發生錯誤,請稍後再試'
  } finally {
    authBusy.value = false
  }
}

// ---------- 創角 ----------
const step = ref(1)
const cls = ref(0)
const sex = ref(0)
const stats = ref<number[]>([0, 0, 0, 0, 0, 0])
const charName = ref('')
const nameHint = ref<{ ok: boolean; message: string } | null>(null)
const createBusy = ref(false)
const createError = ref('')
const showIntro = ref(false)
let nameTimer = 0

const rule = computed(() => rules.value?.classes[cls.value] ?? null)
const remain = computed(() => (rules.value ? rules.value.statTotal - stats.value.reduce((a, b) => a + b, 0) : 0))
const bgSrc = computed(() => `/aegis/prereg/bg/${cls.value}_${sex.value}.jpg`)
/** 官網職業介紹的那一句定位(官網的順序是 君主 騎士 妖精 法師 黑妖,跟遊戲的職業編號一致) */
const roleLine = computed(() => AG_CLASSES[cls.value]?.role ?? '')
const roleDesc = computed(() => AG_CLASSES[cls.value]?.desc ?? '')

function resetStats() {
  if (rule.value) stats.value = rule.value.base.slice()
}
watch([cls, rules], resetStats, { immediate: true })

function inc(i: number) {
  if (!rule.value || remain.value <= 0) return
  if ((stats.value[i] ?? 0) >= (rule.value.cap[i] ?? 0)) return
  stats.value = stats.value.map((v, k) => (k === i ? v + 1 : v))
}
function dec(i: number) {
  if (!rule.value) return
  if ((stats.value[i] ?? 0) <= (rule.value.base[i] ?? 0)) return
  stats.value = stats.value.map((v, k) => (k === i ? v - 1 : v))
}
function applyPreset(k: number) {
  const p = CLASS_PRESETS[cls.value]?.[k]
  if (p) stats.value = p.slice()
}

/** 16 項初期能力值獎勵:每一項由一個(負重是兩個)能力值決定,看它比初始多了幾點 */
const bonusValues = computed(() => {
  const table = BONUS_TABLE[cls.value]
  const base = rule.value?.base
  if (!table || !base) return BONUS_LABELS.map(() => 0)
  return table.map((parts) =>
    parts.reduce((sum, p) => {
      const extra = Math.max(0, (stats.value[p.stat] ?? 0) - (base[p.stat] ?? 0))
      return sum + (p.values[Math.min(p.values.length - 1, extra)] ?? 0)
    }, 0),
  )
})
/** 五條量表(0~100) */
const gauges = computed(() => {
  const table = GAUGE_TABLE[cls.value]
  if (!table) return GAUGE_LABELS.map(() => 0)
  return table.map((g) => g.values[Math.max(0, Math.min(g.values.length - 1, (stats.value[g.stat] ?? 7) - 7))] ?? 0)
})

watch(charName, () => {
  nameHint.value = null
  createError.value = ''
  window.clearTimeout(nameTimer)
  const v = charName.value
  if (!v.trim()) return
  nameTimer = window.setTimeout(async () => {
    try {
      const r = await checkName(v)
      if (v === charName.value) nameHint.value = r
    } catch { /* 送出時後端還會再驗 */ }
  }, 450)
})

const canCreate = computed(() => remain.value === 0 && charName.value.trim().length > 0 && nameHint.value?.ok !== false)

async function submitCharacter() {
  createError.value = ''
  if (remain.value !== 0) {
    createError.value = `還有 ${remain.value} 點能力值沒有分配`
    return
  }
  if (!charName.value.trim()) {
    createError.value = '請輸入角色名字'
    return
  }
  createBusy.value = true
  try {
    await createCharacter(charName.value, cls.value, sex.value, stats.value)
    step.value = 1
    charName.value = ''
  } catch (e) {
    createError.value = e instanceof ApiError ? e.message : '發生錯誤,請稍後再試'
  } finally {
    createBusy.value = false
  }
}

// ---------- 已預約 ----------
const confirmDelete = ref(false)
const manageBusy = ref(false)
const manageError = ref('')
const showPwd = ref(false)
const pOld = ref('')
const pNew = ref('')
const pwdMsg = ref('')

async function doDelete() {
  manageBusy.value = true
  manageError.value = ''
  try {
    await deleteCharacter()
    confirmDelete.value = false
  } catch (e) {
    manageError.value = e instanceof ApiError ? e.message : '發生錯誤,請稍後再試'
  } finally {
    manageBusy.value = false
  }
}
async function doChangePassword() {
  pwdMsg.value = ''
  manageBusy.value = true
  try {
    await changePassword(pOld.value, pNew.value)
    pOld.value = ''
    pNew.value = ''
    pwdMsg.value = '密碼已更新,其他裝置需要重新登入'
  } catch (e) {
    pwdMsg.value = e instanceof ApiError ? e.message : '發生錯誤,請稍後再試'
  } finally {
    manageBusy.value = false
  }
}

// ---------- 舞台縮放 ----------
const wrapEl = ref<HTMLElement | null>(null)
const wrapWidth = ref(800)
let ro: ResizeObserver | null = null
const narrow = computed(() => wrapWidth.value < 640)
const viewH = ref(typeof window === 'undefined' ? 900 : window.innerHeight)
/** 舞台盡量大,但整個要放得進一個畫面(不然下面的按鈕要捲動才看得到) */
const scale = computed(() => Math.max(0.75, Math.min(1.3, wrapWidth.value / 800, (viewH.value - 130) / 600)))
const onResize = () => (viewH.value = window.innerHeight)

function watchWidth() {
  ro?.disconnect()
  if (!wrapEl.value) return
  wrapWidth.value = wrapEl.value.clientWidth
  ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width
    if (w) wrapWidth.value = w
  })
  ro.observe(wrapEl.value)
}
watch(wrapEl, watchWidth)

onMounted(async () => {
  window.addEventListener('resize', onResize)
  try {
    const [r] = await Promise.all([fetchRules(), restoreSession()])
    rules.value = r
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : '載入失敗,請重新整理'
  }
  fetchStats().then((s) => (totalAccounts.value = s.accounts)).catch(() => {})
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  ro?.disconnect()
  window.clearTimeout(loginTimer)
  window.clearTimeout(nameTimer)
})
</script>

<template>
  <AgPage eyebrow="PRE-REGISTER // 預約創角" title="先把名字佔下來。" sub="開服那天,你的角色已經在了。"
    lead="現在辦帳號、創角色,開服直接登入就能玩。預約期間用同一個帳號還能玩天堂塔防,排行前面的開服有獎。">
    <section class="ag-section">
      <div class="ag-wrap">
        <p v-if="loadError" class="pr-msg bad">{{ loadError }}</p>
        <p v-else-if="!rules || !session.ready" class="pr-msg">載入中…</p>

        <!-- 還沒登入:辦帳號 / 登入 -->
        <div v-else-if="!session.token" class="pr-auth">
          <div class="pr-card">
            <div class="pr-tabs">
              <button type="button" :class="{ on: authMode === 'register' }" @click="authMode = 'register'">辦新帳號</button>
              <button type="button" :class="{ on: authMode === 'login' }" @click="authMode = 'login'">已經有帳號</button>
            </div>
            <form class="pr-form" @submit.prevent="submitAuth">
              <label>
                <span>帳號</span>
                <input v-model="fLogin" type="text" autocomplete="username" :maxlength="rules.loginMax" autocapitalize="off" spellcheck="false" />
                <small v-if="authMode === 'register'">{{ rules.loginMin }}~{{ rules.loginMax }} 個字,只能用英文和數字。這就是你開服後登入遊戲的帳號。</small>
                <small v-if="loginHint" :class="loginHint.ok ? 'good' : 'bad'">{{ loginHint.message }}</small>
              </label>
              <label>
                <span>密碼</span>
                <input v-model="fPassword" type="password" :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'" :maxlength="rules.passwordMax" />
                <small v-if="authMode === 'register'">{{ rules.passwordMin }}~{{ rules.passwordMax }} 個字,英文、數字和 ! _ = + - ? . # 可以用。</small>
              </label>
              <label v-if="authMode === 'register'">
                <span>再輸入一次密碼</span>
                <input v-model="fPassword2" type="password" autocomplete="new-password" :maxlength="rules.passwordMax" />
              </label>
              <p v-if="authError" class="pr-msg bad">{{ authError }}</p>
              <button class="ag-btn primary" type="submit" :disabled="authBusy">
                {{ authBusy ? '處理中…' : authMode === 'register' ? '建立帳號' : '登入' }} <span class="arr">→</span>
              </button>
            </form>
          </div>
          <div class="pr-side">
            <div class="ag-cap ember">// 預約須知</div>
            <ul>
              <li>一個帳號預約一隻角色,職業、性別、能力值現在就定下來。</li>
              <li>角色名字先搶先贏,全服不能重複。</li>
              <li>同一個網路最多預約 {{ rules.accountsPerIp }} 個帳號。</li>
              <li>忘記密碼沒辦法自己重設,請找客服。</li>
              <li>有帳號就能玩天堂塔防,不用先創角。</li>
            </ul>
            <p v-if="totalAccounts !== null" class="pr-count">目前已有 <b>{{ totalAccounts }}</b> 個帳號預約</p>
          </div>
        </div>

        <!-- 已登入、還沒有角色:創角 -->
        <div v-else-if="!session.character">
          <div class="pr-bar">
            <span>帳號 <b>{{ session.login }}</b></span>
            <span class="sp"></span>
            <RouterLink class="lnk" to="/aegis/td">先去玩塔防</RouterLink>
            <button type="button" class="lnk" @click="logout">登出</button>
          </div>

          <div ref="wrapEl" class="pr-wrap">
            <!-- ========== 桌機:照客戶端的 800x600 創角畫面 ========== -->
            <div v-if="!narrow" class="pr-stage-box" :style="{ height: 600 * scale + 'px' }">
              <div class="pr-stage" :style="{ transform: `scale(${scale})` }">
                <Transition name="pr-fade"><img :key="bgSrc" class="bg" :src="bgSrc" alt="" /></Transition>

                <template v-if="step === 1">
                  <div class="st-title">創立角色<small>選擇職業與性別</small></div>
                  <div class="st-clsname">{{ CLS_NAMES[cls] }}</div>
                  <div class="st-role">{{ roleLine }}</div>
                  <div class="st-desc">{{ roleDesc }}</div>
                  <button type="button" class="st-sex" :class="{ on: sex === 0 }" style="left: 148px; top: 326px" aria-label="男" @click="sex = 0">
                    <img :src="UI + (sex === 0 ? 'male_down.png' : 'male.png')" alt="" /><span>男</span>
                  </button>
                  <button type="button" class="st-sex" :class="{ on: sex === 1 }" style="left: 220px; top: 326px" aria-label="女" @click="sex = 1">
                    <img :src="UI + (sex === 1 ? 'female_down.png' : 'female.png')" alt="" /><span>女</span>
                  </button>
                  <button type="button" class="st-link" style="left: 60px; top: 418px" @click="showIntro = true">看{{ CLS_NAMES[cls] }}的完整介紹</button>
                  <button v-for="(n, i) in CLS_NAMES" :key="n" type="button" class="st-cls" :class="{ on: cls === i }"
                    :style="{ left: 217 + i * 73 + 'px', top: '486px' }" @click="cls = i">
                    <img :src="`${UI}cls${i}${cls === i ? '_on' : ''}.png`" alt="" /><span>{{ n }}</span>
                  </button>
                  <button type="button" class="st-img" style="left: 690px; top: 535px" aria-label="下一步" @click="step = 2">
                    <img :src="UI + 'next.png'" alt="下一步" />
                  </button>
                </template>

                <template v-else-if="rule">
                  <div class="st-dim"></div>
                  <div class="st-title">創立角色<small>分配能力值、取名字</small></div>

                  <img class="st-abs" :src="UI + 'panel_stat.png'" style="left: 8px; top: 90px" alt="" />
                  <div class="st-ptitle" style="left: 8px; top: 114px; width: 383px">{{ CLS_NAMES[cls] }}的能力</div>
                  <button v-for="k in 3" :key="k" type="button" class="st-preset" :style="{ left: 31 + (k - 1) * 116 + 'px', top: '149px' }" @click="applyPreset(k - 1)">建議配點 {{ k }}</button>
                  <template v-for="(g, i) in gauges" :key="'g' + i">
                    <div class="st-glabel" :style="{ top: 204 + i * 22 + 'px' }">{{ GAUGE_LABELS[i] }}</div>
                    <div class="st-gauge" :style="{ top: 204 + i * 22 + 'px', width: Math.round(1.81 * g) + 'px' }"></div>
                  </template>
                  <template v-for="i in 6" :key="'s' + i">
                    <div class="st-statname" :class="i <= 3 ? 'l' : 'r'" :style="{ top: 329 + ((i - 1) % 3) * 20 + 'px' }">{{ rules.statNames[i - 1] }}</div>
                    <div class="st-val" :style="{ left: (i <= 3 ? 116 : 263) + 'px', top: 347 + ((i - 1) % 3) * 20 + 'px' }">{{ stats[i - 1] }}</div>
                    <button type="button" class="st-pm" :style="{ left: (i <= 3 ? 138 : 225) + 'px', top: 350 + ((i - 1) % 3) * 20 + 'px' }"
                      :disabled="(stats[i - 1] ?? 0) <= (rule.base[i - 1] ?? 0)" :aria-label="rules.statNames[i - 1] + '減一'" @click="dec(i - 1)">
                      <img :src="UI + 'minus.png'" alt="" />
                    </button>
                    <button type="button" class="st-pm" :style="{ left: (i <= 3 ? 160 : 247) + 'px', top: 350 + ((i - 1) % 3) * 20 + 'px' }"
                      :disabled="remain <= 0 || (stats[i - 1] ?? 0) >= (rule.cap[i - 1] ?? 0)" :aria-label="rules.statNames[i - 1] + '加一'" @click="inc(i - 1)">
                      <img :src="UI + 'plus.png'" alt="" />
                    </button>
                  </template>
                  <div class="st-remain" :class="{ zero: remain === 0 }">{{ remain }}</div>
                  <button type="button" class="st-btn2" style="left: 54px; top: 443px" @click="showIntro = true">職業說明</button>
                  <button type="button" class="st-btn2" style="left: 208px; top: 443px" @click="resetStats">重新分配</button>

                  <img class="st-abs" :src="UI + 'panel_bonus.png'" style="left: 386px; top: 90px" alt="" />
                  <div class="st-ptitle" style="left: 386px; top: 114px; width: 406px">初期能力值獎勵</div>
                  <template v-for="(label, i) in BONUS_LABELS" :key="label">
                    <div class="st-blabel" :style="{ left: (i % 2 === 0 ? 428 : 608) + 'px', top: 150 + Math.floor(i / 2) * 22 + 'px' }">{{ label }}</div>
                    <div class="st-bval" :class="{ has: (bonusValues[i] ?? 0) > 0 }" :style="{ left: (i % 2 === 0 ? 542 : 720) + 'px', top: 151 + Math.floor(i / 2) * 22 + 'px' }">
                      {{ (bonusValues[i] ?? 0) > 0 ? '+' + bonusValues[i] : 0 }}
                    </div>
                  </template>

                  <img class="st-abs" :src="UI + 'namebox.png'" style="left: 193px; top: 536px" alt="" />
                  <input v-model="charName" class="st-name" type="text" maxlength="12" placeholder="輸入角色名字" spellcheck="false" />
                  <div class="st-hint" :class="createError || nameHint?.ok === false ? 'bad' : 'good'">{{ createError || nameHint?.message || '' }}</div>
                  <button type="button" class="st-img" style="left: 14px; top: 535px" aria-label="上一步" @click="step = 1">
                    <img :src="UI + 'back.png'" alt="上一步" />
                  </button>
                  <button type="button" class="st-btn" style="left: 636px; top: 535px" :disabled="createBusy || !canCreate" @click="submitCharacter">
                    {{ createBusy ? '處理中…' : '確認預約' }}
                  </button>
                </template>

                <!-- 職業說明(客戶端原文) -->
                <div v-if="showIntro" class="st-modal" @click.self="showIntro = false">
                  <div class="st-msg">
                    <img :src="UI + 'panel_msg.png'" alt="" />
                    <div class="st-msg-body">
                      <h4>{{ CLS_NAMES[cls] }}</h4>
                      <p v-for="(p, i) in CLASS_INTRO[cls]" :key="i">{{ p }}</p>
                    </div>
                    <button type="button" class="st-btn" style="left: 154px; top: 244px" @click="showIntro = false">關閉</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- ========== 手機:直式排版,規則與圖相同 ========== -->
            <div v-else-if="rule" class="pm">
              <div class="pm-hero" :style="{ backgroundImage: `url(${bgSrc})` }">
                <div class="pm-hero-txt">
                  <div class="n">{{ CLS_NAMES[cls] }}</div>
                  <div class="r">{{ roleLine }}</div>
                </div>
              </div>
              <div class="pm-row cls">
                <button v-for="(n, i) in CLS_NAMES" :key="n" type="button" :class="{ on: cls === i }" @click="cls = i">
                  <img :src="`${UI}cls${i}${cls === i ? '_on' : ''}.png`" alt="" /><span>{{ n }}</span>
                </button>
              </div>
              <div class="pm-row sex">
                <button type="button" :class="{ on: sex === 0 }" @click="sex = 0"><img :src="UI + (sex === 0 ? 'male_down.png' : 'male.png')" alt="" />男</button>
                <button type="button" :class="{ on: sex === 1 }" @click="sex = 1"><img :src="UI + (sex === 1 ? 'female_down.png' : 'female.png')" alt="" />女</button>
              </div>
              <p class="pm-desc">{{ roleDesc }} <button type="button" class="lnk" @click="showIntro = !showIntro">{{ showIntro ? '收起介紹' : '完整介紹' }}</button></p>
              <div v-if="showIntro" class="pm-intro"><p v-for="(p, i) in CLASS_INTRO[cls]" :key="i">{{ p }}</p></div>

              <div class="pm-box">
                <div class="pm-head">能力值 <b :class="{ zero: remain === 0 }">剩 {{ remain }} 點</b></div>
                <div v-for="i in 6" :key="i" class="pm-stat">
                  <span class="nm">{{ rules.statNames[i - 1] }}<i>{{ STAT_LATIN[i - 1] }}</i></span>
                  <button type="button" :disabled="(stats[i - 1] ?? 0) <= (rule.base[i - 1] ?? 0)" :aria-label="rules.statNames[i - 1] + '減一'" @click="dec(i - 1)">−</button>
                  <b>{{ stats[i - 1] }}</b>
                  <button type="button" :disabled="remain <= 0 || (stats[i - 1] ?? 0) >= (rule.cap[i - 1] ?? 0)" :aria-label="rules.statNames[i - 1] + '加一'" @click="inc(i - 1)">+</button>
                  <span class="cap">最高 {{ rule.cap[i - 1] }}</span>
                </div>
                <div class="pm-presets">
                  <button v-for="k in 3" :key="k" type="button" @click="applyPreset(k - 1)">建議配點 {{ k }}</button>
                  <button type="button" @click="resetStats">重新分配</button>
                </div>
              </div>

              <div class="pm-box">
                <div class="pm-head">初期能力值獎勵</div>
                <div class="pm-bonus">
                  <template v-for="(label, i) in BONUS_LABELS" :key="label">
                    <div v-if="(bonusValues[i] ?? 0) > 0"><span>{{ label }}</span><b>+{{ bonusValues[i] }}</b></div>
                  </template>
                  <p v-if="!bonusValues.some((v) => v > 0)">把點數加上去,這裡會列出額外拿到的加成。</p>
                </div>
              </div>

              <div class="pm-box">
                <div class="pm-head">角色名字</div>
                <input v-model="charName" class="pm-name" type="text" maxlength="12" placeholder="中文最多 6 個字" spellcheck="false" />
                <p class="pm-hint" :class="createError || nameHint?.ok === false ? 'bad' : 'good'">{{ createError || nameHint?.message || '' }}</p>
                <button class="ag-btn primary pm-go" type="button" :disabled="createBusy || !canCreate" @click="submitCharacter">
                  {{ createBusy ? '處理中…' : '確認預約' }} <span class="arr">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 已經預約好了 -->
        <div v-else class="pr-done">
          <div class="pr-hero" :style="{ backgroundImage: `url(/aegis/prereg/bg/${session.character.cls}_${session.character.sex}.jpg)` }">
            <div class="pr-hero-in">
              <div class="ag-cap ember">// 預約完成</div>
              <div class="nm">{{ session.character.name }}</div>
              <div class="cl">{{ session.character.clsName }} · {{ session.character.sex === 0 ? '男' : '女' }}</div>
              <div class="st">
                <span v-for="(v, i) in session.character.stats" :key="i">{{ rules.statNames[i] }} <b>{{ v }}</b></span>
              </div>
            </div>
          </div>
          <div class="pr-acts">
            <p class="ag-body">開服當天用帳號 <b>{{ session.login }}</b> 登入遊戲,這隻角色就在選角畫面裡。</p>
            <div class="row">
              <RouterLink class="ag-btn primary" to="/aegis/td">玩天堂塔防 <span class="arr">→</span></RouterLink>
              <button class="ag-btn" type="button" @click="showPwd = !showPwd">修改密碼</button>
              <button class="ag-btn" type="button" @click="confirmDelete = true">刪掉重創</button>
              <button class="ag-btn" type="button" @click="logout">登出</button>
            </div>
            <form v-if="showPwd" class="pr-form inline" @submit.prevent="doChangePassword">
              <label><span>目前的密碼</span><input v-model="pOld" type="password" autocomplete="current-password" :maxlength="rules.passwordMax" /></label>
              <label><span>新密碼</span><input v-model="pNew" type="password" autocomplete="new-password" :maxlength="rules.passwordMax" /></label>
              <button class="ag-btn" type="submit" :disabled="manageBusy">更新密碼</button>
              <p v-if="pwdMsg" class="pr-msg">{{ pwdMsg }}</p>
            </form>
            <div v-if="confirmDelete" class="pr-confirm">
              <p>刪掉之後「{{ session.character.name }}」這個名字會放出來,別人可以拿去用。確定要刪掉重創嗎?</p>
              <div class="row">
                <button class="ag-btn primary" type="button" :disabled="manageBusy" @click="doDelete">確定刪除</button>
                <button class="ag-btn" type="button" @click="confirmDelete = false">先不要</button>
              </div>
              <p v-if="manageError" class="pr-msg bad">{{ manageError }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.pr-auth button, .pr-bar button, .pm button, .pr-done button { box-sizing: border-box; text-align: center; }
/* 同一個重設也把 input 的 box-sizing 洗成 content-box,寬度 100% 加上內距會超出外框 */
.pr-form input, .pm-name { box-sizing: border-box; }

/* 官網的共用重設(.ag-root button { all: unset })權重比 .ag-btn 高,用在 <button> 上會整個被洗掉,這裡補回來 */
button.ag-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px; box-sizing: border-box; height: 44px; padding: 0 22px;
  font-size: 12.5px; font-weight: 500; letter-spacing: 0.14em; color: var(--ag-ink); border: 1px solid var(--ag-line); white-space: nowrap; cursor: pointer;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
  transition: border-color 0.2s, box-shadow 0.2s;
}
button.ag-btn:hover { border-color: var(--ag-ink); }
button.ag-btn.primary { background: var(--ag-ember); border-color: var(--ag-ember); color: #120800; font-weight: 600; }
button.ag-btn.primary:hover { box-shadow: 0 0 28px var(--ag-ember-glow); }
button.ag-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
.pr-msg { color: var(--ag-ink-72); font-size: 15px; }
.pr-msg.bad, .bad { color: #ff8f7a; }
.good { color: #9fe0a8; }
.lnk { color: var(--ag-ember); font-size: 14px; cursor: pointer; background: none; border: 0; padding: 0; font-family: inherit; text-decoration: underline; text-underline-offset: 3px; }

/* ---------- 登入 / 註冊 ---------- */
.pr-auth { display: grid; grid-template-columns: minmax(0, 460px) minmax(0, 1fr); gap: 56px; align-items: start; }
.pr-card { border: 1px solid var(--ag-line); background: rgba(0, 0, 0, 0.55); padding: 28px; }
.pr-tabs { display: flex; gap: 0; margin-bottom: 22px; border-bottom: 1px solid var(--ag-line-soft); }
.pr-tabs button { flex: 1 1 0; height: 44px; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--ag-ink-60); font: inherit; font-size: 15px; cursor: pointer; }
.pr-tabs button.on { color: var(--ag-ink); border-bottom-color: var(--ag-ember); }
.pr-form { display: flex; flex-direction: column; gap: 16px; }
.pr-form label { display: flex; flex-direction: column; gap: 6px; }
.pr-form label > span { font-size: 13.5px; color: var(--ag-ink-72); letter-spacing: 0.04em; }
.pr-form input { height: 44px; padding: 0 12px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--ag-line); color: var(--ag-ink); font: inherit; font-size: 16px; outline: none; }
.pr-form input:focus { border-color: var(--ag-ember); }
.pr-form small { font-size: 13px; line-height: 1.5; color: var(--ag-ink-50); }
.pr-form small.good { color: #9fe0a8; }
.pr-form small.bad { color: #ff8f7a; }
.pr-form .ag-btn { align-self: flex-start; }
.pr-form .ag-btn:disabled, .pr-acts .ag-btn:disabled, .pm-go:disabled { opacity: 0.5; cursor: not-allowed; }
.pr-form.inline { margin-top: 20px; max-width: 420px; }
.pr-side ul { margin: 14px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; color: var(--ag-ink-72); font-size: 15.5px; line-height: 1.6; }
.pr-count { margin-top: 22px; color: var(--ag-ink-60); font-size: 15px; }
.pr-count b { color: var(--ag-ember); font-size: 22px; font-weight: 500; margin: 0 4px; }

/* ---------- 創角:共用 ---------- */
.pr-bar { display: flex; align-items: center; gap: 18px; margin-bottom: 16px; color: var(--ag-ink-72); font-size: 14.5px; }
.pr-bar .sp { flex: 1; }
.pr-bar b { color: var(--ag-ink); font-weight: 500; }
.pr-wrap { width: 100%; max-width: 1040px; margin: 0 auto; }
.pr-fade-enter-active { transition: opacity 0.45s; }
.pr-fade-leave-active { transition: opacity 0.45s; position: absolute; }
.pr-fade-enter-from, .pr-fade-leave-to { opacity: 0; }

/* ---------- 桌機:800x600 舞台(裡面的數字都是客戶端 CreateUI.xml 的座標) ---------- */
.pr-stage-box { position: relative; width: 100%; }
.pr-stage {
  position: absolute; left: 50%; top: 0; width: 800px; height: 600px; margin-left: -400px; transform-origin: 50% 0;
  overflow: hidden; background: #000; color: #e9dfc6; font-size: 12px; line-height: 1.3;
  font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.14), 0 30px 80px rgba(0, 0, 0, 0.7);
}
.pr-stage .bg { position: absolute; inset: 0; width: 800px; height: 600px; }
.pr-stage .st-abs { position: absolute; }
.pr-stage button { all: unset; box-sizing: border-box; position: absolute; cursor: pointer; }
.pr-stage button:disabled { cursor: not-allowed; opacity: 0.45; }
.pr-stage .st-dim { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.38); }
.pr-stage .st-title { position: absolute; left: 23px; top: 20px; font-size: 24px; letter-spacing: 0.12em; color: #f1e2b6; text-shadow: 0 2px 6px #000, 0 0 18px rgba(0, 0, 0, 0.9); }
.pr-stage .st-title small { display: block; margin-top: 4px; font-size: 13px; letter-spacing: 0.08em; color: #cdbf9c; }
.pr-stage .st-clsname { position: absolute; left: 64px; top: 226px; font-size: 34px; letter-spacing: 0.14em; color: #fff3cf; text-shadow: 0 2px 8px #000, 0 0 22px #000; }
.pr-stage .st-role { position: absolute; left: 64px; top: 276px; width: 340px; font-size: 14px; color: #e3c98a; text-shadow: 0 1px 4px #000; }
.pr-stage .st-desc { position: absolute; left: 64px; top: 296px; width: 300px; font-size: 13px; line-height: 1.55; color: #e9dfc6; text-shadow: 0 1px 4px #000; display: none; }
.pr-stage .st-sex { width: 68px; height: 68px; }
.pr-stage .st-sex img { display: block; width: 68px; height: 68px; }
.pr-stage .st-sex span { position: absolute; left: 0; right: 0; top: 70px; text-align: center; font-size: 13px; color: #cdbf9c; text-shadow: 0 1px 3px #000; }
.pr-stage .st-sex.on span { color: #fff3cf; }
.pr-stage .st-sex:hover img { filter: brightness(1.25); }
.pr-stage .st-link { font-size: 13px; color: #e3c98a; text-decoration: underline; text-underline-offset: 3px; text-shadow: 0 1px 4px #000; }
.pr-stage .st-cls { width: 68px; height: 72px; }
.pr-stage .st-cls img { display: block; width: 68px; height: 50px; mix-blend-mode: screen; }
.pr-stage .st-cls span { display: block; height: 20px; line-height: 20px; text-align: center; font-size: 13px; color: #a89a78; text-shadow: 0 1px 3px #000; white-space: nowrap; }
.pr-stage .st-cls.on span { color: #fff3cf; }
.pr-stage .st-cls:hover img { filter: brightness(1.3); }
.pr-stage .st-img img { display: block; mix-blend-mode: screen; }
.pr-stage .st-img:hover img { filter: brightness(1.35); }
.pr-stage .st-ptitle { position: absolute; height: 24px; line-height: 24px; text-align: center; font-size: 14px; letter-spacing: 0.2em; color: #e9dfc6; }
.pr-stage .st-preset { width: 108px; height: 24px; line-height: 22px; text-align: center; font-size: 12px; color: #e3c98a; border: 1px solid #5d5338; background: rgba(40, 34, 20, 0.85); }
.pr-stage .st-preset:hover { border-color: #b9a36a; color: #fff3cf; }
.pr-stage .st-glabel { position: absolute; left: 30px; width: 124px; height: 17px; line-height: 17px; text-align: right; font-size: 12px; color: #cdbf9c; }
.pr-stage .st-gauge { position: absolute; left: 161px; height: 17px; background: url('/aegis/prereg/ui/gauge.png') left top / 181px 17px no-repeat; transition: width 0.25s; }
.pr-stage .st-statname { position: absolute; height: 16px; line-height: 16px; font-size: 11px; color: #9c9070; }
.pr-stage .st-statname.l { left: 62px; width: 50px; text-align: right; display: none; }
.pr-stage .st-statname.r { left: 300px; display: none; }
.pr-stage .st-val { position: absolute; width: 22px; height: 20px; line-height: 20px; text-align: center; font-size: 13px; color: #fff; }
.pr-stage .st-pm { width: 18px; height: 16px; }
.pr-stage .st-pm img { display: block; }
.pr-stage .st-pm:not(:disabled):hover img { filter: brightness(1.6); }
.pr-stage .st-remain { position: absolute; left: 184px; top: 370px; width: 32px; height: 22px; line-height: 22px; text-align: center; font-size: 14px; color: #ffd76a; }
.pr-stage .st-remain.zero { color: #8f8468; }
.pr-stage .st-btn2 { width: 137px; height: 30px; line-height: 30px; text-align: center; font-size: 13px; letter-spacing: 0.1em; color: #e9dfc6; background: url('/aegis/prereg/ui/btn2.png') center / 137px 30px no-repeat; }
.pr-stage .st-btn2:hover { background-image: url('/aegis/prereg/ui/btn2_hi.png'); color: #fff; }
.pr-stage .st-btn { width: 150px; height: 34px; line-height: 34px; text-align: center; font-size: 14px; letter-spacing: 0.14em; color: #f1e2b6; background: url('/aegis/prereg/ui/btn.png') center / 150px 34px no-repeat; }
.pr-stage .st-btn:not(:disabled):hover { background-image: url('/aegis/prereg/ui/btn_hi.png'); color: #fff; }
.pr-stage .st-blabel { position: absolute; width: 112px; height: 22px; line-height: 22px; font-size: 12px; color: #cdbf9c; white-space: nowrap; }
.pr-stage .st-bval { position: absolute; width: 40px; height: 20px; line-height: 20px; text-align: center; font-size: 12px; color: #6f6654; }
.pr-stage .st-bval.has { color: #ffb347; }
.pr-stage .st-name { position: absolute; left: 322px; top: 541px; width: 168px; height: 20px; padding: 0 2px; background: transparent; border: 0; outline: none; color: #fff; font: inherit; font-size: 13px; }
.pr-stage .st-name::placeholder { color: #6f6654; }
.pr-stage .st-hint { position: absolute; left: 193px; top: 568px; width: 420px; height: 18px; line-height: 18px; font-size: 12px; text-shadow: 0 1px 3px #000; }
.pr-stage .st-modal { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.55); }
.pr-stage .st-msg { position: absolute; left: 171px; top: 153px; width: 459px; height: 295px; }
.pr-stage .st-msg > img { position: absolute; left: 0; top: 0; }
.pr-stage .st-msg-body { position: absolute; left: 29px; top: 26px; width: 400px; height: 204px; overflow-y: auto; padding-right: 6px; font-size: 13px; line-height: 1.65; color: #e9dfc6; }
.pr-stage .st-msg-body h4 { margin: 0 0 6px; font-size: 15px; font-weight: 500; letter-spacing: 0.16em; color: #fff3cf; }
.pr-stage .st-msg-body p { margin: 0 0 8px; }

/* ---------- 手機 ---------- */
.pm { display: flex; flex-direction: column; gap: 14px; }
.pm-hero { position: relative; height: 0; padding-bottom: 62%; background-size: cover; background-position: 62% 18%; border: 1px solid var(--ag-line-soft); }
.pm-hero-txt { position: absolute; left: 14px; bottom: 12px; text-shadow: 0 2px 8px #000, 0 0 20px #000; }
.pm-hero-txt .n { font-size: 26px; letter-spacing: 0.1em; color: #fff3cf; }
.pm-hero-txt .r { font-size: 14px; color: #e3c98a; margin-top: 2px; }
.pm-row { display: flex; gap: 6px; }
.pm-row button { flex: 1 1 0; min-width: 0; padding: 6px 0; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--ag-line-soft); color: var(--ag-ink-60); font: inherit; font-size: 13px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.pm-row button.on { border-color: var(--ag-ember); color: var(--ag-ink); }
.pm-row.cls img { width: 54px; height: 40px; mix-blend-mode: screen; }
.pm-row.cls span { white-space: nowrap; font-size: 12.5px; }
.pm-row.sex button { flex-direction: row; justify-content: center; gap: 8px; height: 52px; font-size: 15px; }
.pm-row.sex img { width: 40px; height: 40px; }
.pm-desc { font-size: 14.5px; line-height: 1.65; color: var(--ag-ink-72); }
.pm-intro { font-size: 14px; line-height: 1.7; color: var(--ag-ink-72); border-left: 2px solid var(--ag-line); padding-left: 12px; }
.pm-intro p { margin: 0 0 8px; }
.pm-box { border: 1px solid var(--ag-line-soft); background: rgba(0, 0, 0, 0.5); padding: 14px; }
.pm-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 15px; letter-spacing: 0.08em; margin-bottom: 10px; }
.pm-head b { color: #ffd76a; font-weight: 500; }
.pm-head b.zero { color: var(--ag-ink-50); }
.pm-stat { display: flex; align-items: center; gap: 10px; height: 46px; border-top: 1px solid var(--ag-line-soft); }
.pm-stat .nm { flex: 1; font-size: 15px; }
.pm-stat .nm i { font-style: normal; font-size: 11px; color: var(--ag-ink-35); margin-left: 6px; letter-spacing: 0.1em; }
.pm-stat button { width: 40px; height: 36px; background: rgba(255, 255, 255, 0.07); border: 1px solid var(--ag-line); color: var(--ag-ink); font-size: 20px; line-height: 1; cursor: pointer; }
.pm-stat button:disabled { opacity: 0.3; cursor: not-allowed; }
.pm-stat > b { width: 30px; text-align: center; font-size: 18px; font-weight: 500; }
.pm-stat .cap { width: 58px; text-align: right; font-size: 12px; color: var(--ag-ink-35); white-space: nowrap; }
.pm-presets { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.pm-presets button { flex: 1 1 40%; height: 38px; background: none; border: 1px solid var(--ag-line); color: var(--ag-ink-72); font: inherit; font-size: 13.5px; cursor: pointer; }
.pm-bonus { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 14px; }
.pm-bonus > div { display: flex; justify-content: space-between; gap: 8px; color: var(--ag-ink-72); }
.pm-bonus b { color: #ffb347; font-weight: 500; }
.pm-bonus p { grid-column: 1 / -1; margin: 0; color: var(--ag-ink-50); font-size: 13.5px; }
.pm-name { width: 100%; height: 46px; padding: 0 12px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--ag-line); color: var(--ag-ink); font: inherit; font-size: 17px; outline: none; }
.pm-hint { min-height: 20px; margin: 6px 0 10px; font-size: 13.5px; }
.pm-go { width: 100%; }

/* ---------- 已預約 ---------- */
.pr-done { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 40px; align-items: center; }
.pr-hero { position: relative; height: 0; padding-bottom: 75%; background-size: cover; background-position: center; border: 1px solid var(--ag-line-soft); }
.pr-hero-in { position: absolute; left: 6%; bottom: 8%; right: 6%; text-shadow: 0 2px 8px #000, 0 0 24px #000; }
.pr-hero-in .nm { margin-top: 8px; font-size: clamp(26px, 4vw, 44px); letter-spacing: 0.08em; color: #fff3cf; }
.pr-hero-in .cl { margin-top: 4px; font-size: 16px; color: #e3c98a; }
.pr-hero-in .st { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 14px; color: var(--ag-ink-72); }
.pr-hero-in .st b { color: var(--ag-ink); font-weight: 500; }
.pr-acts .row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.pr-acts b { color: var(--ag-ink); font-weight: 500; }
.pr-confirm { margin-top: 20px; padding: 16px; border: 1px solid #a8503f; background: rgba(120, 30, 20, 0.2); font-size: 15px; line-height: 1.6; }

@media (max-width: 860px) {
  .pr-auth, .pr-done { grid-template-columns: 1fr; gap: 28px; }
  .pr-card { padding: 20px; }
}
</style>
