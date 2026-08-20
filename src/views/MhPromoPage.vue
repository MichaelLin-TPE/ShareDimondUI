<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const rootEl = ref<HTMLElement | null>(null)
const glCanvas = ref<HTMLCanvasElement | null>(null)
const lockEl = ref<HTMLElement | null>(null)
const hintEl = ref<HTMLElement | null>(null)

let sceneCleanup: (() => void) | null = null
let revealIo: IntersectionObserver | null = null
let lockTimer: ReturnType<typeof setInterval> | null = null
let hideHint: (() => void) | null = null
let disposed = false

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' })
}

onMounted(() => {
  // Google Fonts (idempotent)
  const FID = 'mh-promo-fonts'
  if (!document.getElementById(FID)) {
    const l = document.createElement('link')
    l.id = FID
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700;900&display=swap'
    document.head.appendChild(l)
  }

  const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const root = rootEl.value
  const els = root ? Array.from(root.querySelectorAll('.reveal:not(.in)')) : []
  if (rm || !('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'))
  } else {
    revealIo = new IntersectionObserver(
      (en) => {
        en.forEach((x) => {
          if (x.isIntersecting) {
            x.target.classList.add('in')
            revealIo && revealIo.unobserve(x.target)
          }
        })
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((e) => revealIo!.observe(e))
  }

  const lc = lockEl.value
  if (lc && !rm) {
    const seq = ['01', '02', '03', '03', '03']
    let i = 0
    lockTimer = setInterval(() => {
      lc.textContent = seq[i] ?? '03'
      i++
      if (i >= seq.length && lockTimer) {
        clearInterval(lockTimer)
        lockTimer = null
      }
    }, 640)
  }

  // 首次點擊後淡出「點擊提示」
  hideHint = () => { if (hintEl.value) hintEl.value.classList.add('gone') }
  window.addEventListener('pointerdown', hideHint, { once: true })

  // WebGL scene — dynamically imported so three.js only loads on /mh
  if (glCanvas.value) {
    import('./mhScene')
      .then((m) => {
        if (disposed || !glCanvas.value) return
        sceneCleanup = m.initMhScene(glCanvas.value)
      })
      .catch(() => {
        /* WebGL/module load failed — page still works with the dark backdrop */
      })
  }
})

onUnmounted(() => {
  disposed = true
  if (sceneCleanup) sceneCleanup()
  if (revealIo) revealIo.disconnect()
  if (lockTimer) clearInterval(lockTimer)
  if (hideHint) window.removeEventListener('pointerdown', hideHint)
})
</script>

<template>
  <div class="mh-root" ref="rootEl">
    <canvas class="gl" ref="glCanvas"></canvas>
    <div class="gl-scrim"></div>

    <div class="topbar">
      <div class="wrap">
        <div class="brand"><span class="glyph"></span><b>MotionHunter</b></div>
        <a class="nav-cta" href="#" @click.prevent="scrollToId('contact')">聯絡客服</a>
      </div>
    </div>

    <header class="hero">
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
      <div class="hud h-tr"><span class="k">MODE</span> <span class="v">AUTO-HUNT</span><br /><span class="k">SWEEP</span> <span class="v">ACTIVE</span></div>
      <div class="hud h-bl"><span class="k">STATUS</span> <span class="v g">HUNTING</span></div>
      <div class="hud h-br"><span class="k">LOCKED</span> <span class="v a" ref="lockEl">03</span> <span class="k">/ TARGETS</span></div>
      <div class="wrap">
        <div class="hero-inner">
          <div class="eyebrow"><span class="dot"></span>AUTO-HUNT SYSTEM // LINEAGE</div>
          <h1>掛上就走,<br />它<span class="hl">替你打</span>。</h1>
          <p class="lead">自動鎖怪、自動開打、自動補血——你人不用顧。<b style="color: var(--ink)">不碰遊戲本體、天生避開反作弊偵測</b>,理論上<b style="color: var(--ink)">適用任一版本的天堂</b>,放心掛、安心刷。</p>
          <div class="cta-row">
            <a class="btn btn-primary" href="#" @click.prevent="scrollToId('contact')">有興趣?聯絡客服 →</a>
            <a class="btn btn-ghost" href="#" @click.prevent="scrollToId('combat')">看它會什麼 ↓</a>
          </div>
          <div class="hero-note">// 適用各版本天堂 Lineage · 月租制 NT$2,000／月 · 專人協助設定</div>
          <div class="click-hint" ref="hintEl">◎ 試著點一下戰場 — 發送雷達脈衝</div>
        </div>
      </div>
      <div class="scrolldn">SCROLL<span class="bar"></span></div>
    </header>

    <section class="demo3d">
      <div class="wrap">
        <div class="demo-cap reveal">
          <span class="tag">LIVE DEMO // 01</span>
          <h3>鎖定 → 出手 → 清怪</h3>
          <p>自動鎖住周圍的怪,一隻接一隻清掉——琥珀環一亮就是命中。你只要在旁邊看它幫你打。</p>
        </div>
        <div class="demo-cap right reveal">
          <span class="tag amber">PATROL // 02</span>
          <h3>祝瞬自動巡場</h3>
          <p>綠色標記就是你的角色:清完一點就瞬移到下一點,多定點循環——一張圖自己輪流刷,人不用顧。</p>
        </div>
      </div>
    </section>

    <div class="page-body">
      <div class="telemetry reveal">
        <div class="wrap">
          <div class="tcell"><div class="num">0<span class="u"> 偵測</span></div><div class="cap">天生避開反作弊,安心掛機不擔心</div></div>
          <div class="tcell"><div class="num">1<span class="u"> 鍵</span></div><div class="cap">開好就掛,一鍵開始 / 暫停</div></div>
          <div class="tcell"><div class="num">24/7</div><div class="cap">手機隨處遠端看狀態 · 看即時畫面</div></div>
          <div class="tcell"><div class="num">Auto</div><div class="cap">打怪、補血、巡場全自動,人不用顧</div></div>
        </div>
      </div>

      <section id="combat">
        <div class="wrap">
          <div class="sec-head reveal">
            <div>
              <div class="idx">01 // 核心獵殺</div>
              <h2 style="margin-top: 12px">上線,就開始打。</h2>
              <p>自動鎖定周圍的怪、一隻接一隻清——你只要顧著吃經驗、看背包變滿。</p>
            </div>
            <span class="tag">COMBAT · CORE</span>
          </div>
          <div class="modules grid-5 reveal">
            <div class="card lead">
              <div>
                <div class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.4" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></svg></div>
                <div class="ci">// PRIMARY</div>
                <h3>自動鎖怪 · 自動開打</h3>
                <p>上線就自動鎖住周圍的怪、一隻接一隻清,你人不用守著。<b style="color: var(--ink)">不碰遊戲本體、天生避開反作弊偵測</b>——掛得安心,是 MH 最讓人放心的底氣。</p>
              </div>
              <div class="big-num">// AUTO-LOCK · 安心不被抓</div>
            </div>
            <div class="card"><div class="ci">// RADAR</div><h3>聰明選怪</h3><p>自動挑<span class="k">最近、最密</span>的怪先打,不亂跑、不空砍,清得又快又順。</p></div>
            <div class="card"><div class="ci">// SAFE</div><h3>牆後的怪自動略過</h3><p>會避開<span class="k">打不到的怪</span>,不對著空氣猛砍、不浪費時間掛乾等。</p></div>
            <div class="card"><div class="ci">// ZONE</div><h3>不誤點自己</h3><p>可框出自己和安全區自動避開,不會誤點到角色,安穩掛不出包。</p></div>
            <div class="card"><div class="ci">// FILTER</div><h3>近身反擊 · 略過死怪</h3><p>死掉的怪自動略過、被貼身就先反擊,每一下都打在刀口上。</p></div>
          </div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="sec-head reveal">
            <div>
              <div class="idx">02 // 自動化整合</div>
              <h2 style="margin-top: 12px">掛上就走,細節它顧。</h2>
              <p>巡場練功、補血補魔、危險自動閃——掛機真正需要的,一次幫你顧好。</p>
            </div>
            <span class="tag amber">AUTOMATION</span>
          </div>
          <div class="modules grid-4 reveal">
            <div class="card span2">
              <div class="icon" style="color: var(--lock)"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7M21 3.5V8h-4.5" /><circle cx="12" cy="12" r="2.4" /></svg></div>
              <div class="ci">// PATROL · 巡場練功</div>
              <h3>祝瞬自動巡場練功</h3>
              <p>設好幾個定點,清完一點就<span class="k">自動祝瞬到下一點</span>,多點循環巡場——一張圖自己輪流刷。<span class="k">掛整晚,回來滿背包</span>,人完全不用顧。</p>
            </div>
            <div class="card"><div class="icon" style="color: var(--lock)"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg></div><div class="ci">// ESCAPE</div><h3>危險自動瞬移閃人</h3><p>遇到危險就<span class="k">自動瞬移閃走</span>(防 PK、防紅名接近),保命第一,閃完繼續掛。</p></div>
            <div class="card"><div class="icon" style="color: var(--lock)"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.6-9-9.5C1.4 7.6 3.8 4.5 7 4.5c2 0 3.3 1.2 5 3 1.7-1.8 3-3 5-3 3.2 0 5.6 3.1 4 7C19 16.4 12 21 12 21z" /></svg></div><div class="ci">// SUPPLY</div><h3>血魔自動補給</h3><p>血、魔一低就<span class="k">自動補</span>,設好門檻就不用一直盯,反應快、不漏補、不暴斃。</p></div>
            <div class="card"><div class="icon" style="color: var(--lock)"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="1.5" /><path d="M8 21h8M12 18v3M7 9l2.5 2.5M7 9h3M7 9v3" /></svg></div><div class="ci">// HOTKEY</div><h3>一鍵開關</h3><p>遊戲畫面在前景時一鍵開始 / 暫停,不用切視窗、不用找按鈕,節奏你掌握。</p></div>
            <div class="card"><div class="icon" style="color: var(--lock)"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="1.5" /><path d="M3 8h18M7 12h6" /></svg></div><div class="ci">// AUTO-BIND</div><h3>自動認遊戲視窗</h3><p><span class="k">多開也不會選錯</span>,自動認出你要掛的那個視窗,開了就開打,免每次重選。</p></div>
          </div>
        </div>
      </section>

      <section class="remote">
        <div class="wrap">
          <div class="sec-head reveal">
            <div>
              <div class="idx">03 // 遠端監控</div>
              <h2 style="margin-top: 12px">人在外面,<br />它在替你打——你看得到。</h2>
              <p>綁定帳號後,手機或任何裝置隨時看狀態、開關、改參數,還能看它「當下的偵測畫面」。</p>
            </div>
            <span class="tag">REMOTE · LIVE</span>
          </div>
          <div class="remote-grid reveal">
            <div>
              <ul>
                <li><span class="b">01</span><div><b>綁定你的帳號</b><br /><span>綁定後,多台各自獨立,一個網頁全部看齊——在公司、在外面都能顧。</span></div></li>
                <li><span class="b">02</span><div><b>看它現在打到哪</b><br /><span>人在外面也能看它「當下畫面」,即時自動顯示、連線穩不閃斷,掛得安心。</span></div></li>
                <li><span class="b">03</span><div><b>手機直接遙控</b><br /><span>開關、改設定手機按一下即時生效,不用跑回電腦前,隨手就能調。</span></div></li>
              </ul>
            </div>
            <div class="phone" aria-hidden="true">
              <div class="notch"></div>
              <div class="screen">
                <div class="sh"><span class="st"></span><b>主帳 · 練功中</b><span class="on">● ONLINE</span></div>
                <div class="cam"><div class="sl"></div><div class="rt"><i></i><i></i><i></i><i></i></div><div class="tag2">LIVE · 即時畫面</div></div>
                <div class="rows"><div class="r"><b>運行</b><span class="v">運行中</span></div><div class="r"><b>鎖定目標</b><span class="v">3</span></div><div class="r"><b>HP / MP</b><span class="v">87% / 62%</span></div></div>
                <div class="ctrls"><span class="go">▶ 開始</span><span class="stp">■ 暫停</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="sec-head reveal">
            <div><div class="idx">04 // 品質與體驗</div><h2 style="margin-top: 12px">做得穩,才敢讓你掛整晚。</h2></div>
            <span class="tag amber">RELIABILITY</span>
          </div>
          <div class="qual reveal">
            <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 8h8v8H8z" /></svg></div><h3>順手的深色介面</h3><p>深色電競風,設定清楚好調,長時間看也不累眼。</p></div>
            <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="7" cy="18" r="2" /></svg></div><h3>依你打法微調</h3><p>靈敏度、範圍、速度都能調,依你的版本和習慣調到順手。</p></div>
            <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" /></svg></div><h3>掛整晚不出事</h3><p>長時間掛不閃退、不卡死,穩穩幫你刷經驗、賺裝。</p></div>
            <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></div><h3>更新前先測過</h3><p>每次更新都嚴格測過才發布,不會越更新越難用。</p></div>
            <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg></div><h3>免安裝即用</h3><p>解壓就能用、免安裝,一鍵自動更新,你的設定還會保留。</p></div>
          </div>
        </div>
      </section>

      <section class="finale" id="contact">
        <div class="wrap">
          <div class="frame reveal">
            <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
            <div class="tag" style="margin-bottom: 18px">租用方案 · GET ACCESS</div>
            <h2>有興趣?<span class="hl">聯絡客服</span>洽詢。</h2>
            <p>適用各版本天堂 Lineage。專人協助設定,綁定帳號即可隨處遠端監控。</p>
            <div class="offer">
              <div class="price">
                <div class="pk">// 月租方案</div>
                <div class="pv"><span class="cur">NT$</span>2,000<span class="per"> / 月</span></div>
                <div class="pn">專人協助設定 · 遠端監控 · 持續更新維護</div>
              </div>
              <div class="qr">
                <img src="https://qr-official.line.me/gs/M_920wuugp_GW.png?oat_content=qr" alt="加入 LINE 官方帳號洽詢客服" />
                <div class="qrt"><b>加 LINE 洽詢客服</b>掃描或搜尋官方帳號</div>
              </div>
            </div>
            <div class="runnote">// 由 <b>分寶 GameShare</b> 提供 — <a href="https://gameshare-system.com" target="_blank" rel="noopener">gameshare-system.com</a></div>
          </div>
        </div>
      </section>

      <footer>
        <div class="wrap">
          <div class="brand"><span class="glyph"></span><b>MotionHunter</b></div>
          <div class="meta">自動打怪掛機輔助 · 適用各版本天堂 Lineage &nbsp;//&nbsp; 由 <a class="gh" href="https://gameshare-system.com" target="_blank" rel="noopener">分寶 GameShare</a> 提供<br />自動化工具 · 使用請遵守遊戲條款並自負風險</div>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mh-root {
  --ground: #070a11; --panel: #0c111c; --panel-2: #111827;
  --line: rgba(96, 130, 170, 0.16); --line-strong: rgba(96, 130, 170, 0.3);
  --ink: #e7eef7; --ink-2: #b7c4d6; --ink-dim: #7c8ba3;
  --scan: #2fe0ce; --scan-deep: #1cb6a8; --lock: #ffb23e;
  --online: #46e08a; --violet: #8b7cff; --danger: #ff5c6c;
  --scan-glow: rgba(47, 224, 206, 0.45); --lock-glow: rgba(255, 178, 62, 0.4);
  --maxw: 1180px;
  --f-disp: "Chakra Petch", system-ui, sans-serif;
  --f-mono: "JetBrains Mono", ui-monospace, monospace;
  --f-body: "Noto Sans TC", "Chakra Petch", system-ui, sans-serif;
  position: relative; min-height: 100vh; overflow-x: hidden;
  background: var(--ground); color: var(--ink);
  font-family: var(--f-body); line-height: 1.7; -webkit-font-smoothing: antialiased;
}
.mh-root * { box-sizing: border-box; }
a { color: inherit; text-decoration: none; }
h1, h2, h3 { margin: 0; font-family: var(--f-disp); font-weight: 700; text-wrap: balance; letter-spacing: 0.01em; }

.gl { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 0; display: block; }
.gl-scrim { position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(130% 90% at 50% -10%, transparent 42%, rgba(7, 10, 17, 0.55) 100%),
              linear-gradient(180deg, rgba(7, 10, 17, 0.2), transparent 26%, transparent 72%, rgba(7, 10, 17, 0.55)); }

.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }
.tag { font-family: var(--f-mono); font-size: 0.72rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--scan); }
.tag.amber { color: var(--lock); }
.eyebrow { display: inline-flex; align-items: center; gap: 10px; font-family: var(--f-mono); font-size: 0.74rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-dim); }
.eyebrow::before { content: ""; width: 26px; height: 1px; background: linear-gradient(90deg, transparent, var(--scan)); }
.eyebrow .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--online); box-shadow: 0 0 10px var(--online); animation: mh-pulse 2.4s ease-in-out infinite; }
@keyframes mh-pulse { 50% { opacity: 0.35; } }

.topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 30; backdrop-filter: blur(10px); background: linear-gradient(180deg, rgba(7, 10, 17, 0.72), rgba(7, 10, 17, 0)); }
.topbar .wrap { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.brand { display: flex; align-items: center; gap: 11px; font-family: var(--f-disp); font-weight: 700; letter-spacing: 0.04em; }
.brand .glyph { width: 26px; height: 26px; position: relative; flex: 0 0 auto; }
.brand .glyph::before, .brand .glyph::after { content: ""; position: absolute; inset: 0; border: 1.5px solid var(--scan); border-radius: 3px; }
.brand .glyph::after { inset: 7px; border-color: var(--lock); border-radius: 1px; }
.nav-cta { display: inline-flex; align-items: center; height: 38px; padding: 0 18px; border-radius: 2px; font-family: var(--f-mono); font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ground); background: var(--scan); font-weight: 700; transition: 0.25s; cursor: pointer; }
.nav-cta:hover { background: #5cf0e1; box-shadow: 0 0 24px var(--scan-glow); }

.hero { position: relative; z-index: 2; min-height: 100vh; display: flex; align-items: center; padding: 90px 0 40px; }
.hero .corner { position: absolute; width: 26px; height: 26px; border: 2px solid var(--scan); opacity: 0.6; z-index: 3; }
.hero .corner.tl { top: 84px; left: 26px; border-right: 0; border-bottom: 0; }
.hero .corner.tr { top: 84px; right: 26px; border-left: 0; border-bottom: 0; }
.hero .corner.bl { bottom: 26px; left: 26px; border-right: 0; border-top: 0; }
.hero .corner.br { bottom: 26px; right: 26px; border-left: 0; border-top: 0; }
.hero-inner { max-width: 660px; }
.hero h1 { font-size: clamp(2.9rem, 7vw, 5.2rem); line-height: 1; letter-spacing: -0.015em; margin-top: 22px; }
.hero h1 .hl { color: var(--scan); text-shadow: 0 0 40px var(--scan-glow); }
.hero p.lead { margin: 24px 0 0; color: var(--ink-2); font-size: 1.12rem; max-width: 34ch; text-shadow: 0 1px 12px rgba(7, 10, 17, 0.6); }
.hero .kbd { font-family: var(--f-mono); color: var(--lock); }
.cta-row { display: flex; gap: 14px; margin-top: 34px; flex-wrap: wrap; }
.btn { display: inline-flex; align-items: center; gap: 10px; height: 54px; padding: 0 28px; border-radius: 2px; font-family: var(--f-disp); font-weight: 600; font-size: 1.02rem; cursor: pointer; border: 1px solid transparent; transition: 0.25s; }
.btn-primary { background: linear-gradient(135deg, var(--scan), var(--scan-deep)); color: var(--ground); }
.btn-primary:hover { box-shadow: 0 0 34px var(--scan-glow); transform: translateY(-1px); }
.btn-ghost { background: rgba(12, 17, 28, 0.5); border-color: var(--line-strong); color: var(--ink); backdrop-filter: blur(4px); }
.btn-ghost:hover { border-color: var(--scan); color: var(--scan); }
.hero-note { margin-top: 18px; font-family: var(--f-mono); font-size: 0.74rem; color: var(--ink-dim); letter-spacing: 0.04em; }
.click-hint { margin-top: 14px; font-family: var(--f-mono); font-size: 0.74rem; letter-spacing: 0.1em; color: var(--scan); opacity: 0.85; animation: mh-hintpulse 2.2s ease-in-out infinite; transition: opacity 0.5s; }
.click-hint.gone { opacity: 0; }
@keyframes mh-hintpulse { 50% { opacity: 0.32; } }
.hero, .demo3d { cursor: crosshair; }
.hero a, .hero .btn { cursor: pointer; }
.hud { position: absolute; font-family: var(--f-mono); font-size: 0.66rem; letter-spacing: 0.08em; color: var(--ink-2); z-index: 3; }
.hud .k { color: var(--ink-dim); } .hud .v { color: var(--scan); } .hud .v.g { color: var(--online); } .hud .v.a { color: var(--lock); }
.hud.h-tr { top: 92px; right: 34px; text-align: right; } .hud.h-br { bottom: 34px; right: 34px; text-align: right; } .hud.h-bl { bottom: 34px; left: 34px; }
.scrolldn { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); font-family: var(--f-mono); font-size: 0.64rem; letter-spacing: 0.2em; color: var(--ink-dim); z-index: 3; text-align: center; }
.scrolldn .bar { display: block; width: 1px; height: 34px; margin: 8px auto 0; background: linear-gradient(180deg, var(--scan), transparent); animation: mh-drop 1.8s ease-in-out infinite; }
@keyframes mh-drop { 0%, 100% { opacity: 0.3; transform: scaleY(0.6); } 50% { opacity: 1; transform: scaleY(1); } }

.demo3d { position: relative; z-index: 2; padding: 24vh 0 30vh; }
.demo3d .wrap { display: flex; flex-direction: column; gap: 52vh; }
.demo-cap { max-width: 430px; padding: 22px 24px; background: linear-gradient(180deg, rgba(12, 17, 28, 0.66), rgba(7, 10, 17, 0.72)); backdrop-filter: blur(7px); border: 1px solid var(--line); border-left: 2px solid var(--scan); border-radius: 4px; }
.demo-cap.right { align-self: flex-end; border-left: 1px solid var(--line); border-right: 2px solid var(--lock); text-align: right; }
.demo-cap .tag { display: block; margin-bottom: 8px; }
.demo-cap h3 { font-size: 1.6rem; font-family: var(--f-disp); margin-bottom: 8px; }
.demo-cap p { margin: 0; color: var(--ink-2); font-size: 0.96rem; }

/* 淡薄霧,讓 3D 戰場清楚透出來、文字仍讀得清(內容自己是玻璃卡) */
.page-body { position: relative; z-index: 2; background: linear-gradient(180deg, rgba(7, 10, 17, 0.32), rgba(7, 10, 17, 0.46)); backdrop-filter: blur(2px); border-top: 1px solid var(--line); }

.telemetry { border-bottom: 1px solid var(--line); background: rgba(7, 10, 17, 0.3); backdrop-filter: blur(3px); }
.telemetry .wrap { display: grid; grid-template-columns: repeat(4, 1fr); }
.tcell { padding: 26px 20px; border-left: 1px solid var(--line); }
.tcell:first-child { border-left: 0; }
.tcell .num { font-family: var(--f-disp); font-weight: 700; font-size: 2rem; line-height: 1; color: var(--ink); }
.tcell .num .u { color: var(--scan); font-size: 1.1rem; }
.tcell .cap { margin-top: 9px; font-size: 0.86rem; color: var(--ink-dim); }

section { padding: 82px 0; position: relative; }
.sec-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 38px; flex-wrap: wrap; }
.sec-head h2 { font-size: clamp(1.7rem, 3.4vw, 2.5rem); line-height: 1.1; }
.sec-head .idx { font-family: var(--f-mono); font-size: 0.72rem; letter-spacing: 0.16em; color: var(--ink-dim); }
.sec-head p { margin: 10px 0 0; color: var(--ink-2); max-width: 46ch; }
.sec-head h2, .sec-head p, .sec-head .idx { text-shadow: 0 2px 18px rgba(7, 10, 17, 0.85); }

.modules { display: grid; gap: 16px; }
.grid-5 { grid-template-columns: repeat(6, 1fr); }
.grid-4 { grid-template-columns: repeat(2, 1fr); }
.grid-4 .card.span2 { grid-column: 1 / -1; }
.card { position: relative; background: linear-gradient(180deg, rgba(17, 24, 39, 0.78), rgba(12, 17, 28, 0.78)); backdrop-filter: blur(7px); border: 1px solid var(--line); border-radius: 4px; padding: 26px 24px; overflow: hidden; transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s; }
.card::after { content: ""; position: absolute; top: 0; left: 0; width: 22px; height: 22px; border-top: 2px solid var(--scan); border-left: 2px solid var(--scan); opacity: 0; transition: 0.3s; }
.card:hover { border-color: var(--line-strong); transform: translateY(-3px); box-shadow: 0 20px 44px -26px rgba(0, 0, 0, 0.9); }
.card:hover::after { opacity: 0.85; }
.card .ci { font-family: var(--f-mono); font-size: 0.68rem; letter-spacing: 0.14em; color: var(--scan); margin-bottom: 16px; }
.card h3 { font-size: 1.18rem; margin-bottom: 9px; font-family: var(--f-body); font-weight: 700; }
.card p { margin: 0; color: var(--ink-2); font-size: 0.94rem; line-height: 1.65; }
.card .k { color: var(--lock); font-family: var(--f-mono); font-size: 0.9em; }
.grid-5 .card.lead { grid-column: span 3; grid-row: span 2; display: flex; flex-direction: column; justify-content: space-between; }
.grid-5 .card:not(.lead) { grid-column: span 3; }
.card.lead h3 { font-size: 1.7rem; font-family: var(--f-disp); }
.card.lead .big-num { font-family: var(--f-mono); color: var(--scan); font-size: 0.8rem; letter-spacing: 0.1em; margin-top: 20px; }
.card .icon { width: 34px; height: 34px; margin-bottom: 16px; color: var(--scan); }
.card .icon svg { width: 100%; height: 100%; display: block; stroke: currentColor; fill: none; stroke-width: 1.6; }

.remote-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 52px; align-items: center; }
.remote ul { list-style: none; padding: 0; margin: 26px 0 0; display: grid; gap: 16px; }
.remote li { display: flex; gap: 15px; align-items: flex-start; }
.remote li .b { flex: 0 0 auto; width: 26px; height: 26px; border: 1px solid var(--scan); border-radius: 3px; display: grid; place-items: center; font-family: var(--f-mono); font-size: 0.7rem; color: var(--scan); margin-top: 2px; }
.remote li b { color: var(--ink); font-weight: 700; }
.remote li span { color: var(--ink-2); font-size: 0.95rem; }
.phone { justify-self: center; width: 278px; aspect-ratio: 9 / 18.6; border: 1.5px solid var(--line-strong); border-radius: 30px; padding: 12px; background: linear-gradient(180deg, var(--panel-2), var(--ground)); box-shadow: 0 40px 90px -34px rgba(0, 0, 0, 0.85); position: relative; }
.phone .notch { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: 96px; height: 20px; background: var(--ground); border-radius: 0 0 12px 12px; border: 1px solid var(--line); border-top: 0; }
.screen { height: 100%; border-radius: 20px; border: 1px solid var(--line); background: var(--panel); overflow: hidden; display: flex; flex-direction: column; }
.screen .sh { padding: 28px 16px 12px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 8px; }
.screen .sh .st { width: 8px; height: 8px; border-radius: 50%; background: var(--online); box-shadow: 0 0 8px var(--online); }
.screen .sh b { font-family: var(--f-disp); font-size: 0.9rem; }
.screen .sh .on { margin-left: auto; font-family: var(--f-mono); font-size: 0.6rem; color: var(--online); letter-spacing: 0.1em; }
.screen .cam { margin: 12px; border: 1px solid var(--line); border-radius: 6px; aspect-ratio: 4 / 3; position: relative; overflow: hidden; background: linear-gradient(180deg, rgba(20, 30, 48, 0.7), rgba(8, 11, 18, 0.9)), repeating-linear-gradient(0deg, transparent 0 15px, rgba(96, 130, 170, 0.08) 15px 16px), repeating-linear-gradient(90deg, transparent 0 15px, rgba(96, 130, 170, 0.08) 15px 16px); }
.screen .cam .rt { position: absolute; width: 26px; height: 26px; top: 38%; left: 40%; }
.screen .cam .rt i { position: absolute; width: 7px; height: 7px; border: 1.5px solid var(--lock); }
.screen .cam .rt i:nth-child(1) { top: 0; left: 0; border-right: 0; border-bottom: 0; }
.screen .cam .rt i:nth-child(2) { top: 0; right: 0; border-left: 0; border-bottom: 0; }
.screen .cam .rt i:nth-child(3) { bottom: 0; left: 0; border-right: 0; border-top: 0; }
.screen .cam .rt i:nth-child(4) { bottom: 0; right: 0; border-left: 0; border-top: 0; }
.screen .cam .sl { position: absolute; left: 0; right: 0; height: 1.5px; background: linear-gradient(90deg, transparent, var(--scan), transparent); box-shadow: 0 0 8px var(--scan-glow); animation: mh-camsweep 3.4s linear infinite; }
@keyframes mh-camsweep { 0% { top: -2%; } 100% { top: 102%; } }
.screen .cam .tag2 { position: absolute; bottom: 6px; left: 8px; font-family: var(--f-mono); font-size: 0.52rem; color: var(--scan); letter-spacing: 0.06em; }
.screen .rows { padding: 4px 12px 14px; display: grid; gap: 9px; }
.screen .rows .r { display: flex; justify-content: space-between; align-items: center; font-family: var(--f-mono); font-size: 0.62rem; color: var(--ink-dim); padding-bottom: 8px; border-bottom: 1px solid var(--line); }
.screen .rows .r b { color: var(--ink-2); font-weight: 500; }
.screen .rows .r .v { color: var(--scan); }
.screen .ctrls { margin-top: auto; padding: 12px; display: flex; gap: 8px; }
.screen .ctrls span { flex: 1; text-align: center; font-family: var(--f-mono); font-size: 0.6rem; letter-spacing: 0.08em; padding: 9px 0; border-radius: 3px; }
.screen .ctrls .go { background: var(--online); color: var(--ground); font-weight: 700; }
.screen .ctrls .stp { border: 1px solid var(--line-strong); color: var(--ink-2); }

.qual { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
.qcard { border: 1px solid var(--line); border-radius: 4px; padding: 22px 18px; background: rgba(12, 17, 28, 0.72); backdrop-filter: blur(7px); }
.qcard .qi { width: 30px; height: 30px; color: var(--lock); margin-bottom: 14px; }
.qcard .qi svg { width: 100%; height: 100%; stroke: currentColor; fill: none; stroke-width: 1.6; }
.qcard h3 { font-size: 1rem; font-family: var(--f-body); font-weight: 700; margin-bottom: 7px; }
.qcard p { margin: 0; color: var(--ink-dim); font-size: 0.84rem; line-height: 1.6; }

.finale { text-align: center; padding: 100px 0; }
.finale .frame { position: relative; border: 1px solid var(--line-strong); border-radius: 6px; padding: 64px 32px; background: radial-gradient(600px 300px at 50% 0%, rgba(47, 224, 206, 0.09), transparent 70%), linear-gradient(180deg, rgba(17, 24, 39, 0.82), rgba(12, 17, 28, 0.82)); }
.finale .frame .corner { position: absolute; width: 20px; height: 20px; border: 2px solid var(--scan); opacity: 0.7; }
.finale .frame .corner.tl { top: 12px; left: 12px; border-right: 0; border-bottom: 0; }
.finale .frame .corner.tr { top: 12px; right: 12px; border-left: 0; border-bottom: 0; }
.finale .frame .corner.bl { bottom: 12px; left: 12px; border-right: 0; border-top: 0; }
.finale .frame .corner.br { bottom: 12px; right: 12px; border-left: 0; border-top: 0; }
.finale h2 { font-size: clamp(2rem, 4.5vw, 3.1rem); line-height: 1.05; }
.finale h2 .hl { color: var(--scan); text-shadow: 0 0 30px var(--scan-glow); }
.finale p { color: var(--ink-2); margin: 18px auto 0; max-width: 40ch; }
.finale .runnote { margin-top: 22px; font-family: var(--f-mono); font-size: 0.76rem; color: var(--ink-dim); line-height: 1.9; }
.finale .runnote b { color: var(--lock); font-weight: 500; }
.finale .runnote a { color: var(--scan); border-bottom: 1px solid var(--line-strong); }
.offer { display: flex; gap: 22px; justify-content: center; align-items: stretch; flex-wrap: wrap; margin-top: 34px; }
.price, .qr { border: 1px solid var(--line-strong); border-radius: 4px; padding: 26px 30px; background: rgba(7, 10, 17, 0.5); text-align: left; }
.price { display: flex; flex-direction: column; justify-content: center; min-width: 250px; }
.price .pk { font-family: var(--f-mono); font-size: 0.7rem; letter-spacing: 0.14em; color: var(--scan); }
.price .pv { font-family: var(--f-disp); font-weight: 700; font-size: 3.1rem; line-height: 1; color: var(--ink); margin: 12px 0 8px; }
.price .pv .cur { font-size: 1.35rem; color: var(--ink-2); vertical-align: super; margin-right: 3px; }
.price .pv .per { font-size: 1rem; color: var(--ink-dim); font-family: var(--f-body); font-weight: 400; }
.price .pn { font-size: 0.85rem; color: var(--ink-2); line-height: 1.6; }
.qr { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 13px; text-align: center; min-width: 200px; }
.qr img { background: #fff; padding: 10px; border-radius: 6px; display: block; width: 150px; height: 150px; }
.qr .qrt { font-family: var(--f-mono); font-size: 0.74rem; color: var(--online); }
.qr .qrt b { color: var(--ink); font-family: var(--f-body); display: block; font-size: 0.9rem; margin-bottom: 2px; }

footer { border-top: 1px solid var(--line); padding: 34px 0 46px; }
footer .wrap { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; }
footer .meta { font-family: var(--f-mono); font-size: 0.72rem; color: var(--ink-dim); letter-spacing: 0.04em; line-height: 1.8; }
footer a.gh { color: var(--ink-2); border-bottom: 1px solid var(--line-strong); }

.reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
.reveal.in { opacity: 1; transform: none; }

@media (max-width: 900px) {
  .telemetry .wrap { grid-template-columns: repeat(2, 1fr); }
  .tcell:nth-child(3) { border-left: 0; }
  .grid-5 { grid-template-columns: 1fr; }
  .grid-5 .card.lead, .grid-5 .card:not(.lead) { grid-column: auto; }
  .grid-4 { grid-template-columns: 1fr; }
  .remote-grid { grid-template-columns: 1fr; gap: 38px; }
  .remote .phone { order: -1; }
  .qual { grid-template-columns: repeat(2, 1fr); }
  .hero .corner { display: none; }
  .demo-cap { max-width: none; }
}
@media (max-width: 520px) {
  .tcell .num { font-size: 1.6rem; }
  .qual { grid-template-columns: 1fr; }
  .nav-cta { display: none; }
  .price .pv { font-size: 2.5rem; }
  .hud { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .mh-root * { animation: none !important; }
  .reveal { opacity: 1; transform: none; transition: none; }
}
</style>
