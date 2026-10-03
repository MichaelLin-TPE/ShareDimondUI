<script setup lang="ts">
// 天堂塔防(神盾天堂預約期間的小遊戲,使用者 2026-10-03)。
// 用預約帳號登入就能玩;排行以帳號計。天幣、女神像生命、波數全部後端算,這一頁只下指令和播放結果。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ApiError, restoreSession, session } from './prereg/api'
import { CLS_ORDER, td, type ClassInfo, type RankView, type StateView, type TdConfig, type WaveView } from './td/api'
import { TdScene, loadAssets } from './td/scene'
import { BGM, TdAudio, type SfxName } from './td/audio'

const ART = '/aegis/td/'
const RARITY = ['普通', '稀有', '傳說']

const cfg = shallowRef<TdConfig | null>(null)
const state = ref<StateView | null>(null)
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const toast = ref('')
let toastTimer = 0

const canvasEl = ref<HTMLCanvasElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
let scene: TdScene | null = null
let ro: ResizeObserver | null = null
const audio = new TdAudio()
const muted = ref(audio.muted)
const musicOff = ref(audio.musicOff)
function toggleMute() {
  audio.unlock()
  audio.setMuted(!muted.value)
  muted.value = audio.muted
  if (!muted.value) audio.play('click')
}
function toggleMusic() {
  audio.unlock()
  audio.setMusicOff(!musicOff.value)
  musicOff.value = audio.musicOff
}

const battling = ref(false)
const speed = ref(1)
const placing = ref<string | null>(null)
const selected = ref(-1)
const result = ref<WaveView | null>(null)
const showRank = ref(false)
const showTalent = ref(false)
const showHelp = ref(false)
const confirmQuit = ref(false)
const rank = ref<RankView | null>(null)

// ---------- 手機:橫向模式 ----------
// 手機直的時候地圖只有半個螢幕寬;轉橫就自動切成「地圖占滿高度、右邊一條操作欄」。
const coarse = window.matchMedia('(pointer: coarse)').matches
const landMql = window.matchMedia('(orientation: landscape) and (max-height: 600px)')
const isLandscape = ref(landMql.matches)
const landscape = computed(() => coarse && isLandscape.value)
const hintDismissed = ref(false)
try { hintDismissed.value = localStorage.getItem('aegis_td_land_hint') === '1' } catch { /* 存不了就每次提醒 */ }
const onLandChange = () => { isLandscape.value = landMql.matches }
// 橫向模式時把官網的導覽列藏起來(它是 fixed 在最上層,會蓋到操作欄)
watch(landscape, (on) => document.documentElement.classList.toggle('td-land', on), { immediate: true })
function dismissHint() {
  hintDismissed.value = true
  try { localStorage.setItem('aegis_td_land_hint', '1') } catch { /* 存不了就算了 */ }
}
// 不用全螢幕 API:手機 Chrome 一進全螢幕就把畫布殺掉(整片白、左上角哭臉),轉橫就自動切版面了
function leaveLandscape() {
  say('把手機轉直就回到一般畫面')
}

const run = computed(() => state.value?.run ?? null)
const profile = computed(() => state.value?.profile ?? null)
const classes = computed(() => cfg.value?.classes ?? [])
const selTower = computed(() => (selected.value >= 0 ? run.value?.towers[selected.value] ?? null : null))
const selClass = computed<ClassInfo | null>(() => classes.value.find((c) => c.id === selTower.value?.cls) ?? null)
const choosing = computed(() => !battling.value && !!run.value?.choices)

function say(msg: string) {
  toast.value = msg
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 3200)
}
function fail(e: unknown) {
  say(e instanceof ApiError ? e.message : '發生錯誤,請稍後再試')
}
const clsIndex = (id: string) => CLS_ORDER.indexOf(id as (typeof CLS_ORDER)[number])
const perSec = (perMinute: number) => (perMinute / 60).toFixed(1)

function apply(s: StateView) {
  state.value = s
  if (s.run && scene) scene.setRun(s.run)
}

async function act(type: 'buy' | 'upgrade' | 'path' | 'sell' | 'bless', slot: number | null, cls: string | null, value: number | null) {
  if (busy.value || battling.value) return false
  audio.unlock()      // 用鍵盤操作的人不會觸發最外層的 pointerdown,這裡再保一次
  busy.value = true
  try {
    apply(await td.action(type, slot, cls, value))
    // 招募:這個職業在天堂創角畫面被選到的聲音
    const snd: SfxName = type === 'buy' ? (`cls${clsIndex(cls ?? '')}` as SfxName) : type === 'upgrade' ? 'upgrade' : type === 'sell' ? 'sell' : 'bless'
    audio.play(snd)
    return true
  } catch (e) {
    fail(e)
    return false
  } finally {
    busy.value = false
  }
}

async function startRun() {
  if (busy.value) return
  audio.unlock()
  busy.value = true
  try {
    result.value = null
    selected.value = -1
    placing.value = null
    apply(await td.start())
    audio.play('wave_start')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

function pickClass(id: string) {
  if (battling.value) return
  placing.value = placing.value === id ? null : id
  selected.value = -1
  audio.play('click')
}

async function onSlot(slot: number) {
  const r = run.value
  if (!r || battling.value) return
  if (r.towers[slot]) {
    selected.value = selected.value === slot ? -1 : slot
    placing.value = null
    return
  }
  if (!placing.value) {
    say('先在右邊選一個職業,再點空位放上去')
    return
  }
  const ok = await act('buy', slot, placing.value, null)
  if (ok) {
    selected.value = slot
    placing.value = null
  }
}

async function sell() {
  if (selected.value < 0) return
  if (await act('sell', selected.value, null, null)) selected.value = -1
}

async function startWave() {
  if (busy.value || battling.value || !scene || !run.value) return
  if (run.value.choices) return
  audio.unlock()
  busy.value = true
  let w: WaveView
  try {
    w = await td.wave()
  } catch (e) {
    busy.value = false
    fail(e)
    return
  }
  selected.value = -1
  placing.value = null
  bossWave.value = run.value.bossNext
  battling.value = true
  busy.value = false
  audio.play(run.value.bossNext ? 'boss_warn' : 'wave_start')
  await scene.play(w.events)
  audio.play(w.over ? 'game_over' : 'wave_clear')
  battling.value = false
  state.value = w.state
  if (w.state.run) scene.setRun(w.state.run)
  if (w.over) result.value = w
  else say(`守住第 ${w.wave} 波,拿到 ${w.goldEarned} 天幣` + (w.newBest ? ' · 刷新個人紀錄' : ''))
}

function skipBattle() {
  scene?.skip()
}

async function quit() {
  confirmQuit.value = false
  if (busy.value || battling.value) return
  busy.value = true
  try {
    const w = await td.abandon()
    state.value = w.state
    result.value = w
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function openRank() {
  showRank.value = true
  try {
    rank.value = await td.ranking(100)
  } catch (e) {
    fail(e)
  }
}

async function upTalent(i: number) {
  if (busy.value) return
  busy.value = true
  try {
    const s = await td.talent(i)
    audio.play('upgrade')
    state.value = { profile: s.profile, run: state.value?.run ?? s.run }
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

watch(speed, (v) => { if (scene) scene.speed = v })
// 背景音樂跟著畫面走:布置時一首、打哪一章放哪一章的、王來那一波換成王的、結算另一首;沒登入或還沒開局就不放
const bgmName = computed(() => {
  if (!session.token) return ''
  if (result.value) return BGM.result
  if (!run.value) return BGM.setup
  if (!battling.value) return BGM.setup
  if (bossWave.value) return BGM.boss
  return BGM.chapters[Math.floor((run.value.wave - 1) / 10) % BGM.chapters.length] ?? BGM.setup
})
const bossWave = ref(false)
watch(bgmName, (n) => audio.music(n), { immediate: true })
watch([placing, selected], () => {
  if (!scene) return
  scene.selected = selected.value
  scene.placing = placing.value ? clsIndex(placing.value) : -1
  scene.placingRange = classes.value.find((c) => c.id === placing.value)?.range ?? 0
})

async function boot() {
  loading.value = true
  loadError.value = ''
  try {
    await restoreSession()
    const [c, assets] = await Promise.all([td.config(), loadAssets()])
    cfg.value = c
    if (session.token) state.value = await td.state()
    loading.value = false
    await nextTick()
    if (canvasEl.value) {
      scene = new TdScene(canvasEl.value, c, assets)
      if (import.meta.env.DEV) (window as unknown as { __tdScene?: TdScene }).__tdScene = scene   // 開發時方便從主控台檢查畫面
      scene.onSlot = onSlot
      scene.onSfx = (name, scale) => audio.play(name, scale)
      scene.speed = speed.value
      if (state.value?.run) scene.setRun(state.value.run)
      if (stageEl.value) {
        ro = new ResizeObserver(() => scene?.resize())
        ro.observe(stageEl.value)
      }
    }
  } catch (e) {
    loading.value = false
    loadError.value = e instanceof ApiError ? e.message : '載入失敗,請重新整理'
  }
}

// 登入狀態變了(在別的分頁登出、登入過期)就重新來過
watch(() => session.token, (now, before) => {
  if (now !== before && !loading.value) {
    scene?.destroy()
    scene = null
    state.value = null
    boot()
  }
})

onMounted(() => {
  landMql.addEventListener('change', onLandChange)
  boot()
})
onBeforeUnmount(() => {
  landMql.removeEventListener('change', onLandChange)
  document.documentElement.classList.remove('td-land')
  ro?.disconnect()
  scene?.destroy()
  audio.destroy()
  window.clearTimeout(toastTimer)
})
</script>

<template>
  <div class="td" @pointerdown="audio.unlock()">
    <div class="ag-wrap">
      <div class="td-head">
        <div class="ttl">
          <div class="ag-cap ember">TOWER DEFENSE // 天堂塔防</div>
          <h1>守住女神像。<span v-if="run">{{ run.chapter }} · 第 {{ run.wave }} 波</span></h1>
        </div>
        <div class="acts">
          <button type="button" @click="openRank">排行榜</button>
          <button v-if="session.token" type="button" @click="showTalent = true">女神徽章<b v-if="profile">{{ profile.badges }}</b></button>
          <button type="button" @click="showHelp = true">怎麼玩</button>
          <button type="button" :title="muted ? '現在是靜音' : '現在有聲音'" @click="toggleMute">音效 {{ muted ? '關' : '開' }}</button>
          <button type="button" :disabled="muted" @click="toggleMusic">音樂 {{ musicOff || muted ? '關' : '開' }}</button>
        </div>
      </div>

      <p v-if="loadError" class="td-msg bad">{{ loadError }}</p>
      <p v-else-if="loading" class="td-msg">載入中…</p>

      <template v-else>
        <div v-if="run" class="td-hud">
          <span class="g">天幣 <b>{{ run.gold }}</b></span>
          <span class="h">女神像 <b>{{ run.goddessHp }} / {{ run.goddessMax }}</b></span>
          <span>已守住 <b>{{ run.wavesCleared }}</b> 波</span>
          <span v-if="run.firstOfDay" class="x2">今天第一局 · 徽章加倍</span>
          <span v-for="b in run.blessings" :key="b.id" class="bl" :class="'r' + b.rarity" :title="b.desc">{{ b.title }}<i v-if="b.count > 1">×{{ b.count }}</i></span>
        </div>

        <p v-if="coarse && !landscape && run && !hintDismissed" class="td-land-hint">
          <span>📱 把手機轉橫,地圖會大很多(記得關掉螢幕旋轉鎖定)</span>
          <button type="button" class="x" aria-label="知道了" @click="dismissHint">✕</button>
        </p>

        <div class="td-main" :class="{ land: landscape }">
          <div ref="stageEl" class="td-stage">
            <canvas ref="canvasEl"></canvas>

            <!-- 橫向模式:上面那條狀態列看不到,地圖上疊一條小的 -->
            <div v-if="landscape && run" class="td-hud mini">
              <span class="g">天幣 <b>{{ run.gold }}</b></span>
              <span class="h">女神像 <b>{{ run.goddessHp }}/{{ run.goddessMax }}</b></span>
              <span>第 <b>{{ run.wave }}</b> 波</span>
              <button type="button" class="leave" @click="leaveLandscape">離開橫向</button>
            </div>

            <div v-if="!session.token" class="td-cover">
              <h2>用預約帳號登入就能玩</h2>
              <p>有帳號就可以,不用先創角色。打到越後面排行越前面,開服有獎。</p>
              <RouterLink class="ag-btn primary" to="/aegis/prereg">辦帳號 / 登入 <span class="arr">→</span></RouterLink>
            </div>
            <div v-else-if="!run && !result" class="td-cover">
              <h2>開始新的一局</h2>
              <p v-if="profile && profile.bestWave > 0">你的最佳紀錄:守住 <b>{{ profile.bestWave }}</b> 波</p>
              <p v-if="profile?.firstRunBonusAvailable" class="x2">今天第一局,結算的女神徽章加倍</p>
              <button class="ag-btn primary" type="button" :disabled="busy" @click="startRun">開始 <span class="arr">→</span></button>
            </div>

            <div v-if="battling" class="td-speed">
              <button v-for="s in [1, 2, 3]" :key="s" type="button" :class="{ on: speed === s }" @click="speed = s">{{ s }}x</button>
              <button type="button" class="skip" @click="skipBattle">跳過</button>
            </div>
          </div>

          <aside v-if="run" class="td-side">
            <!-- 下一波 -->
            <div class="box">
              <div class="bh">第 {{ run.wave }} 波會來<em v-if="run.bossNext">王來了</em></div>
              <div class="next">
                <div v-for="(s, i) in run.nextSpawns" :key="i" class="nm" :class="{ elite: s[1] === 1, boss: s[1] === 2 }">
                  <img :src="s[1] === 2 ? `${ART}boss${Math.floor((run.wave - 1) / 10) % 6}.webp` : `${ART}mob${s[0]}.webp`" alt="" />
                  <span>{{ s[1] === 2 ? cfg?.bosses[Math.floor((run.wave - 1) / 10) % (cfg?.bosses.length || 1)] : cfg?.mobs[s[0] ?? 0]?.title }}<template v-if="s[1] === 1">(精英)</template></span>
                  <b>×{{ s[2] }}</b>
                  <small v-if="s[1] !== 2">{{ cfg?.mobs[s[0] ?? 0]?.desc }}</small>
                </div>
              </div>
            </div>

            <!-- 選中的塔 -->
            <div v-if="selTower && selClass" class="box sel">
              <div class="bh">{{ selClass.title }} · {{ selTower.level }} 級<em v-if="selTower.pathTitle">{{ selTower.pathTitle }}</em></div>
              <div class="nums">
                <span v-if="selTower.cls !== 'PRINCE'">一下 <b>{{ selTower.dmg }}</b></span>
                <span v-if="selTower.cls !== 'PRINCE'">每秒 <b>{{ perSec(selTower.perMinute) }}</b> 下</span>
                <span v-if="selTower.cls === 'KNIGHT'">生命 <b>{{ selTower.hp }}</b></span>
                <span>{{ selTower.cls === 'PRINCE' ? '光環' : '範圍' }} <b>{{ selTower.rangePx }}</b></span>
              </div>
              <div v-if="selTower.needPath" class="paths">
                <p>升到 {{ cfg?.pathLevel }} 級了,選一條路線(選了不能改):</p>
                <button v-for="(p, i) in selClass.paths" :key="p.title" type="button" :disabled="busy" @click="act('path', selected, null, i + 1)">
                  <b>{{ p.title }}</b><span>{{ p.desc }}</span>
                </button>
              </div>
              <div v-else class="row">
                <button v-if="selTower.upgradeCost >= 0" type="button" class="up" :disabled="busy || run.gold < selTower.upgradeCost" @click="act('upgrade', selected, null, null)">
                  升級 <b>{{ selTower.upgradeCost }}</b>
                </button>
                <span v-else class="max">已滿級</span>
                <button type="button" :disabled="busy" @click="sell">賣掉 +{{ selTower.sellValue }}</button>
              </div>
              <p v-if="selTower.cls === 'KNIGHT'" class="kn">怪走到他正對面(路上有盾牌記號的地方)會被攔下來。放在兩排路中間,兩邊都顧得到。</p>
            </div>

            <!-- 商店 -->
            <div class="box">
              <div class="bh">招募<em v-if="run.discountPct > 0">{{ 100 - run.discountPct }} 折</em></div>
              <div class="shop">
                <button v-for="c in classes" :key="c.id" type="button" :class="{ on: placing === c.id }"
                  :disabled="battling || run.gold < (run.prices[c.id] ?? 0) || (c.id === 'PRINCE' && run.princeLeft <= 0)" :title="c.desc" @click="pickClass(c.id)">
                  <img :src="`${ART}cls${clsIndex(c.id)}_idle.webp`" alt="" />
                  <span>{{ c.title }}</span>
                  <b>{{ run.prices[c.id] }}</b>
                </button>
              </div>
              <p class="tip">{{ placing ? classes.find((c) => c.id === placing)?.desc + ' ── 點地圖上的空位放下去' : '選一個職業,再點地圖上的空位' }}</p>
            </div>

            <button class="go" type="button" :disabled="busy || battling || choosing" @click="startWave">
              {{ battling ? '戰鬥中…' : `開始第 ${run.wave} 波` }}
            </button>
            <button class="quit" type="button" :disabled="busy || battling" @click="confirmQuit = true">不打了,結算這一局</button>
          </aside>
        </div>
      </template>
    </div>

    <!-- 祝福三選一 -->
    <div v-if="choosing && run?.choices" class="td-modal">
      <div class="td-dialog wide">
        <h3>女神的祝福 <small>三選一,選了就不能換</small></h3>
        <div class="bless">
          <button v-for="(b, i) in run.choices" :key="b.id" type="button" :class="'r' + b.rarity" :disabled="busy" @click="act('bless', null, null, i)">
            <em>{{ RARITY[b.rarity] }}</em>
            <b>{{ b.title }}</b>
            <span>{{ b.desc }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 結算 -->
    <div v-if="result" class="td-modal">
      <div class="td-dialog">
        <h3>這一局結束了</h3>
        <p class="big">守住 <b>{{ result.wave - (result.cleared ? 0 : 1) }}</b> 波</p>
        <p>拿到女神徽章 <b>{{ result.badgesEarned }}</b> 枚,現在有 {{ result.state.profile.badges }} 枚</p>
        <p>個人最佳:守住 {{ result.state.profile.bestWave }} 波</p>
        <div class="row">
          <button class="ag-btn primary" type="button" :disabled="busy" @click="startRun">再來一局 <span class="arr">→</span></button>
          <button class="ag-btn" type="button" @click="result = null; showTalent = true">去點天賦</button>
          <button class="ag-btn" type="button" @click="result = null; openRank()">看排行</button>
        </div>
      </div>
    </div>

    <!-- 放棄確認 -->
    <div v-if="confirmQuit" class="td-modal" @click.self="confirmQuit = false">
      <div class="td-dialog">
        <h3>要結束這一局嗎?</h3>
        <p>會照已經守住的 {{ run?.wavesCleared }} 波結算女神徽章,這一局不能再繼續。</p>
        <div class="row">
          <button class="ag-btn primary" type="button" @click="quit">結束並結算</button>
          <button class="ag-btn" type="button" @click="confirmQuit = false">繼續打</button>
        </div>
      </div>
    </div>

    <!-- 排行 -->
    <div v-if="showRank" class="td-modal" @click.self="showRank = false">
      <div class="td-dialog wide">
        <h3>排行榜 <small v-if="rank">{{ rank.players }} 人上榜</small></h3>
        <p v-if="!rank" class="td-msg">載入中…</p>
        <template v-else>
          <p v-if="rank.mine" class="mine">你目前第 <b>{{ rank.mine.rank }}</b> 名 · 守住 {{ rank.mine.wave }} 波</p>
          <div class="rank">
            <div class="rr head"><span>名次</span><span>名字</span><span>守住</span><span>女神像剩</span></div>
            <div v-for="r in rank.top" :key="r.rank" class="rr" :class="{ me: r.me }">
              <span>{{ r.rank }}</span><span>{{ r.name }}</span><span>{{ r.wave }} 波</span><span>{{ r.hp }}</span>
            </div>
            <p v-if="!rank.top.length" class="td-msg">還沒有人上榜,第一名等你來拿。</p>
          </div>
          <p class="note">先比守住幾波,一樣就比當時女神像剩多少生命,再一樣就看誰先達成。</p>
        </template>
        <button class="ag-btn" type="button" @click="showRank = false">關閉</button>
      </div>
    </div>

    <!-- 天賦 -->
    <div v-if="showTalent && profile" class="td-modal" @click.self="showTalent = false">
      <div class="td-dialog wide">
        <h3>女神徽章 <small>手上有 {{ profile.badges }} 枚</small></h3>
        <p class="note">每局結束照守住的波數發徽章,每天第一局加倍。點了的天賦永久有效,從下一局開始算。</p>
        <div class="talents">
          <div v-for="(t, i) in profile.talents" :key="t.id" class="tl">
            <div><b>{{ t.title }}</b><span>{{ t.desc }}</span></div>
            <em>{{ t.level }} / {{ t.max }}</em>
            <button type="button" :disabled="busy || t.level >= t.max || profile.badges < t.nextCost" @click="upTalent(i)">
              {{ t.level >= t.max ? '已滿' : `升級 ${t.nextCost}` }}
            </button>
          </div>
        </div>
        <button class="ag-btn" type="button" @click="showTalent = false">關閉</button>
      </div>
    </div>

    <!-- 說明 -->
    <div v-if="showHelp" class="td-modal" @click.self="showHelp = false">
      <div class="td-dialog wide help">
        <h3>怎麼玩</h3>
        <ul>
          <li>怪物從左上角進來,沿著路走向右下角的女神像。漏一隻小怪扣 1 點生命,精英扣 3,王扣 10;歸零這一局就結束。</li>
          <li>每一波開始前:在右邊選職業、點地圖上的空位放下去;點已經放好的塔可以升級或賣掉(退七成)。</li>
          <li>按「開始」之後戰鬥自動進行,可以調 1~3 倍速。戰鬥中不能操作。</li>
          <li>每座塔升到 {{ cfg?.pathLevel }} 級要三選一路線,選了不能改。最高 {{ cfg?.maxLevel }} 級。</li>
          <li>每 {{ cfg?.blessEvery }} 波選一次女神的祝福;每 10 波有王。</li>
          <li>排行看你守住最多幾波。結束後拿到的女神徽章可以點永久天賦。</li>
        </ul>
        <div class="cls">
          <div v-for="c in classes" :key="c.id">
            <img :src="`${ART}cls${clsIndex(c.id)}_idle.webp`" alt="" />
            <b>{{ c.title }}</b>
            <span>{{ c.desc }}</span>
            <small v-for="p in c.paths" :key="p.title"><i>{{ p.title }}</i>{{ p.desc }}</small>
          </div>
        </div>
        <button class="ag-btn" type="button" @click="showHelp = false">關閉</button>
      </div>
    </div>

    <div v-if="toast" class="td-toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.td { padding: 108px 0 64px; min-height: 100vh; }
.td button { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }

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
.td-msg { color: var(--ag-ink-72); font-size: 15px; }
.td-msg.bad { color: #ff8f7a; }
.td-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 14px; }
.td-head h1 { margin-top: 6px; font-size: clamp(1.4rem, 2.6vw, 2.1rem); font-weight: 400; letter-spacing: -0.01em; }
.td-head h1 span { margin-left: 14px; font-size: 0.6em; color: var(--ag-ember); letter-spacing: 0.06em; }
.td .acts { display: flex; flex-wrap: wrap; gap: 8px; }
.td .acts button { height: 38px; padding: 0 14px; background: rgba(0, 0, 0, 0.5); border: 1px solid var(--ag-line); color: var(--ag-ink); font: inherit; font-size: 14px; cursor: pointer; white-space: nowrap; }
.td .acts button:hover { border-color: var(--ag-ember); }
.td .acts button b { margin-left: 8px; color: #ffd76a; }

.td-hud { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; padding: 10px 14px; margin-bottom: 10px; background: rgba(0, 0, 0, 0.6); border: 1px solid var(--ag-line-soft); font-size: 14.5px; color: var(--ag-ink-72); }
.td-hud b { color: var(--ag-ink); font-size: 17px; font-weight: 600; margin-left: 4px; }
.td-hud .g b { color: #ffd76a; }
.td-hud .h b { color: #ff9b8a; }
.td-hud .x2, .td-cover .x2 { color: #ffd76a; }
.td-hud .bl { padding: 2px 8px; border: 1px solid var(--ag-line); font-size: 12.5px; cursor: help; }
.td-hud .bl.r1 { border-color: #6aa8ff; color: #b9d6ff; }
.td-hud .bl.r2 { border-color: #ffb347; color: #ffd9a0; }
.td-hud .bl i { font-style: normal; margin-left: 3px; }

.td-main { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; align-items: start; }
.td-stage { position: relative; width: 100%; aspect-ratio: 50 / 33; background: #0b0f0b; border: 1px solid var(--ag-line); overflow: hidden; }
.td-stage canvas { display: block; width: 100%; height: 100%; }
.td-cover { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; text-align: center; background: rgba(0, 0, 0, 0.66); }
.td-cover h2 { font-size: clamp(1.2rem, 2.4vw, 1.8rem); font-weight: 400; }
.td-cover p { color: var(--ag-ink-72); font-size: 15px; max-width: 420px; }
.td-cover p b { color: #ffd76a; font-size: 1.2em; }
.td-cover .ag-btn { margin-top: 6px; }
.td-speed { position: absolute; right: 10px; top: 10px; display: flex; gap: 4px; }
.td-speed button { width: 44px; height: 34px; background: rgba(0, 0, 0, 0.65); border: 1px solid var(--ag-line); color: var(--ag-ink-72); font: inherit; font-size: 14px; cursor: pointer; }
.td-speed button.skip { width: 60px; }
.td-speed button.on { border-color: var(--ag-ember); color: #fff; background: rgba(232, 132, 42, 0.35); }

.td-side { display: flex; flex-direction: column; gap: 10px; }
.td-side .box { background: rgba(0, 0, 0, 0.62); border: 1px solid var(--ag-line-soft); padding: 12px; }
.td-side .bh { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 14px; letter-spacing: 0.06em; color: var(--ag-ink); margin-bottom: 10px; }
.td-side .bh em { font-style: normal; font-size: 12.5px; color: var(--ag-ember); }
.next { display: flex; flex-direction: column; gap: 6px; }
.next .nm { display: grid; grid-template-columns: 34px 1fr auto; grid-template-rows: auto auto; column-gap: 8px; align-items: center; font-size: 14px; }
.next .nm img { grid-row: 1 / 3; width: 34px; height: 34px; object-fit: contain; }
.next .nm b { color: #ffd76a; }
.next .nm small { grid-column: 2 / 4; font-size: 12px; color: var(--ag-ink-50); }
.next .nm.elite span { color: #ff9b6a; }
.next .nm.boss span { color: #ffb347; font-weight: 600; }
.sel .nums { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13.5px; color: var(--ag-ink-72); margin-bottom: 10px; }
.sel .nums b { color: var(--ag-ink); font-weight: 600; }
.td-side .row { display: flex; gap: 8px; align-items: center; }
.td-side .row button, .paths button { height: 40px; padding: 0 12px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--ag-line); color: var(--ag-ink); font: inherit; font-size: 14px; cursor: pointer; white-space: nowrap; }
.td-side .row .up { flex: 1; border-color: var(--ag-ember); }
.td-side .row .up b { color: #ffd76a; margin-left: 4px; }
.td-side .row .max { flex: 1; color: #ffd76a; font-size: 14px; }
.sel .kn { margin: 10px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--ag-ink-50); }
.td-side button:disabled { opacity: 0.4; cursor: not-allowed; }
.paths { display: flex; flex-direction: column; gap: 6px; }
.paths p { font-size: 13px; color: var(--ag-ink-72); margin: 0 0 2px; }
.paths button { height: auto; padding: 8px 10px; text-align: left; white-space: normal; display: flex; flex-direction: column; gap: 2px; }
.paths button b { color: #ffd76a; font-weight: 500; }
.paths button span { font-size: 12.5px; color: var(--ag-ink-72); line-height: 1.45; }
.shop { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; }
.shop button { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 5px 0 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--ag-line-soft); color: var(--ag-ink); font: inherit; cursor: pointer; min-width: 0; }
.shop button.on { border-color: var(--ag-ember); background: rgba(232, 132, 42, 0.22); }
.shop img { width: 44px; height: 44px; object-fit: contain; }
.shop span { font-size: 12px; white-space: nowrap; }
.shop b { font-size: 12.5px; color: #ffd76a; font-weight: 500; }
.td-side .tip { margin: 8px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--ag-ink-50); min-height: 38px; }
.td-side .go { height: 54px; background: var(--ag-ember); border: 0; color: #120800; font: inherit; font-size: 17px; font-weight: 600; letter-spacing: 0.1em; cursor: pointer; }
.td-side .go:not(:disabled):hover { box-shadow: 0 0 28px var(--ag-ember-glow); }
.td-side .quit { height: 34px; background: none; border: 0; color: var(--ag-ink-50); font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }

.td-modal { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.72); }
.td-dialog { width: 100%; max-width: 440px; max-height: 88vh; overflow-y: auto; padding: 24px; background: #0e0d0b; border: 1px solid var(--ag-line); color: var(--ag-ink); }
.td-dialog.wide { max-width: 720px; }
.td-dialog h3 { font-size: 20px; font-weight: 500; letter-spacing: 0.06em; margin-bottom: 14px; }
.td-dialog h3 small { margin-left: 10px; font-size: 13px; color: var(--ag-ink-50); font-weight: 400; }
.td-dialog p { font-size: 15px; line-height: 1.6; color: var(--ag-ink-72); margin: 0 0 8px; }
.td-dialog p b { color: #ffd76a; }
.td-dialog .big { font-size: 20px; color: var(--ag-ink); }
.td-dialog .big b { font-size: 40px; margin: 0 6px; }
.td-dialog .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.td-dialog .ag-btn { margin-top: 14px; }
.td-dialog .row .ag-btn { margin-top: 0; }
.td-dialog .note { font-size: 13.5px; color: var(--ag-ink-50); }
.bless { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.bless button { display: flex; flex-direction: column; gap: 8px; padding: 16px 14px; min-height: 170px; text-align: left; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--ag-line); color: var(--ag-ink); font: inherit; cursor: pointer; transition: transform 0.15s, border-color 0.15s; }
.bless button:hover { transform: translateY(-3px); border-color: #fff; }
.bless em { font-style: normal; font-size: 12px; letter-spacing: 0.14em; color: var(--ag-ink-50); }
.bless b { font-size: 18px; font-weight: 500; }
.bless span { font-size: 14px; line-height: 1.55; color: var(--ag-ink-72); }
.bless .r1 { border-color: #4f86d6; background: rgba(60, 110, 200, 0.14); }
.bless .r1 em { color: #8fbaff; }
.bless .r2 { border-color: #ffb347; background: rgba(255, 170, 60, 0.14); }
.bless .r2 em { color: #ffcf8a; }
.rank { max-height: 46vh; overflow-y: auto; border: 1px solid var(--ag-line-soft); margin: 8px 0; }
.rank .rr { display: grid; grid-template-columns: 64px 1fr 90px 90px; gap: 8px; padding: 8px 12px; font-size: 14.5px; border-bottom: 1px solid var(--ag-line-soft); }
.rank .rr.head { position: sticky; top: 0; background: #17150f; color: var(--ag-ink-50); font-size: 13px; }
.rank .rr.me { background: rgba(232, 132, 42, 0.18); }
.rank .td-msg { padding: 16px 12px; }
.mine b { font-size: 22px; margin: 0 4px; }
.talents { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.talents .tl { display: grid; grid-template-columns: 1fr 56px 96px; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--ag-line-soft); }
.talents .tl b { display: block; font-weight: 500; font-size: 15px; }
.talents .tl span { font-size: 13px; color: var(--ag-ink-50); }
.talents .tl em { font-style: normal; text-align: center; color: #ffd76a; font-size: 14px; }
.talents .tl button { height: 36px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--ag-ember); color: var(--ag-ink); font: inherit; font-size: 13.5px; cursor: pointer; white-space: nowrap; }
.talents .tl button:disabled { opacity: 0.4; cursor: not-allowed; border-color: var(--ag-line); }
.help ul { margin: 0 0 14px; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 14.5px; line-height: 1.6; color: var(--ag-ink-72); }
.help .cls { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
.help .cls > div { display: flex; flex-direction: column; gap: 3px; padding: 10px; border: 1px solid var(--ag-line-soft); font-size: 13px; }
.help .cls img { width: 60px; height: 60px; object-fit: contain; }
.help .cls b { font-size: 15px; font-weight: 500; }
.help .cls span { color: var(--ag-ink-72); line-height: 1.5; margin-bottom: 4px; }
.help .cls small { color: var(--ag-ink-50); line-height: 1.5; }
.help .cls small i { font-style: normal; color: #ffd76a; margin-right: 6px; }
.td-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 70; max-width: 90vw; padding: 10px 18px; background: rgba(0, 0, 0, 0.88); border: 1px solid var(--ag-ember); color: #fff; font-size: 14.5px; }

.td-land-hint { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 8px 10px 8px 14px; background: rgba(232, 132, 42, 0.14); border: 1px solid var(--ag-ember); font-size: 14px; color: var(--ag-ink); }
.td-land-hint span { flex: 1; }
.td-land-hint button { height: 32px; padding: 0 12px; background: rgba(0, 0, 0, 0.5); border: 1px solid var(--ag-line); color: var(--ag-ink); font: inherit; font-size: 13.5px; cursor: pointer; white-space: nowrap; }
.td-land-hint button.x { width: 32px; padding: 0; }

/* 橫向模式:整個螢幕只放地圖和右邊一條操作欄;官網的導覽列、背景動畫先藏起來 */
:global(html.td-land .ag-nav), :global(html.td-land .ag-amb) { display: none !important; }
.td-main.land { position: fixed; inset: 0; z-index: 55; grid-template-columns: minmax(0, 1fr) 280px; gap: 0; background: #0b0f0b; }
.td-main.land .td-stage { width: min(100%, calc(100dvh * 1000 / 660)); max-height: 100dvh; margin: auto; border: 0; }
.td-main.land .td-side { height: 100dvh; overflow-y: auto; padding: 8px; gap: 8px; background: #0b0f0b; border-left: 1px solid var(--ag-line-soft); }
.td-main.land .td-side .box { padding: 9px; }
.td-main.land .shop img { width: 34px; height: 34px; }
.td-main.land .shop button { font-size: 12px; }
.td-main.land .go { height: 44px; font-size: 16px; }
.td-hud.mini { position: absolute; left: 8px; top: 8px; margin: 0; padding: 4px 8px; gap: 4px 12px; font-size: 13px; background: rgba(0, 0, 0, 0.7); border-color: var(--ag-line); }
.td-hud.mini b { font-size: 14px; }
.td-hud.mini .leave { height: 24px; padding: 0 8px; background: transparent; border: 1px solid var(--ag-line); color: var(--ag-ink-72); font: inherit; font-size: 12px; cursor: pointer; }

@media (max-width: 980px) {
  .td-main { grid-template-columns: 1fr; }
  .td { padding-top: 88px; }
  .td .acts button { padding: 0 10px; }
  .bless { grid-template-columns: 1fr; }
  .bless button { min-height: 0; }
  .rank .rr { grid-template-columns: 44px 1fr 70px 70px; }
}
</style>
