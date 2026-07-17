<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { generateSignature } from '@/utils/SignTools'

const API = 'https://api.gameshare-system.com'
const authStore = useAuthStore()
const router = useRouter()
const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return { Authorization: `Bearer ${authStore.authToken}`, 'Content-Type': 'application/json', Sign: generateSignature(ts), TimeStamp: ts }
}

interface BotStatus { running?: boolean; mode?: string; statusText?: string; targets?: number; params?: Record<string, any> }
interface Bot { token: string; name: string; online: boolean; ageMs: number; status: BotStatus | null }

const bots = ref<Bot[]>([])
const lastErr = ref('')
const loading = ref(false)

// 綁定表單
const bindToken = ref('')
const bindName = ref('')
const binding = ref(false)
const bindMsg = ref('')
const expanded = ref<Record<string, boolean>>({})
const showFrame = ref<Record<string, boolean>>({})
const frames = ref<Record<string, { url: string; ageMs: number }>>({})

const numKeys = [
  { k: 'gridCell', label: '格子大小(px)' },
  { k: 'gridThr', label: '格子亮起門檻' },
  { k: 'gridDecayPct', label: '格子保溫%' },
  { k: 'maxRange', label: '攻擊距離(px)' },
  { k: 'excludeR', label: '排除半徑(px)' },
  { k: 'thresh', label: '靈敏度(越小越敏)' },
  { k: 'f1Ms', label: '每目標時間(ms)' },
  { k: 'cooldownMs', label: '同點冷卻(ms)' },
]
const boolKeys = [
  { k: 'useGrid', label: '格子雷達模式' },
  { k: 'useMinimapWall', label: '小地圖判牆' },
  { k: 'useMelee', label: '近身反擊' },
  { k: 'useCorpseFilter', label: '忽略死怪(白血條)' },
]

async function loadBots() {
  if (!authStore.isLogin) return
  try {
    const res = await fetch(`${API}/bot/bindings`, { headers: headers() })
    if (res.status === 401 || res.status === 403) { authStore.clearToken(); return }
    if (!res.ok) { lastErr.value = 'HTTP ' + res.status; return }
    bots.value = await res.json()
    lastErr.value = ''
    // 只為「顯示畫面」開著且在線的機器人抓即時圖(省流量)
    for (const b of bots.value) {
      if (showFrame.value[b.token] && b.online) loadFrame(b.token)
    }
  } catch (e: any) { lastErr.value = String(e) }
}

async function loadFrame(token: string) {
  try {
    const res = await fetch(`${API}/bot/frame?token=${encodeURIComponent(token)}`, { headers: headers() })
    if (!res.ok) return
    const d = await res.json()
    if (d.frame) frames.value[token] = { url: `data:image/jpeg;base64,${d.frame}`, ageMs: d.ageMs }
  } catch { /* ignore */ }
}

function toggleFrame(token: string) {
  showFrame.value[token] = !showFrame.value[token]
  if (showFrame.value[token]) loadFrame(token)
}

async function doBind() {
  bindMsg.value = ''
  const token = bindToken.value.trim()
  if (token.length < 6) { bindMsg.value = 'token 格式錯誤（請從 MotionHunter 複製）'; return }
  binding.value = true
  try {
    const res = await fetch(`${API}/bot/bind`, { method: 'POST', headers: headers(), body: JSON.stringify({ token, name: bindName.value.trim() }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { bindMsg.value = d.message || ('綁定失敗 HTTP ' + res.status); return }
    bindMsg.value = '✅ 綁定成功'
    bindToken.value = ''; bindName.value = ''
    await loadBots()
  } catch (e: any) { bindMsg.value = String(e) }
  finally { binding.value = false }
}

async function sendCmd(token: string, cmd: string) {
  try {
    await fetch(`${API}/bot/command`, { method: 'POST', headers: headers(), body: JSON.stringify({ token, cmd }) })
    setTimeout(loadBots, 600)
  } catch { /* ignore */ }
}
function setNum(token: string, k: string, v: any) { const n = Number(v); if (!isNaN(n)) sendCmd(token, `set:${k}:${Math.round(n)}`) }
function setBool(token: string, k: string, v: boolean) { sendCmd(token, `set:${k}:${v}`) }

async function unbind(token: string, name: string) {
  if (!confirm(`確定要解除綁定「${name}」嗎？`)) return
  try {
    await fetch(`${API}/bot/unbind`, { method: 'POST', headers: headers(), body: JSON.stringify({ token }) })
    await loadBots()
  } catch { /* ignore */ }
}

function maskToken(t: string) { return t.length <= 10 ? t : t.slice(0, 6) + '••••' + t.slice(-4) }
function toggle(token: string) { expanded.value[token] = !expanded.value[token] }

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { loadBots(); timer = setInterval(loadBots, 3000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="bot-mon">
    <div class="bm-head">
      <h2>🤖 打怪機器人 遠端監控</h2>
      <button v-if="authStore.isLogin" class="mini-logout" @click="router.push('/clan')">回主頁</button>
    </div>

    <!-- 未登入：導去系統登入 -->
    <div v-if="!authStore.isLogin" class="gate">
      <div class="gate-icon">🔒</div>
      <p class="gate-title">請先登入你的帳號</p>
      <p class="gate-sub">登入後即可綁定你電腦上的打怪機器人，並隨時隨地監控 / 遙控。</p>
      <button class="btn-login" @click="router.push('/login')">前往登入</button>
    </div>

    <template v-else>
      <!-- 綁定新機器人 -->
      <div class="bind-box">
        <h3>➕ 綁定機器人</h3>
        <p class="bind-hint">在電腦上打開 <b>MotionHunter（格子雷達版）</b>，勾選「🌐 遠端監控」，按 <b>複製</b> token，貼到下面：</p>
        <div class="bind-row">
          <input class="bind-in token" v-model="bindToken" placeholder="貼上 token（gs-xxxxxxxx）" spellcheck="false">
          <input class="bind-in name" v-model="bindName" placeholder="取個名字（例：主帳）" maxlength="20">
          <button class="btn-bind" :disabled="binding" @click="doBind">{{ binding ? '綁定中…' : '綁定' }}</button>
        </div>
        <div v-if="bindMsg" class="bind-msg" :class="{ ok: bindMsg.startsWith('✅') }">{{ bindMsg }}</div>
      </div>

      <!-- 機器人清單 -->
      <div v-if="bots.length === 0" class="empty">尚未綁定任何機器人。</div>

      <div v-for="b in bots" :key="b.token" class="botcard">
        <div class="bc-head">
          <div class="bc-name">
            <span class="dot" :class="{ on: b.online }"></span>
            <b>{{ b.name }}</b>
            <span class="tk">{{ maskToken(b.token) }}</span>
          </div>
          <div class="bc-live">
            <span v-if="b.online" class="lv on">在線 · {{ Math.round(b.ageMs / 1000) }}s 前</span>
            <span v-else class="lv off">離線</span>
            <button class="unbind" @click="unbind(b.token, b.name)">解除</button>
          </div>
        </div>

        <div class="cards">
          <div class="card"><div class="lbl">運行</div><div class="val" :class="b.status?.running ? 'green' : 'red'">{{ b.status?.running ? '運行中' : '已暫停' }}</div></div>
          <div class="card"><div class="lbl">模式</div><div class="val">{{ b.status?.mode === 'grid' ? '格子雷達' : b.status?.mode === 'blob' ? '色塊' : '—' }}</div></div>
          <div class="card"><div class="lbl">鎖定目標</div><div class="val">{{ b.status?.targets ?? 0 }}</div></div>
          <div class="card wide"><div class="lbl">目前狀態</div><div class="val small">{{ b.status?.statusText || '—' }}</div></div>
        </div>

        <div class="btns">
          <button class="btn start" @click="sendCmd(b.token, 'start')" :disabled="!b.online">▶ 開始</button>
          <button class="btn stop" @click="sendCmd(b.token, 'stop')" :disabled="!b.online">■ 暫停</button>
          <button class="btn param" @click="toggle(b.token)">{{ expanded[b.token] ? '收合參數' : '參數調整' }}</button>
        </div>

        <div class="frame-wrap">
          <button class="btn-frame" @click="toggleFrame(b.token)" :disabled="!b.online">
            {{ showFrame[b.token] ? '🔽 隱藏即時畫面' : '📺 顯示即時畫面' }}
          </button>
          <div v-if="showFrame[b.token]" class="frame-box">
            <img v-if="frames[b.token]" :src="frames[b.token]?.url" class="frame-img" alt="即時偵測畫面">
            <div v-else class="frame-load">等待畫面…（機器人每 3 秒上傳一張）</div>
            <div v-if="frames[b.token]" class="frame-age">{{ Math.max(0, Math.round((frames[b.token]?.ageMs ?? 0) / 1000)) }}s 前</div>
          </div>
        </div>

        <div v-if="expanded[b.token]" class="params">
          <label class="prow tog" v-for="p in boolKeys" :key="p.k">
            <span class="pk">{{ p.label }}</span>
            <input type="checkbox" :checked="!!b.status?.params?.[p.k]" :disabled="!b.online"
              @change="setBool(b.token, p.k, ($event.target as HTMLInputElement).checked)">
          </label>
          <div class="prow" v-for="p in numKeys" :key="p.k">
            <span class="pk">{{ p.label }}</span>
            <input class="pin" type="number" :value="b.status?.params?.[p.k]" :disabled="!b.online"
              @change="setNum(b.token, p.k, ($event.target as HTMLInputElement).value)">
          </div>
        </div>

        <div v-if="!b.online" class="offline">機器人離線 — 請確認電腦上的 MotionHunter 有開、且勾了「🌐 遠端監控」。</div>
      </div>

      <div v-if="lastErr" class="err">⚠ {{ lastErr }}</div>
    </template>
  </div>
</template>

<style scoped>
.bot-mon { max-width: 760px; margin: 0 auto; padding: 18px 16px 40px; color: #e5e7eb; font-family: "Microsoft JhengHei", system-ui, sans-serif; }
.bm-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
h2 { font-size: 1.3rem; margin: 0; }
h3 { font-size: 1rem; margin: 0 0 8px; color: #cbd5e1; }
.mini-logout { background: #232c3d; border: 1px solid #33415a; color: #cbd5e1; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: .85rem; }

.gate { text-align: center; margin-top: 60px; }
.gate-icon { font-size: 3rem; }
.gate-title { font-size: 1.2rem; font-weight: 800; margin: 10px 0 4px; }
.gate-sub { color: #94a3b8; font-size: .9rem; margin: 0 0 20px; }
.btn-login { background: linear-gradient(135deg, #8b5cf6, #6d28d9); border: none; color: #fff; font-weight: 800; font-size: 1.05rem; padding: 12px 34px; border-radius: 12px; cursor: pointer; }

.bind-box { background: #151c28; border: 1px solid #2b3648; border-radius: 14px; padding: 14px 16px; margin: 16px 0 20px; }
.bind-hint { color: #94a3b8; font-size: .84rem; margin: 0 0 10px; line-height: 1.6; }
.bind-hint b { color: #cbd5e1; }
.bind-row { display: flex; gap: 8px; flex-wrap: wrap; }
.bind-in { height: 40px; background: #0e1420; border: 1px solid #33415a; border-radius: 10px; color: #e5e7eb; padding: 0 12px; font-size: .92rem; }
.bind-in.token { flex: 2 1 220px; font-family: ui-monospace, monospace; }
.bind-in.name { flex: 1 1 120px; }
.btn-bind { height: 40px; background: linear-gradient(135deg, #16a34a, #15803d); border: none; color: #fff; font-weight: 800; border-radius: 10px; padding: 0 22px; cursor: pointer; flex: 0 0 auto; }
.btn-bind:disabled { opacity: .5; cursor: not-allowed; }
.bind-msg { margin-top: 10px; font-size: .85rem; color: #fca5a5; }
.bind-msg.ok { color: #4ade80; }

.empty { text-align: center; color: #64748b; padding: 30px 0; }

.botcard { background: #10151f; border: 1px solid #2b3648; border-radius: 14px; padding: 14px 16px; margin-bottom: 16px; }
.bc-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.bc-name { display: flex; align-items: center; gap: 8px; font-size: 1.05rem; }
.tk { font-family: ui-monospace, monospace; font-size: .78rem; color: #64748b; }
.bc-live { display: flex; align-items: center; gap: 10px; }
.lv { font-size: .82rem; font-weight: 700; }
.lv.on { color: #4ade80; } .lv.off { color: #f87171; }
.unbind { background: transparent; border: 1px solid #5b2b2b; color: #fca5a5; border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: .78rem; }

.dot { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 6px #ef4444; }
.dot.on { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
.card { background: #1a2230; border: 1px solid #2b3648; border-radius: 12px; padding: 10px 12px; }
.card.wide { grid-column: 1 / -1; }
.lbl { font-size: .74rem; color: #7c8aa0; }
.val { font-size: 1.1rem; font-weight: 800; margin-top: 4px; }
.val.small { font-size: .92rem; font-weight: 600; }
.val.green { color: #4ade80; } .val.red { color: #f87171; }
.btns { display: flex; gap: 10px; margin-top: 14px; }
.btn { flex: 1 1 0; height: 42px; border: none; border-radius: 10px; font-size: .98rem; font-weight: 800; cursor: pointer; color: #fff; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn.start { background: linear-gradient(135deg, #16a34a, #15803d); }
.btn.stop { background: linear-gradient(135deg, #dc2626, #991b1b); }
.btn.param { background: #232c3d; border: 1px solid #33415a; }
.frame-wrap { margin-top: 12px; }
.btn-frame { width: 100%; height: 38px; background: #1a2230; border: 1px solid #33415a; color: #cbd5e1; border-radius: 10px; font-weight: 700; cursor: pointer; }
.btn-frame:disabled { opacity: .4; cursor: not-allowed; }
.frame-box { position: relative; margin-top: 10px; background: #000; border: 1px solid #2b3648; border-radius: 10px; overflow: hidden; text-align: center; }
.frame-img { display: block; width: 100%; height: auto; }
.frame-load { padding: 40px 10px; color: #64748b; font-size: .85rem; }
.frame-age { position: absolute; right: 8px; bottom: 6px; background: rgba(0,0,0,.55); color: #cbd5e1; font-size: .72rem; padding: 2px 7px; border-radius: 6px; }
.params { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin-top: 14px; }
.prow { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #161d29; border: 1px solid #2b3648; border-radius: 10px; padding: 8px 12px; }
.prow.tog { cursor: pointer; }
.pk { font-size: .86rem; color: #cbd5e1; }
.pin { width: 90px; height: 30px; background: #0e1420; border: 1px solid #33415a; border-radius: 8px; color: #e5e7eb; text-align: right; padding: 0 8px; font-size: .9rem; }
.pin:disabled { opacity: .5; }
input[type=checkbox] { width: 20px; height: 20px; accent-color: #8b5cf6; cursor: pointer; }
.err { margin-top: 14px; color: #fca5a5; font-size: .85rem; }
.offline { margin-top: 12px; padding: 8px 12px; background: #2a1a1a; border: 1px solid #5b2b2b; border-radius: 10px; color: #fca5a5; font-size: .84rem; }
@media (max-width: 560px) { .params { grid-template-columns: 1fr; } }
</style>
