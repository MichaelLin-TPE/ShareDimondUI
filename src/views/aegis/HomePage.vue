<script setup lang="ts">
// 首頁:Dune hero(滿版影片、內容貼底、兩行標題、hairline、兩欄說明列)+ 數字帶 + 最新消息 + 特色 + 進場 CTA。
import { onMounted, onUnmounted, ref } from 'vue'
import { AG_SITE } from './nav'
import { AG_NEWS } from '@/data/aegis/news'
import FocusText from './ui/FocusText.vue'

// ?v= 是快取版本號:換影片檔就 +1,否則回訪的瀏覽器會一直用舊檔
const videoSrc = `${import.meta.env.BASE_URL}aegis/hero.mp4?v=4`.replace('//aegis', '/aegis')
const rootEl = ref<HTMLElement | null>(null)
const latest = AG_NEWS.slice(0, 3)
// 這裡才有的玩法:挑無課也玩得到、第一眼會好奇的 8 個,點進去到特色頁對應段落
const HOOKS = [
  { id: 'boss', title: '首領積分', hook: '打王不用搶最後一刀', line: '打多少算多少,摸一下也有份。王掉的東西照貢獻分,不是誰補刀誰拿。' },
  { id: 'bounty', title: '懸賞令', hook: '每天三張懸賞單', line: '上線先接單,解完拿積分、娃娃精華、聲望。沒空打?委託別人解。' },
  { id: 'trial', title: '職業試煉', hook: '一隻 NPC 帶你從 15 級打到 50 級', line: '四場專屬任務,每過一場就發一套當下穿得上的裝備;50 級那件全服只有這裡拿得到。' },
  { id: 'season', title: '賽季', hook: '兩週一季,每個人的任務都不一樣', line: '每天抽 3 個、每週抽 4 個,分數升賽季等級領獎,累積分換變身卡。' },
  { id: 'codex', title: '裝備圖鑑', hook: '爛裝也有用', line: '打到的垃圾裝別丟,登錄收藏冊,全帳號永久加成。' },
  { id: 'fishing', title: '釣魚', hook: '掛個竿,錢跟屬性自己游過來', line: '沒空練功的晚上,丟根釣竿也在變強。' },
  { id: 'hourglass', title: '時光幣', hook: '在線就是在賺', line: '30 級以上每 30 分鐘一顆時光幣,5 顆開一袋,或拿去升時光符文。' },
  { id: 'dragonraid', title: '屠龍遠征', hook: '每天輪一條龍', line: '地龍、水龍、風龍輪著開,首通拿屠龍聖印。' },
]

// 數字帶:進視窗才跳數
const stats = [
  { n: 0, suffix: '', cap: '儲值能買到的裝備' },
  { n: 100, suffix: '', cap: '等級上限' },
  { n: 3, suffix: '', cap: '同 IP 多開' },
  { n: 13, suffix: '', cap: '收藏品 · 永久加屬性' },
]

// 三個問句:直接打到玩家換服的痛點
const WHY = [
  { q: '玩膩了短期服?', a: '開服三個月就收攤,練的角色全白費。這裡是長期經營,今天練的每一級,明年還在。' },
  { q: '還在玩賣裝備的服?', a: '這裡沒有儲值買強度這回事。王裝、符文、娃娃、收藏品,全部要自己打,誰都買不到捷徑。' },
  { q: '無課怕追不上人?', a: '強度只看你花的時間,不看你花的錢。元寶打王、簽到就有,機率全部公開,努力多少就強多少。' },
]
const shown = ref(stats.map(() => 0))
let io: IntersectionObserver | null = null
let counted = false

function runCount() {
  if (counted) return
  counted = true
  const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (rm) { shown.value = stats.map((s) => s.n); return }
  const t0 = performance.now(), dur = 1100
  const tick = (t: number) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3)
    shown.value = stats.map((s) => Math.round(s.n * e))
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

onMounted(() => {
  const root = rootEl.value
  const els = root ? Array.from(root.querySelectorAll('.ag-reveal')) : []
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); runCount(); return }
  io = new IntersectionObserver((en) => {
    en.forEach((x) => {
      if (!x.isIntersecting) return
      x.target.classList.add('in')
      if (x.target.classList.contains('stats')) runCount()
      if (io) io.unobserve(x.target)
    })
  }, { threshold: 0.15 })
  els.forEach((e) => io!.observe(e))
})
onUnmounted(() => { if (io) io.disconnect() })
</script>

<template>
  <div ref="rootEl">
    <section class="hero">
      <video class="vid" :src="videoSrc" autoplay muted loop playsinline></video>
      <div class="ov a"></div>
      <div class="ov b"></div>
      <div class="ov c"></div>
      <div class="ov d"></div>

      <div class="hero-body">
        <h1 class="ag-h ag-anim" style="--d: 0.15s; --y: 30px">
          <span class="l1"><FocusText :words="['不賣裝備,', '不開短期,', '強大', '靠自己打。']" /></span>
          <span class="thin">{{ AG_SITE.name }} {{ AG_SITE.latin }} · {{ AG_SITE.tagline }}</span>
        </h1>
        <div class="ag-line ag-anim grow hr" style="--d: 0.4s"></div>
        <div class="ag-row2 ag-anim" style="--d: 0.5s">
          <p class="ag-cap l">玩膩了短期服?還在玩賣裝備的服?<br />這裡賣的只有情懷,其餘的靠你自己打。</p>
          <div class="r">
            <p class="ag-body">無課不用怕追不上人。沒有儲值買強度,王裝、符文、娃娃全部從怪身上掉,元寶打王、簽到就有。</p>
            <p class="ag-body">每天三張懸賞單、兩週一季的隨機任務、輪流開的三條龍,上線永遠有事做。你記憶裡那個天堂,我們幫你留著。</p>
            <div class="cta">
              <RouterLink class="ag-btn primary" to="/aegis/play">點我玩遊戲 <span class="arr">→</span></RouterLink>
              <RouterLink class="ag-btn" to="/aegis/features">遊戲特色</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="ag-section why ag-reveal">
      <div class="ag-wrap">
        <div class="ag-sec-head">
          <div><div class="idx">01 // WHY</div><h2>為什麼回來這裡。</h2></div>
          <p class="ag-cap sub">三個問題,問過自己就懂。</p>
        </div>
        <div class="ag-grid c3">
          <article v-for="(w, i) in WHY" :key="w.q" class="ag-card wy">
            <div class="ci">// 0{{ i + 1 }}</div>
            <h3>{{ w.q }}</h3>
            <p>{{ w.a }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="ag-section stats ag-reveal">
      <div class="ag-wrap">
        <div class="stat-grid">
          <div v-for="(s, i) in stats" :key="s.cap" class="stat">
            <div class="n">{{ shown[i] }}<span v-if="s.suffix" class="u">{{ s.suffix }}</span></div>
            <div class="ag-cap">{{ s.cap }}</div>
          </div>
          <div class="stat">
            <div class="n">00:00</div>
            <div class="ag-cap">每日重置</div>
          </div>
        </div>
      </div>
    </section>

    <section class="ag-section ag-reveal">
      <div class="ag-wrap">
        <div class="ag-sec-head">
          <div><div class="idx">02 // NEWS</div><h2>最新消息</h2></div>
          <RouterLink to="/aegis/news" class="ag-cap more">全部消息 →</RouterLink>
        </div>
        <div class="news-list">
          <RouterLink v-for="n in latest" :key="n.id" :to="`/aegis/news#${n.id}`" class="news">
            <span class="d">{{ n.date }}</span>
            <span class="t">{{ n.tag }}</span>
            <span class="ti">{{ n.title }}</span>
            <span class="arr">→</span>
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="ag-section ag-reveal">
      <div class="ag-wrap">
        <div class="ag-sec-head">
          <div><div class="idx">03 // PLAY</div><h2>這裡才有的玩法。<span class="thin">不是只有練功。</span></h2></div>
          <RouterLink to="/aegis/features" class="ag-cap more">看全部特色 →</RouterLink>
        </div>
        <div class="ag-grid c4">
          <RouterLink v-for="(h, i) in HOOKS" :key="h.id" :to="`/aegis/features#${h.id}`" class="ag-card hk">
            <div class="ci">// 0{{ i + 1 }} · {{ h.title }}</div>
            <h3>{{ h.hook }}</h3>
            <p>{{ h.line }}</p>
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="ag-section ag-reveal enter">
      <div class="ag-wrap">
        <div class="ag-line"></div>
        <div class="ag-row2 en">
          <div class="l">
            <div class="ag-cap ember">04 // ENTER</div>
            <h2 class="ag-h">回來吧。<span class="thin">老地方,新的開始。</span></h2>
          </div>
          <div class="r">
            <p class="ag-body">下載登入器、解壓、點兩下,更新自己跑完就進遊戲。不用儲值、不用排隊,今晚就能回到那個天堂。沒有客戶端?找客服拿。</p>
            <div class="cta">
              <RouterLink class="ag-btn primary" to="/aegis/play">點我玩遊戲 <span class="arr">→</span></RouterLink>
              <RouterLink class="ag-btn" to="/aegis/contact">聯絡客服</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero { position: relative; width: 100%; height: 100svh; min-height: 560px; overflow: hidden; }
.vid { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* Dune 的三層覆蓋:整體 13% 暗、上下漸層、頂部一點暖光 */
.ov { position: absolute; pointer-events: none; }
.ov.a { inset: 0; background: rgba(0, 0, 0, 0.05); }
.ov.b { inset: 0; background: linear-gradient(to bottom, rgba(0, 0, 0, 0.17) 0%, transparent 22%, transparent 48%, rgba(0, 0, 0, 0.42) 72%, rgba(0, 0, 0, 0.72) 100%); }
/* 內容區再壓一層暗幕,字才站得住(Dune 原版底部只有 25%,中文細字看不清) */
.ov.d { left: 0; right: 0; bottom: 0; height: 42%; background: linear-gradient(to top, rgba(0, 0, 0, 0.48), rgba(0, 0, 0, 0)); }
.ov.c { top: -14%; left: 50%; transform: translateX(-50%); width: 1000px; height: 720px; background: radial-gradient(ellipse at 50% 30%, rgba(180, 83, 9, 0.05) 0%, transparent 68%); }

.hero-body { position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; padding: 0 var(--ag-gutter) 48px; display: flex; flex-direction: column; }
.hero-body h1 { text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6), 0 2px 40px rgba(0, 0, 0, 0.7); }
.hero-body h1 .thin { color: rgba(255, 255, 255, 0.78); }
.hero-body .l1 { display: block; white-space: nowrap; }
.hero-body .thin { white-space: nowrap; }
.hero-body .hr { margin: 28px 0 22px; }
.hero-body .ag-cap, .hero-body .ag-body { text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65), 0 1px 16px rgba(0, 0, 0, 0.6); }
.hero-body .ag-cap { color: rgba(255, 255, 255, 0.8); }
.hero-body .ag-body { color: rgba(255, 255, 255, 0.9); font-weight: 400; }
.hero-body .ag-line { background: rgba(255, 255, 255, 0.34); }
.cta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }

.why { padding-bottom: 0; }
.why .sub { color: var(--ag-ink-50); }
.wy { min-height: 0; }
.wy h3 { font-size: 1.25rem; font-family: var(--ag-font); margin-bottom: 12px; }
.wy p { font-size: 15px; line-height: 1.75; color: var(--ag-ink-60); }
.stats { padding: 0; }
.stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); border-bottom: 1px solid var(--ag-line-soft); }
.stat { padding: 30px 20px 26px; border-left: 1px solid var(--ag-line-soft); }
.stat:first-child { border-left: 0; padding-left: 0; }
.stat .n { font-size: clamp(1.8rem, 3.4vw, 2.6rem); font-weight: 200; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin-bottom: 10px; }
.stat .n .u { font-size: 0.5em; color: var(--ag-ember); }

.hk { min-height: 0; }
.hk h3 { font-size: 1.15rem; line-height: 1.4; }
.hk p { font-size: 14.5px; line-height: 1.7; color: var(--ag-ink-60); }
.more { color: var(--ag-ink-50); }
.more:hover { color: var(--ag-ink); }
.news-list { border-top: 1px solid var(--ag-line); }
.news { display: grid; grid-template-columns: 110px 60px 1fr 30px; align-items: baseline; gap: 18px; padding: 18px 0; border-bottom: 1px solid var(--ag-line-soft); transition: padding-left 0.25s; }
.news:hover { padding-left: 8px; }
.news .d { font-size: 11px; letter-spacing: 0.1em; color: var(--ag-ink-50); font-variant-numeric: tabular-nums; }
.news .t { font-size: 10px; letter-spacing: 0.16em; color: var(--ag-ember); }
.news .ti { font-size: 14px; font-weight: 300; color: var(--ag-ink); }
.news .arr { color: var(--ag-ink-35); text-align: right; }
.news:hover .arr { color: var(--ag-ember); }

.enter .en { padding: 40px 0 10px; }
.enter .ag-h { margin-top: 12px; }

@media (max-width: 960px) {
  .stat-grid { grid-template-columns: repeat(3, 1fr); }
  .stat:nth-child(4) { border-left: 0; padding-left: 0; }
  .news { grid-template-columns: 96px 1fr 24px; }
  .news .t { display: none; }
}
@media (max-width: 600px) {
  .hero-body { padding-bottom: 32px; }
  .hero-body .l1, .hero-body .thin { white-space: normal; }
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .stat:nth-child(odd) { border-left: 0; padding-left: 0; }
  .stat:nth-child(4) { border-left: 1px solid var(--ag-line-soft); padding-left: 20px; }
}
</style>
