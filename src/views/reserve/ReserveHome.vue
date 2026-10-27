<script setup lang="ts">
// 事前預約首頁:首屏(人數 + 立即預約)→ 預約進度與全服里程碑獎勵 → 職業 → 流程 → 天堂塔防 → 收尾。
// 預約流程本身在 /reserve/create(PreregPage),這頁只負責把人帶進去。
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AG_CLASSES } from '@/data/aegis/classes'
import { RV_MILESTONES, RV_SHARE_URL, RV_STEPS } from '@/data/aegis/reserve'
import { fetchStats, session } from '@/views/aegis/prereg/api'

const route = useRoute()
const router = useRouter()
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const videoSrc = `${base}/aegis/hero.mp4?v=4`
const stillSrc = `${base}/aegis/hero-still.jpg?v=4`
const TD = `${base}/aegis/td/`
const showVideo = ref(false)

// ---------- 預約人數 ----------
const total = ref<number | null>(null)
const shown = ref(0)
function countUp(to: number) {
  const rm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (rm || to <= 0) { shown.value = to; return }
  const t0 = performance.now(), dur = 1400
  const tick = (t: number) => {
    const p = Math.min(1, (t - t0) / dur)
    shown.value = Math.round(to * (1 - Math.pow(1 - p, 3)))
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
const fmt = (n: number) => n.toLocaleString('en-US')

/** 里程碑節點平均排開,進度條照「目前落在哪一段、這段走了幾成」算,人少的時候也看得到在動 */
const fill = computed(() => {
  const c = total.value ?? 0
  const n = RV_MILESTONES.length
  for (let k = 0; k < n; k++) {
    const prev = k === 0 ? 0 : RV_MILESTONES[k - 1]!.count
    const cur = RV_MILESTONES[k]!.count
    if (c < cur) return ((k + (c - prev) / (cur - prev)) / n) * 100
  }
  return 100
})
const nextGoal = computed(() => RV_MILESTONES.find((m) => (total.value ?? 0) < m.count) ?? null)
const reached = (count: number) => (total.value ?? 0) >= count

// ---------- 職業 ----------
const cls = ref(0)
const sex = ref(0)
const art = computed(() => `${base}/aegis/prereg/bg/${cls.value}_${sex.value}.jpg`)
const curClass = computed(() => AG_CLASSES[cls.value]!)

// ---------- 分享 ----------
const copied = ref(false)
const lineShare = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(RV_SHARE_URL)}`
async function copyLink() {
  try {
    await navigator.clipboard.writeText(RV_SHARE_URL)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1800)
  } catch { /* 不支援剪貼簿就算了 */ }
}

// ---------- 進場動畫 + 錨點 ----------
const rootEl = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null
function goHash() {
  const id = (route.hash || '').replace('#', '')
  if (id) nextTick(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
watch(() => route.hash, goHash)
function toRewards() {
  if (route.hash === '#rewards') goHash()
  else router.push({ path: '/reserve', hash: '#rewards' })
}

onMounted(() => {
  const rm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  showVideo.value = !rm && !!window.matchMedia?.('(min-width: 960px)').matches
  fetchStats().then((s) => { total.value = s.accounts; countUp(s.accounts) }).catch(() => { total.value = 0 })
  const els = rootEl.value ? Array.from(rootEl.value.querySelectorAll('.rv-in')) : []
  if (!('IntersectionObserver' in window)) els.forEach((e) => e.classList.add('in'))
  else {
    io = new IntersectionObserver((en) => en.forEach((x) => {
      if (x.isIntersecting) { x.target.classList.add('in'); io?.unobserve(x.target) }
    }), { threshold: 0.12 })
    els.forEach((e) => io!.observe(e))
  }
  goHash()
})
onUnmounted(() => io?.disconnect())
</script>

<template>
  <div ref="rootEl" class="rv">
    <!-- ========== 首屏 ========== -->
    <section class="hero">
      <img class="media" :src="stillSrc" alt="" />
      <video v-if="showVideo" class="media vid" :src="videoSrc" autoplay muted loop playsinline></video>
      <div class="shade"></div>

      <div class="hero-in">
        <div class="live ag-anim" style="--d: 0.1s"><i></i>事前預約進行中</div>
        <h1 class="ag-anim" style="--d: 0.2s; --y: 26px">神盾天堂<span>AEGIS</span></h1>
        <p class="lead ag-anim" style="--d: 0.35s">3.81 經典天堂。名字先搶,開服直接上線。</p>

        <div class="count ag-anim" style="--d: 0.5s">
          <span class="lb">目前預約人數</span>
          <b>{{ total === null ? '—' : fmt(shown) }}</b>
          <span v-if="nextGoal && total !== null" class="nx">再 {{ fmt(nextGoal.count - total) }} 人解鎖「{{ nextGoal.title }}」</span>
          <span v-else-if="total !== null" class="nx">全部獎勵已解鎖</span>
        </div>

        <div class="acts ag-anim" style="--d: 0.65s">
          <RouterLink to="/reserve/create" class="btn pri">{{ session.character ? '查看我的角色' : '立即預約' }}<span>→</span></RouterLink>
          <RouterLink to="/reserve/td" class="btn">玩天堂塔防</RouterLink>
        </div>
        <p v-if="session.character" class="mine ag-anim" style="--d: 0.75s">
          你已預約 <b>{{ session.character.name }}</b> · {{ session.character.clsName }}
        </p>
      </div>
      <a href="#" class="scroll" aria-label="往下看預約獎勵" @click.prevent="toRewards"><span></span></a>
    </section>

    <!-- ========== 預約進度 + 里程碑 ========== -->
    <section id="rewards" class="sec">
      <div class="ag-wrap">
        <div class="hd rv-in">
          <div class="ag-cap ember">MILESTONE REWARDS</div>
          <h2>預約人數達標,全服一起領</h2>
          <p>每個預約帳號開服都領得到。人越多,獎勵越好。</p>
        </div>

        <div class="prog rv-in">
          <div class="now">
            <span>目前</span><b>{{ total === null ? '—' : fmt(shown) }}</b><span>人</span>
          </div>
          <div class="track">
            <div class="rail"><div class="bar" :style="{ width: fill + '%' }"><i></i></div></div>
            <div v-for="(m, i) in RV_MILESTONES" :key="m.count" class="node" :class="{ on: reached(m.count) }"
              :style="{ left: ((i + 1) / RV_MILESTONES.length) * 100 + '%' }">
              <span class="dot"></span>
              <span class="lb">{{ fmt(m.count) }}</span>
            </div>
          </div>
        </div>

        <div class="cards">
          <article v-for="(m, i) in RV_MILESTONES" :key="m.count" class="card rv-in" :class="{ on: reached(m.count), next: nextGoal === m }" :style="{ '--d': i * 0.07 + 's' }">
            <div class="ic" aria-hidden="true">
              <svg v-if="m.icon === 'potion'" viewBox="0 0 48 48"><path d="M19 6h10M21 6v9L11 33a8 8 0 0 0 7 11h12a8 8 0 0 0 7-11L27 15V6" /><path d="M15 30h18" /><circle cx="22" cy="36" r="1.6" /><circle cx="28" cy="33" r="1.2" /></svg>
              <svg v-else-if="m.icon === 'scroll'" viewBox="0 0 48 48"><path d="M12 10h22a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H16" /><path d="M12 10a4 4 0 0 0-4 4v2h8v-2a4 4 0 0 0-4-4Z" /><path d="M16 16v22a4 4 0 0 1-8 0" /><path d="M22 20h10M22 26h10M22 32h6" /></svg>
              <svg v-else-if="m.icon === 'hourglass'" viewBox="0 0 48 48"><path d="M12 6h24M12 42h24" /><path d="M15 6c0 10 9 12 9 18s-9 8-9 18M33 6c0 10-9 12-9 18s9 8 9 18" /><path d="M19 38c2-3 3-4 5-4s3 1 5 4Z" /></svg>
              <svg v-else-if="m.icon === 'doll'" viewBox="0 0 48 48"><circle cx="24" cy="18" r="7" /><path d="M12 42c0-9 5-15 12-15s12 6 12 15Z" /><path d="M24 1.5l1.6 3.4 3.4.6-2.6 2.2.8 3.6L24 9.5l-3.2 1.8.8-3.6L19 5.5l3.4-.6Z" /></svg>
              <svg v-else viewBox="0 0 48 48"><path d="M6 16l9 8 9-14 9 14 9-8-4 22H10Z" /><path d="M10 42h28" /><circle cx="24" cy="28" r="3" /></svg>
            </div>
            <div class="goal">{{ fmt(m.count) }} 人</div>
            <h3>{{ m.title }}</h3>
            <ul><li v-for="it in m.items" :key="it">{{ it }}</li></ul>
            <div class="st">
              <template v-if="reached(m.count)">已達成</template>
              <template v-else-if="nextGoal === m && total !== null">還差 {{ fmt(m.count - total) }} 人</template>
              <template v-else>未解鎖</template>
            </div>
          </article>
        </div>

        <div class="share rv-in">
          <div>
            <b>找朋友一起預約</b>
            <span>把網址傳出去,人數越快到,大家越早解鎖。</span>
          </div>
          <div class="sb">
            <a class="btn line" :href="lineShare" target="_blank" rel="noopener">分享到 LINE</a>
            <a class="btn" href="#" @click.prevent="copyLink">{{ copied ? '已複製網址' : '複製網址' }}</a>
          </div>
        </div>
      </div>
    </section>

    <!-- ========== 職業 ========== -->
    <section id="classes" class="sec cls">
      <div class="ag-wrap">
        <div class="hd rv-in">
          <div class="ag-cap ember">CHOOSE YOUR CLASS</div>
          <h2>五大職業,先選好再開服</h2>
        </div>
        <div class="cls-box rv-in">
          <div class="art">
            <Transition name="fade"><img :key="art" :src="art" :alt="curClass.name" /></Transition>
            <div class="info">
              <div class="lt">{{ curClass.latin }}</div>
              <div class="nm">{{ curClass.name }}</div>
              <div class="rl">{{ curClass.role }}</div>
              <div class="row">
                <RouterLink :to="{ path: '/reserve/create', query: { cls, sex } }" class="btn pri">用{{ curClass.name }}預約<span>→</span></RouterLink>
                <div class="sex">
                  <a href="#" :class="{ on: sex === 0 }" @click.prevent="sex = 0">男</a>
                  <a href="#" :class="{ on: sex === 1 }" @click.prevent="sex = 1">女</a>
                </div>
              </div>
            </div>
          </div>
          <div class="tabs">
            <a v-for="(c, i) in AG_CLASSES" :key="c.id" href="#" :class="{ on: cls === i }" @click.prevent="cls = i">
              <span class="n">{{ String(i + 1).padStart(2, '0') }}</span>{{ c.name }}
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- ========== 流程 ========== -->
    <section class="sec steps">
      <div class="ag-wrap">
        <div class="hd rv-in">
          <div class="ag-cap ember">HOW IT WORKS</div>
          <h2>三步完成預約</h2>
        </div>
        <ol class="st3">
          <li v-for="(s, i) in RV_STEPS" :key="s.n" class="rv-in" :style="{ '--d': i * 0.08 + 's' }">
            <span class="n">{{ s.n }}</span>
            <b>{{ s.t }}</b>
            <p>{{ s.d }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- ========== 天堂塔防 ========== -->
    <section id="td" class="sec td">
      <div class="ag-wrap">
        <div class="td-box rv-in">
          <div class="tx">
            <div class="ag-cap ember">預約期間限定</div>
            <h2>天堂塔防</h2>
            <ul>
              <li>有帳號就能玩,不用先創角</li>
              <li>守住女神像,波數越多排行越前</li>
              <li>最終排行前段,開服發獎</li>
            </ul>
            <div class="row">
              <RouterLink to="/reserve/td" class="btn pri">進入塔防<span>→</span></RouterLink>
            </div>
          </div>
          <div class="vis" aria-hidden="true">
            <div class="glow"></div>
            <img class="gd" :src="TD + 'goddess.webp'" alt="" />
            <img class="h h1" :src="TD + 'cls1_idle.webp'" alt="" />
            <img class="h h2" :src="TD + 'cls0_idle.webp'" alt="" />
            <img class="h h3" :src="TD + 'cls2_idle.webp'" alt="" />
            <img class="bs" :src="TD + 'boss0.webp'" alt="" />
          </div>
        </div>
      </div>
    </section>

    <!-- ========== 收尾 ========== -->
    <section class="sec end">
      <div class="ag-wrap rv-in">
        <h2><span>開服那天,</span><span>你的角色已經在了。</span></h2>
        <div class="acts">
          <RouterLink to="/reserve/create" class="btn pri">{{ session.character ? '查看我的角色' : '立即預約' }}<span>→</span></RouterLink>
          <RouterLink to="/aegis" class="btn">遊戲官網</RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.rv { --gold: #f3c77a; }

/* 按鈕(用 <a>,避開官網 button 被 all:unset 洗掉) */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 12px; height: 52px; padding: 0 30px;
  font-size: 15px; font-weight: 500; letter-spacing: 0.14em; color: var(--ag-ink); border: 1px solid rgba(255, 255, 255, 0.45);
  background: rgba(0, 0, 0, 0.35); backdrop-filter: blur(4px); white-space: nowrap;
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
  transition: border-color 0.2s, box-shadow 0.2s, filter 0.2s;
}
.btn:hover { border-color: #fff; color: #fff; }
.btn.pri { background: var(--ag-ember); border-color: var(--ag-ember); color: #140900; font-weight: 600; }
.btn.pri:hover { box-shadow: 0 0 34px var(--ag-ember-glow); filter: brightness(1.08); color: #140900; }
.btn.pri span { transition: transform 0.2s; }
.btn.pri:hover span { transform: translateX(4px); }

/* 進場 */
.rv-in { opacity: 0; transform: translateY(22px); transition: opacity 0.8s ease-out, transform 0.8s ease-out; transition-delay: var(--d, 0s); }
.rv-in.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .rv-in { opacity: 1; transform: none; transition: none; } }

/* ---------- 首屏 ---------- */
.hero { position: relative; height: 100svh; min-height: 640px; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
.hero .media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 40%; }
.hero .vid { opacity: 0; animation: vin 1.4s ease-out 0.2s forwards; }
@keyframes vin { to { opacity: 1; } }
.hero .shade { position: absolute; inset: 0; background:
  radial-gradient(70% 55% at 50% 62%, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0) 70%),
  linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.05) 30%, rgba(0, 0, 0, 0.55) 70%, #000 100%); }
.hero-in { position: relative; z-index: 1; width: 100%; max-width: 900px; padding: 0 16px 13vh; text-align: center; display: flex; flex-direction: column; align-items: center; }
.live { display: inline-flex; align-items: center; gap: 10px; padding: 7px 16px; font-size: 13px; letter-spacing: 0.24em; color: var(--gold); border: 1px solid rgba(243, 199, 122, 0.5); background: rgba(0, 0, 0, 0.4); }
.live i { width: 7px; height: 7px; border-radius: 50%; background: var(--ag-ember); box-shadow: 0 0 10px var(--ag-ember); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.25; } }
.hero h1 { margin-top: 22px; font-size: clamp(52px, 9vw, 112px); font-weight: 600; letter-spacing: 0.12em; line-height: 1; text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6); padding-left: 0.12em; }
.hero h1 span { display: block; margin-top: 14px; font-size: clamp(13px, 1.4vw, 16px); font-weight: 300; letter-spacing: 0.9em; color: var(--ag-ink-72); padding-left: 0.9em; }
.hero .lead { margin-top: 22px; font-size: clamp(15px, 1.6vw, 19px); color: rgba(255, 255, 255, 0.86); letter-spacing: 0.08em; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8); }
.count { margin-top: 34px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.count .lb { font-size: 13px; letter-spacing: 0.3em; color: var(--ag-ink-60); }
.count b { font-size: clamp(44px, 6vw, 68px); font-weight: 300; letter-spacing: 0.04em; color: #fff; font-variant-numeric: tabular-nums; line-height: 1.1; text-shadow: 0 0 30px rgba(232, 132, 42, 0.45); }
.count .nx { font-size: 14px; color: var(--gold); letter-spacing: 0.06em; }
.hero .acts { margin-top: 30px; display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
.hero .mine { margin-top: 18px; font-size: 14.5px; color: var(--ag-ink-72); }
.hero .mine b { color: var(--gold); font-weight: 500; }
.scroll { position: absolute; z-index: 1; bottom: 26px; left: 50%; width: 24px; height: 38px; margin-left: -12px; border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 12px; }
.scroll span { position: absolute; left: 50%; top: 8px; width: 2px; height: 8px; margin-left: -1px; background: #fff; border-radius: 1px; animation: sc 1.8s ease-in-out infinite; }
@keyframes sc { 0% { opacity: 0; transform: translateY(0); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(12px); } }

/* ---------- 共用段落 ---------- */
.sec { padding: 110px 0 0; scroll-margin-top: 50px; }
.hd { text-align: center; margin-bottom: 48px; }
.hd h2, .td h2, .end h2 { margin-top: 10px; font-size: clamp(26px, 3.4vw, 40px); font-weight: 500; letter-spacing: 0.06em; }
.hd p { margin-top: 12px; font-size: 16px; color: var(--ag-ink-60); }

/* ---------- 進度 ---------- */
.prog { display: flex; align-items: center; gap: 40px; padding: 30px 36px 46px; border: 1px solid var(--ag-line-soft); background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)); }
.prog .now { flex-shrink: 0; display: flex; align-items: baseline; gap: 8px; color: var(--ag-ink-60); font-size: 14px; }
.prog .now b { font-size: 40px; font-weight: 300; color: #fff; font-variant-numeric: tabular-nums; }
.track { position: relative; flex: 1; height: 10px; margin-right: 18px; }
.rail { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.1); }
.bar { position: relative; height: 100%; background: linear-gradient(90deg, #a8531a, var(--ag-ember) 70%, var(--gold)); transition: width 1.4s cubic-bezier(0.2, 0.7, 0.2, 1); }
.bar i { position: absolute; right: -9px; top: 50%; width: 18px; height: 18px; margin-top: -9px; border-radius: 50%; background: radial-gradient(circle, #fff 0, var(--gold) 30%, rgba(232, 132, 42, 0) 70%); }
.node { position: absolute; top: 50%; transform: translate(-50%, -50%); }
.node .dot { display: block; width: 16px; height: 16px; transform: rotate(45deg); background: #111; border: 2px solid rgba(255, 255, 255, 0.35); }
.node.on .dot { background: var(--gold); border-color: #fff4d8; box-shadow: 0 0 14px var(--ag-ember); }
.node .lb { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); font-size: 13px; color: var(--ag-ink-50); white-space: nowrap; font-variant-numeric: tabular-nums; }
.node.on .lb { color: var(--gold); }

.cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
.card { position: relative; padding: 26px 20px 20px; border: 1px solid var(--ag-line-soft); background: rgba(255, 255, 255, 0.025); display: flex; flex-direction: column; }
.card .ic svg { width: 46px; height: 46px; fill: none; stroke: var(--ag-ink-35); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.card .goal { margin-top: 16px; font-size: 13px; letter-spacing: 0.12em; color: var(--ag-ink-50); font-variant-numeric: tabular-nums; }
.card h3 { margin: 4px 0 0; font-size: 19px; font-weight: 500; letter-spacing: 0.06em; color: var(--ag-ink-72); }
.card ul { list-style: none; margin: 14px 0 0; padding: 14px 0 0; border-top: 1px solid var(--ag-line-soft); display: flex; flex-direction: column; gap: 7px; flex: 1; }
.card li { font-size: 14.5px; color: var(--ag-ink-60); line-height: 1.45; }
.card .st { margin-top: 18px; font-size: 12.5px; letter-spacing: 0.14em; color: var(--ag-ink-35); }
.card.next { border-color: rgba(232, 132, 42, 0.6); background: linear-gradient(180deg, rgba(232, 132, 42, 0.12), rgba(232, 132, 42, 0.02)); }
.card.next .ic svg { stroke: var(--ag-ember); }
.card.next h3 { color: #fff; }
.card.next .st { color: var(--ag-ember); }
.card.on { border-color: rgba(243, 199, 122, 0.55); background: linear-gradient(180deg, rgba(243, 199, 122, 0.14), rgba(243, 199, 122, 0.03)); }
.card.on .ic svg { stroke: var(--gold); }
.card.on h3 { color: #fff; }
.card.on li { color: var(--ag-ink-72); }
.card.on .st { color: var(--gold); }

.share { margin-top: 18px; padding: 22px 28px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; border: 1px solid var(--ag-line-soft); }
.share b { display: block; font-size: 17px; font-weight: 500; letter-spacing: 0.06em; }
.share span { font-size: 14.5px; color: var(--ag-ink-60); }
.share .sb { display: flex; gap: 10px; flex-wrap: wrap; }
.share .btn { height: 44px; padding: 0 22px; font-size: 14px; letter-spacing: 0.08em; }
.share .btn.line { background: #06c755; border-color: #06c755; color: #fff; }
.share .btn.line:hover { filter: brightness(1.08); }

/* ---------- 職業 ---------- */
.cls-box { border: 1px solid var(--ag-line-soft); }
.art { position: relative; aspect-ratio: 16 / 7.2; overflow: hidden; background: #050505; }
.art img { position: absolute; right: 0; top: 0; height: 100%; width: auto; aspect-ratio: 4 / 3; object-fit: cover; }
.art::before { content: ''; position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, #050505 34%, rgba(5, 5, 5, 0.6) 48%, rgba(5, 5, 5, 0) 66%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.info { position: absolute; z-index: 2; left: 6%; top: 50%; transform: translateY(-50%); max-width: 44%; }
.info .lt { font-size: 13px; letter-spacing: 0.5em; color: var(--ag-ember); }
.info .nm { margin-top: 8px; font-size: clamp(40px, 5vw, 64px); font-weight: 600; letter-spacing: 0.12em; line-height: 1.05; }
.info .rl { margin-top: 12px; font-size: 17px; color: var(--gold); letter-spacing: 0.06em; }
.info .row { margin-top: 30px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.sex { display: flex; border: 1px solid var(--ag-line); }
.sex a { width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 15px; color: var(--ag-ink-50); }
.sex a.on { background: rgba(255, 255, 255, 0.12); color: #fff; }
.tabs { display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid var(--ag-line-soft); }
.tabs a { position: relative; padding: 20px 0; text-align: center; font-size: 17px; letter-spacing: 0.12em; color: var(--ag-ink-50); border-left: 1px solid var(--ag-line-soft); transition: color 0.2s, background 0.2s; }
.tabs a:first-child { border-left: 0; }
.tabs a .n { display: block; font-size: 11px; letter-spacing: 0.2em; color: var(--ag-ink-35); margin-bottom: 4px; }
.tabs a:hover { color: #fff; }
.tabs a.on { color: #fff; background: rgba(232, 132, 42, 0.1); }
.tabs a.on::before { content: ''; position: absolute; left: 0; right: 0; top: -1px; height: 2px; background: var(--ag-ember); }
.tabs a.on .n { color: var(--ag-ember); }

/* ---------- 流程 ---------- */
.st3 { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.st3 li { padding: 30px 28px; border: 1px solid var(--ag-line-soft); background: rgba(255, 255, 255, 0.02); }
.st3 .n { font-size: 34px; font-weight: 200; color: var(--ag-ember); letter-spacing: 0.04em; }
.st3 b { display: block; margin-top: 12px; font-size: 19px; font-weight: 500; letter-spacing: 0.08em; }
.st3 p { margin-top: 8px; font-size: 15px; line-height: 1.6; color: var(--ag-ink-60); }

/* ---------- 塔防 ---------- */
.td-box { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 40px; padding: 48px 56px; border: 1px solid var(--ag-line-soft);
  background: radial-gradient(70% 90% at 78% 50%, rgba(232, 132, 42, 0.16), rgba(0, 0, 0, 0) 70%), rgba(255, 255, 255, 0.02); }
.td ul { margin: 22px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; }
.td li { position: relative; padding-left: 22px; font-size: 16px; color: var(--ag-ink-72); }
.td li::before { content: ''; position: absolute; left: 0; top: 9px; width: 7px; height: 7px; transform: rotate(45deg); background: var(--ag-ember); }
.td .row { margin-top: 30px; }
.vis { position: relative; height: 340px; }
.vis .glow { position: absolute; left: 50%; top: 52%; width: 300px; height: 300px; margin: -150px 0 0 -150px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 214, 140, 0.35), rgba(232, 132, 42, 0) 70%); }
.vis img { position: absolute; filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.6)); }
.vis .gd { left: 50%; top: 4%; width: 190px; margin-left: -95px; }
.vis .h { width: 108px; }
.vis .h1 { left: 12%; top: 46%; }
.vis .h2 { left: 30%; top: 60%; }
.vis .h3 { right: 26%; top: 60%; }
.vis .bs { right: 0; top: 34%; width: 150px; transform: scaleX(-1); }

/* ---------- 收尾 ---------- */
.end { padding-bottom: 110px; text-align: center; }
.end h2 span { display: inline-block; }
.end .acts { margin-top: 30px; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

@media (max-width: 1100px) {
  .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 860px) {
  .sec { padding-top: 76px; }
  .hd { margin-bottom: 30px; }
  .prog { flex-direction: column; align-items: stretch; gap: 22px; padding: 22px 18px 44px; }
  .prog .now { justify-content: center; }
  .track { margin: 0 16px; }
  .node .lb { font-size: 11.5px; }
  .cards { grid-template-columns: 1fr; gap: 10px; }
  .card { display: grid; grid-template-columns: 48px 1fr auto; column-gap: 14px; align-items: start; padding: 18px 16px; }
  .card .ic { grid-row: span 3; }
  .card .ic svg { width: 40px; height: 40px; }
  .card .goal { margin: 0; grid-column: 2; }
  .card h3 { grid-column: 2; font-size: 17px; }
  .card ul { grid-column: 2 / 4; margin-top: 10px; padding-top: 10px; }
  .card .st { grid-column: 3; grid-row: 1; margin: 0; }
  .share { padding: 18px; }
  .share .sb { width: 100%; }
  .share .btn { flex: 1; }
  .art { aspect-ratio: 4 / 3; }
  .art img { width: 100%; }
  .art::before { background: linear-gradient(0deg, #050505 4%, rgba(5, 5, 5, 0.75) 32%, rgba(5, 5, 5, 0) 60%); }
  .info { top: auto; bottom: 18px; left: 16px; right: 16px; transform: none; max-width: none; }
  .info .nm { font-size: 38px; }
  .info .rl { font-size: 15px; margin-top: 6px; }
  .info .row { margin-top: 16px; gap: 10px; }
  .info .btn { height: 46px; padding: 0 18px; font-size: 14px; }
  .sex a { width: 44px; height: 44px; }
  .tabs a { padding: 14px 0; font-size: 14.5px; letter-spacing: 0.04em; }
  .st3 { grid-template-columns: 1fr; gap: 10px; }
  .st3 li { padding: 20px; display: grid; grid-template-columns: 56px 1fr; column-gap: 10px; }
  .st3 .n { grid-row: span 2; font-size: 30px; }
  .st3 b { margin-top: 2px; }
  .st3 p { margin-top: 4px; }
  .td-box { grid-template-columns: 1fr; padding: 28px 18px; gap: 10px; }
  .vis { height: 250px; order: -1; }
  .vis .gd { width: 140px; margin-left: -70px; }
  .vis .h { width: 78px; }
  .vis .bs { width: 108px; }
  .end { padding-bottom: 80px; }
  .btn { height: 48px; padding: 0 24px; font-size: 14.5px; }
}
</style>
