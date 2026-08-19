<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

let io: IntersectionObserver | null = null
let lockTimer: ReturnType<typeof setInterval> | null = null

function scrollTo(id: string) {
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
  const els = Array.from(document.querySelectorAll('.mh-root .reveal:not(.in)'))
  if (rm || !('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'))
  } else {
    io = new IntersectionObserver(
      (en) => {
        en.forEach((x) => {
          if (x.isIntersecting) {
            x.target.classList.add('in')
            io && io.unobserve(x.target)
          }
        })
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((e) => io!.observe(e))
  }
  const lc = document.getElementById('mhLockCount')
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
    }, 620)
  }
})

onUnmounted(() => {
  if (io) io.disconnect()
  if (lockTimer) clearInterval(lockTimer)
})
</script>

<template>
  <div class="mh-root">
    <div class="topbar">
      <div class="wrap">
        <div class="brand"><span class="glyph"></span><b>MotionHunter</b></div>
        <a class="nav-cta" href="#" @click.prevent="scrollTo('contact')">聯絡客服</a>
      </div>
    </div>

    <header class="hero">
      <div class="wrap hero-grid">
        <div class="reveal in">
          <div class="eyebrow"><span class="dot"></span>AUTO-HUNT SYSTEM // LINEAGE</div>
          <h1 style="margin-top: 20px">螢幕上<span class="hl">會動的</span>,<br />它替你獵。</h1>
          <p class="lead">MotionHunter 靠畫面<b style="color: var(--ink)">動作偵測</b>自動鎖怪、開打——<span class="kbd">不讀記憶體</span>,天生繞過 GameGuard。理論上<b style="color: var(--ink)">適用任一版本的天堂</b>,掛上就走,手機隨時遠端看它替你打。</p>
          <div class="cta-row">
            <a class="btn btn-primary" href="#" @click.prevent="scrollTo('contact')">有興趣?聯絡客服 <span class="arw">→</span></a>
            <a class="btn btn-ghost" href="#" @click.prevent="scrollTo('combat')">看它會什麼 ↓</a>
          </div>
          <div class="hero-note">// 適用各版本天堂 Lineage · 月租制 NT$2,000／月 · 專人協助設定</div>
        </div>

        <div class="reveal in viewport" aria-hidden="true">
          <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
          <div class="scanline"></div>
          <div class="readout hud-tl"><span class="k">MODE</span> <span class="val">GRID RADAR</span><br /><span class="k">SENS</span> <span class="val">0.18</span></div>
          <div class="readout hud-tr"><span class="k">HP</span> <span class="val g">87%</span><br /><span class="k">MP</span> <span class="val">62%</span></div>
          <div class="readout hud-bl"><span class="k">STATUS</span> <span class="val g">HUNTING</span></div>
          <div class="readout hud-br"><span class="k">LOCKED</span> <span class="val a" id="mhLockCount">03</span></div>
          <div class="exclude"></div>
          <div class="player"></div>
          <span class="blip b1"></span><span class="blip b2"></span><span class="blip b3"></span><span class="blip b4"></span>
          <div class="reticle r1"><span class="lbl">TARGET·01</span><i class="rc tl"></i><i class="rc tr"></i><i class="rc bl"></i><i class="rc br"></i><i class="cd"></i></div>
          <div class="reticle r2"><span class="lbl">TARGET·02</span><i class="rc tl"></i><i class="rc tr"></i><i class="rc bl"></i><i class="rc br"></i><i class="cd"></i></div>
          <div class="reticle r3"><span class="lbl">TARGET·03</span><i class="rc tl"></i><i class="rc tr"></i><i class="rc bl"></i><i class="rc br"></i><i class="cd"></i></div>
        </div>
      </div>
    </header>

    <div class="telemetry reveal">
      <div class="wrap">
        <div class="tcell"><div class="num">0<span class="u"> 讀取</span></div><div class="cap">純畫面偵測,不碰記憶體 · 繞過反作弊</div></div>
        <div class="tcell"><div class="num">1<span class="u"> 鍵</span></div><div class="cap">全域熱鍵,遊戲前景即開即停</div></div>
        <div class="tcell"><div class="num">24/7</div><div class="cap">手機遠端監控 · 即時畫面預覽</div></div>
        <div class="tcell"><div class="num">Auto</div><div class="cap">一鍵自動更新,設定與游標全保留</div></div>
      </div>
    </div>

    <section id="combat">
      <div class="wrap">
        <div class="sec-head reveal">
          <div>
            <div class="idx">01 // 核心獵殺</div>
            <h2 style="margin-top: 12px">看得見,就打得到。</h2>
            <p>不靠腳本座標、不讀封包。MotionHunter 直接讀畫面上的動作與亮度,像雷達一樣鎖定會動的怪。</p>
          </div>
          <span class="tag">COMBAT · CORE</span>
        </div>
        <div class="modules grid-5 reveal">
          <div class="card lead">
            <div>
              <div class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.4" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></svg></div>
              <div class="ci">// PRIMARY</div>
              <h3>動作偵測打怪</h3>
              <p>偵測畫面「動作變化」自動鎖定並攻擊怪物。不讀記憶體、不改封包,天生閃過 GameGuard 反作弊——這是 MH 最硬的底層優勢。</p>
            </div>
            <div class="big-num">// FRAME-DIFF TARGETING · NO MEMORY READ</div>
          </div>
          <div class="card">
            <div class="ci">// RADAR</div>
            <h3>格子雷達模式</h3>
            <p>把畫面切成網格算活躍度,自動挑<span class="k">最近的亮格</span>下手,目標選擇更聰明、不亂點。</p>
          </div>
          <div class="card">
            <div class="ci">// WALL-CHECK</div>
            <h3>小地圖判牆</h3>
            <p>讀右下小地圖分辨牆與可走區,<span class="k">不打牆上打不到的怪</span>,不空砍浪費輸出。</p>
          </div>
          <div class="card">
            <div class="ci">// SAFE-ZONE</div>
            <h3>禁點框 + 排除半徑</h3>
            <p>圈出自身與指定區域自動排除,避免誤點角色、避開安全區。</p>
          </div>
          <div class="card">
            <div class="ci">// FILTER</div>
            <h3>近身反擊 · 忽略死怪</h3>
            <p>白血條死怪自動略過、近身怪優先反擊,每一次攻擊都不浪費。</p>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="wrap">
        <div class="sec-head reveal">
          <div>
            <div class="idx">02 // 自動化整合</div>
            <h2 style="margin-top: 12px">掛上就走,細節它顧。</h2>
            <p>瞬移、補血、選視窗、熱鍵——把掛機真正需要的自動化,一次做齊。</p>
          </div>
          <span class="tag amber">AUTOMATION</span>
        </div>
        <div class="modules grid-4 reveal">
          <div class="card">
            <div class="icon" style="color: var(--lock)"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg></div>
            <div class="ci">// BLINK</div>
            <h3>ICON 偵測瞬移</h3>
            <p>偵測到頭上 ICON(如祝瞬)自動按 F5 瞬移;<span class="k">祝瞬自動巡場循環</span>,卡住還有保底強制換點,不會呆在原地。</p>
          </div>
          <div class="card">
            <div class="icon" style="color: var(--lock)"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.6-9-9.5C1.4 7.6 3.8 4.5 7 4.5c2 0 3.3 1.2 5 3 1.7-1.8 3-3 5-3 3.2 0 5.6 3.1 4 7C19 16.4 12 21 12 21z" /></svg></div>
            <div class="ci">// SUPPLY</div>
            <h3>血魔自動補給</h3>
            <p>用血/魔條<span class="k">顏色邊界</span>精準讀百分比,低於門檻自動補。不靠 OCR、不誤判、反應快。</p>
          </div>
          <div class="card">
            <div class="icon" style="color: var(--lock)"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="1.5" /><path d="M8 21h8M12 18v3M7 9l2.5 2.5M7 9h3M7 9v3" /></svg></div>
            <div class="ci">// HOTKEY</div>
            <h3>全域熱鍵</h3>
            <p>遊戲在前景時一鍵開關,不用切視窗、不用找按鈕,節奏你掌握。</p>
          </div>
          <div class="card">
            <div class="icon" style="color: var(--lock)"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="1.5" /><path d="M3 8h18M7 12h6" /></svg></div>
            <div class="ci">// AUTO-BIND</div>
            <h3>自動選視窗</h3>
            <p>靠 exe → class → 標題自動鎖定遊戲視窗,<span class="k">標題隨機也免每次重選</span>,開了就認得。</p>
          </div>
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
              <li><span class="b">01</span><div><b>多用戶 Token 綁定</b><br /><span>MH 自產 token,綁到你的帳號。多台機器人各自獨立,一個網頁全看齊。</span></div></li>
              <li><span class="b">02</span><div><b>即時偵測畫面預覽</b><br /><span>遠端直接看機器人「當下畫面」——在線自動顯示、每 2 秒更新、心跳穩定不閃斷。</span></div></li>
              <li><span class="b">03</span><div><b>遠端開關 · 改參數</b><br /><span>靈敏度、攻擊距離、模式切換,手機上按一下即時生效,不用回電腦。</span></div></li>
            </ul>
          </div>
          <div class="phone" aria-hidden="true">
            <div class="notch"></div>
            <div class="screen">
              <div class="sh"><span class="st"></span><b>主帳 · 練功中</b><span class="on">● ONLINE</span></div>
              <div class="cam">
                <div class="sl"></div>
                <div class="rt"><i></i><i></i><i></i><i></i></div>
                <div class="tag2">LIVE · GRID RADAR</div>
              </div>
              <div class="rows">
                <div class="r"><b>運行</b><span class="v">運行中</span></div>
                <div class="r"><b>鎖定目標</b><span class="v">3</span></div>
                <div class="r"><b>HP / MP</b><span class="v">87% / 62%</span></div>
              </div>
              <div class="ctrls"><span class="go">▶ 開始</span><span class="stp">■ 暫停</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="wrap">
        <div class="sec-head reveal">
          <div>
            <div class="idx">04 // 品質與體驗</div>
            <h2 style="margin-top: 12px">做得穩,才敢讓你掛整晚。</h2>
          </div>
          <span class="tag amber">RELIABILITY</span>
        </div>
        <div class="qual reveal">
          <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 8h8v8H8z" /></svg></div><h3>深色電競 GUI</h3><p>FlatLaf 深色主題,好看好操作,長時間看不累。</p></div>
          <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="7" cy="18" r="2" /></svg></div><h3>高度可調</h3><p>靈敏度、攻擊距離、冷卻、每目標時間,全可微調。</p></div>
          <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" /></svg></div><h3>穩定掛機</h3><p>長時間不閃退,單一執行緒出錯也不會全死。</p></div>
          <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></div><h3>回歸測試把關</h3><p>每版發布前自動測試全過才出貨,不帶病更新。</p></div>
          <div class="qcard"><div class="qi"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg></div><h3>輕量免安裝</h3><p>單一 exe + 內建執行環境,解壓即用,一鍵更新。</p></div>
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
          <div class="runnote">
            // 由 <b>分寶 GameShare</b> 提供 — <a href="https://gameshare-system.com" target="_blank" rel="noopener">gameshare-system.com</a>
          </div>
        </div>
      </div>
    </section>

    <footer>
      <div class="wrap">
        <div class="brand"><span class="glyph"></span><b>MotionHunter</b></div>
        <div class="meta">
          動作偵測打怪輔助 · 適用各版本天堂 Lineage &nbsp;//&nbsp; 由 <a class="gh" href="https://gameshare-system.com" target="_blank" rel="noopener">分寶 GameShare</a> 提供<br />
          自動化工具 · 使用請遵守遊戲條款並自負風險
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.mh-root {
  --ground: #080b12; --panel: #0c111c; --panel-2: #111827; --raise: #151e30;
  --line: rgba(96, 130, 170, 0.16); --line-strong: rgba(96, 130, 170, 0.3);
  --ink: #e7eef7; --ink-2: #b7c4d6; --ink-dim: #7c8ba3;
  --scan: #2fe0ce; --scan-deep: #1cb6a8; --lock: #ffb23e; --lock-deep: #f2921c;
  --online: #46e08a; --violet: #8b7cff; --danger: #ff5c6c;
  --scan-glow: rgba(47, 224, 206, 0.45); --lock-glow: rgba(255, 178, 62, 0.4);
  --maxw: 1180px;
  --f-disp: "Chakra Petch", system-ui, sans-serif;
  --f-mono: "JetBrains Mono", ui-monospace, monospace;
  --f-body: "Noto Sans TC", "Chakra Petch", system-ui, sans-serif;
  position: relative; min-height: 100vh; overflow-x: hidden;
  background: var(--ground); color: var(--ink);
  font-family: var(--f-body); font-weight: 400; line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}
.mh-root * { box-sizing: border-box; }
.mh-root::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(1100px 700px at 78% -8%, rgba(47, 224, 206, 0.1), transparent 60%),
    radial-gradient(900px 620px at 8% 4%, rgba(139, 124, 255, 0.09), transparent 58%),
    radial-gradient(760px 520px at 50% 108%, rgba(255, 178, 62, 0.06), transparent 60%);
}
.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }
a { color: inherit; text-decoration: none; }
h1, h2, h3 { margin: 0; font-family: var(--f-disp); font-weight: 700; text-wrap: balance; letter-spacing: 0.01em; }

.tag { font-family: var(--f-mono); font-size: 0.72rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--scan); }
.tag.amber { color: var(--lock); }
.eyebrow { display: inline-flex; align-items: center; gap: 10px; font-family: var(--f-mono); font-size: 0.74rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-dim); }
.eyebrow::before { content: ""; width: 26px; height: 1px; background: linear-gradient(90deg, transparent, var(--scan)); }
.eyebrow .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--online); box-shadow: 0 0 10px var(--online); animation: mh-pulse 2.4s ease-in-out infinite; }
@keyframes mh-pulse { 50% { opacity: 0.35; } }

.topbar { position: sticky; top: 0; z-index: 40; backdrop-filter: blur(12px); background: linear-gradient(180deg, rgba(8, 11, 18, 0.92), rgba(8, 11, 18, 0.55)); border-bottom: 1px solid var(--line); }
.topbar .wrap { display: flex; align-items: center; justify-content: space-between; height: 62px; }
.brand { display: flex; align-items: center; gap: 11px; font-family: var(--f-disp); font-weight: 700; letter-spacing: 0.04em; }
.brand .glyph { width: 26px; height: 26px; position: relative; flex: 0 0 auto; }
.brand .glyph::before, .brand .glyph::after { content: ""; position: absolute; inset: 0; border: 1.5px solid var(--scan); border-radius: 3px; }
.brand .glyph::after { inset: 7px; border-color: var(--lock); border-radius: 1px; }
.brand b { font-weight: 700; }
.nav-cta { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 18px; border-radius: 2px; font-family: var(--f-mono); font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ground); background: var(--scan); font-weight: 700; transition: 0.25s; cursor: pointer; }
.nav-cta:hover { background: #5cf0e1; box-shadow: 0 0 24px var(--scan-glow); }

.hero { padding: 64px 0 34px; }
.hero-grid { display: grid; grid-template-columns: 1.02fr 0.98fr; gap: 48px; align-items: center; }
.hero h1 { font-size: clamp(2.7rem, 6vw, 4.35rem); line-height: 1.02; letter-spacing: -0.01em; }
.hero h1 .hl { color: var(--scan); text-shadow: 0 0 34px var(--scan-glow); }
.hero p.lead { margin: 22px 0 0; color: var(--ink-2); font-size: 1.06rem; max-width: 33ch; }
.hero .kbd { font-family: var(--f-mono); color: var(--lock); font-size: 0.95em; }
.cta-row { display: flex; gap: 14px; margin-top: 30px; flex-wrap: wrap; }
.btn { display: inline-flex; align-items: center; gap: 10px; height: 52px; padding: 0 26px; border-radius: 2px; font-family: var(--f-disp); font-weight: 600; letter-spacing: 0.02em; font-size: 1rem; cursor: pointer; border: 1px solid transparent; transition: 0.25s; position: relative; }
.btn-primary { background: linear-gradient(135deg, var(--scan), var(--scan-deep)); color: var(--ground); }
.btn-primary:hover { box-shadow: 0 0 30px var(--scan-glow); transform: translateY(-1px); }
.btn-primary .arw { font-family: var(--f-mono); }
.btn-ghost { background: transparent; border-color: var(--line-strong); color: var(--ink); }
.btn-ghost:hover { border-color: var(--scan); color: var(--scan); }
.hero-note { margin-top: 16px; font-family: var(--f-mono); font-size: 0.74rem; color: var(--ink-dim); letter-spacing: 0.04em; }

.viewport { position: relative; aspect-ratio: 4 / 3.35; border: 1px solid var(--line-strong); border-radius: 4px; background: linear-gradient(180deg, rgba(20, 30, 48, 0.6), rgba(8, 11, 18, 0.9)), repeating-linear-gradient(0deg, transparent 0 33px, rgba(96, 130, 170, 0.07) 33px 34px), repeating-linear-gradient(90deg, transparent 0 33px, rgba(96, 130, 170, 0.07) 33px 34px); overflow: hidden; box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.8), inset 0 0 60px rgba(0, 0, 0, 0.5); }
.viewport .corner { position: absolute; width: 16px; height: 16px; border: 2px solid var(--scan); opacity: 0.85; }
.viewport .corner.tl { top: 10px; left: 10px; border-right: 0; border-bottom: 0; }
.viewport .corner.tr { top: 10px; right: 10px; border-left: 0; border-bottom: 0; }
.viewport .corner.bl { bottom: 10px; left: 10px; border-right: 0; border-top: 0; }
.viewport .corner.br { bottom: 10px; right: 10px; border-left: 0; border-top: 0; }
.scanline { position: absolute; left: 0; right: 0; height: 2px; top: 0; background: linear-gradient(90deg, transparent, var(--scan), transparent); opacity: 0.9; box-shadow: 0 0 18px 3px var(--scan-glow); animation: mh-sweep 4.2s linear infinite; }
@keyframes mh-sweep { 0% { top: -2%; } 100% { top: 102%; } }
.readout { position: absolute; font-family: var(--f-mono); font-size: 0.66rem; letter-spacing: 0.08em; color: var(--ink-2); }
.hud-tl { top: 16px; left: 34px; }
.hud-tr { top: 16px; right: 34px; text-align: right; }
.hud-bl { bottom: 16px; left: 34px; }
.hud-br { bottom: 16px; right: 34px; text-align: right; }
.readout .k { color: var(--ink-dim); }
.readout .val { color: var(--scan); }
.readout .val.a { color: var(--lock); }
.readout .val.g { color: var(--online); }
.blip { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: var(--ink-dim); opacity: 0.5; }
.blip.b1 { top: 32%; left: 26%; }
.blip.b2 { top: 58%; left: 44%; }
.blip.b3 { top: 44%; left: 70%; }
.blip.b4 { top: 72%; left: 64%; }
.reticle { position: absolute; width: 66px; height: 66px; transform: translate(-50%, -50%); opacity: 0; animation: mh-lock 0.7s ease-out forwards; }
.reticle .rc { position: absolute; width: 15px; height: 15px; border: 2px solid var(--lock); }
.reticle .rc.tl { top: 0; left: 0; border-right: 0; border-bottom: 0; }
.reticle .rc.tr { top: 0; right: 0; border-left: 0; border-bottom: 0; }
.reticle .rc.bl { bottom: 0; left: 0; border-right: 0; border-top: 0; }
.reticle .rc.br { bottom: 0; right: 0; border-left: 0; border-top: 0; }
.reticle .cd { position: absolute; top: 50%; left: 50%; width: 5px; height: 5px; margin: -2.5px; border-radius: 50%; background: var(--lock); box-shadow: 0 0 12px var(--lock-glow); }
.reticle .lbl { position: absolute; top: -17px; left: 0; font-family: var(--f-mono); font-size: 0.56rem; letter-spacing: 0.1em; color: var(--lock); white-space: nowrap; }
.reticle.r1 { top: 32%; left: 26%; animation-delay: 0.5s; }
.reticle.r2 { top: 58%; left: 44%; animation-delay: 1.15s; }
.reticle.r3 { top: 44%; left: 70%; animation-delay: 1.8s; }
@keyframes mh-lock { 0% { opacity: 0; transform: translate(-50%, -50%) scale(1.7); filter: blur(1px); } 60% { opacity: 1; } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
.player { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 22px; height: 22px; }
.player::before { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--online); box-shadow: 0 0 14px var(--online); }
.player::after { content: ""; position: absolute; inset: -11px; border-radius: 50%; border: 1px dashed rgba(70, 224, 138, 0.4); animation: mh-spin 9s linear infinite; }
@keyframes mh-spin { to { transform: rotate(360deg); } }
.exclude { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 120px; height: 120px; border: 1px dashed rgba(255, 92, 108, 0.35); border-radius: 50%; }

.telemetry { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-top: 40px; }
.telemetry .wrap { display: grid; grid-template-columns: repeat(4, 1fr); }
.tcell { padding: 26px 20px; border-left: 1px solid var(--line); }
.tcell:first-child { border-left: 0; }
.tcell .num { font-family: var(--f-disp); font-weight: 700; font-size: 2rem; line-height: 1; color: var(--ink); }
.tcell .num .u { color: var(--scan); font-size: 1.1rem; }
.tcell .cap { margin-top: 9px; font-size: 0.86rem; color: var(--ink-dim); }

section { padding: 78px 0; position: relative; }
.sec-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 38px; flex-wrap: wrap; }
.sec-head h2 { font-size: clamp(1.7rem, 3.4vw, 2.5rem); line-height: 1.1; }
.sec-head .idx { font-family: var(--f-mono); font-size: 0.72rem; letter-spacing: 0.16em; color: var(--ink-dim); }
.sec-head p { margin: 10px 0 0; color: var(--ink-2); max-width: 46ch; }

.modules { display: grid; gap: 16px; }
.grid-5 { grid-template-columns: repeat(6, 1fr); }
.grid-4 { grid-template-columns: repeat(2, 1fr); }
.card { position: relative; background: linear-gradient(180deg, var(--panel-2), var(--panel)); border: 1px solid var(--line); border-radius: 4px; padding: 26px 24px; overflow: hidden; transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s; }
.card::after { content: ""; position: absolute; top: 0; left: 0; width: 22px; height: 22px; border-top: 2px solid var(--scan); border-left: 2px solid var(--scan); opacity: 0; transition: 0.3s; }
.card:hover { border-color: var(--line-strong); transform: translateY(-3px); box-shadow: 0 20px 44px -26px rgba(0, 0, 0, 0.9); }
.card:hover::after { opacity: 0.85; }
.card .ci { font-family: var(--f-mono); font-size: 0.68rem; letter-spacing: 0.14em; color: var(--scan); margin-bottom: 16px; }
.card h3 { font-size: 1.18rem; letter-spacing: 0; margin-bottom: 9px; font-family: var(--f-body); font-weight: 700; }
.card p { margin: 0; color: var(--ink-2); font-size: 0.94rem; line-height: 1.65; }
.card .k { color: var(--lock); font-family: var(--f-mono); font-size: 0.9em; }
.grid-5 .card.lead { grid-column: span 3; grid-row: span 2; display: flex; flex-direction: column; justify-content: space-between; }
.grid-5 .card:not(.lead) { grid-column: span 3; }
.card.lead h3 { font-size: 1.7rem; font-family: var(--f-disp); letter-spacing: 0.01em; }
.card.lead .big-num { font-family: var(--f-mono); color: var(--scan); font-size: 0.8rem; letter-spacing: 0.1em; margin-top: 20px; }
.card .icon { width: 34px; height: 34px; margin-bottom: 16px; color: var(--scan); }
.card .icon svg { width: 100%; height: 100%; display: block; stroke: currentColor; fill: none; stroke-width: 1.6; }

.remote { background: linear-gradient(180deg, transparent, rgba(47, 224, 206, 0.03)); }
.remote-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 52px; align-items: center; }
.remote ul { list-style: none; padding: 0; margin: 26px 0 0; display: grid; gap: 16px; }
.remote li { display: flex; gap: 15px; align-items: flex-start; }
.remote li .b { flex: 0 0 auto; width: 26px; height: 26px; border: 1px solid var(--scan); border-radius: 3px; display: grid; place-items: center; font-family: var(--f-mono); font-size: 0.7rem; color: var(--scan); margin-top: 2px; }
.remote li b { color: var(--ink); font-weight: 700; font-family: var(--f-body); }
.remote li span { color: var(--ink-2); font-size: 0.95rem; }
.phone { justify-self: center; width: 280px; aspect-ratio: 9 / 18.6; border: 1.5px solid var(--line-strong); border-radius: 30px; padding: 12px; background: linear-gradient(180deg, var(--panel-2), var(--ground)); box-shadow: 0 40px 90px -34px rgba(0, 0, 0, 0.85), inset 0 0 40px rgba(0, 0, 0, 0.5); position: relative; }
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
.screen .cam .sl { position: absolute; left: 0; right: 0; height: 1.5px; background: linear-gradient(90deg, transparent, var(--scan), transparent); box-shadow: 0 0 8px var(--scan-glow); animation: mh-sweep 3.4s linear infinite; }
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
.qcard { border: 1px solid var(--line); border-radius: 4px; padding: 22px 18px; background: var(--panel); }
.qcard .qi { width: 30px; height: 30px; color: var(--lock); margin-bottom: 14px; }
.qcard .qi svg { width: 100%; height: 100%; stroke: currentColor; fill: none; stroke-width: 1.6; }
.qcard h3 { font-size: 1rem; font-family: var(--f-body); font-weight: 700; margin-bottom: 7px; }
.qcard p { margin: 0; color: var(--ink-dim); font-size: 0.84rem; line-height: 1.6; }

.finale { text-align: center; padding: 96px 0; }
.finale .frame { position: relative; border: 1px solid var(--line-strong); border-radius: 6px; padding: 64px 32px; background: radial-gradient(600px 300px at 50% 0%, rgba(47, 224, 206, 0.08), transparent 70%), linear-gradient(180deg, var(--panel-2), var(--panel)); }
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
.price, .qr { border: 1px solid var(--line-strong); border-radius: 4px; padding: 26px 30px; background: rgba(8, 11, 18, 0.45); text-align: left; }
.price { display: flex; flex-direction: column; justify-content: center; min-width: 250px; }
.price .pk { font-family: var(--f-mono); font-size: 0.7rem; letter-spacing: 0.14em; color: var(--scan); }
.price .pv { font-family: var(--f-disp); font-weight: 700; font-size: 3.1rem; line-height: 1; color: var(--ink); margin: 12px 0 8px; }
.price .pv .cur { font-size: 1.35rem; color: var(--ink-2); vertical-align: super; margin-right: 3px; }
.price .pv .per { font-size: 1rem; color: var(--ink-dim); font-family: var(--f-body); font-weight: 400; letter-spacing: 0; }
.price .pn { font-size: 0.85rem; color: var(--ink-2); line-height: 1.6; }
.qr { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 13px; text-align: center; min-width: 200px; }
.qr img { background: #fff; padding: 10px; border-radius: 6px; display: block; width: 150px; height: 150px; }
.qr .qrt { font-family: var(--f-mono); font-size: 0.74rem; letter-spacing: 0.06em; color: var(--online); }
.qr .qrt b { color: var(--ink); font-family: var(--f-body); display: block; font-size: 0.9rem; margin-bottom: 2px; }

footer { border-top: 1px solid var(--line); padding: 34px 0 46px; }
footer .wrap { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; }
footer .brand { opacity: 0.9; }
footer .meta { font-family: var(--f-mono); font-size: 0.72rem; color: var(--ink-dim); letter-spacing: 0.04em; line-height: 1.8; }
footer a.gh { color: var(--ink-2); border-bottom: 1px solid var(--line-strong); }

.reveal { opacity: 0; transform: translateY(22px); transition: opacity 0.7s ease, transform 0.7s ease; }
.reveal.in { opacity: 1; transform: none; }

@media (max-width: 900px) {
  .hero-grid { grid-template-columns: 1fr; gap: 36px; }
  .hero p.lead { max-width: none; }
  .telemetry .wrap { grid-template-columns: repeat(2, 1fr); }
  .tcell:nth-child(3) { border-left: 0; }
  .grid-5 { grid-template-columns: 1fr; }
  .grid-5 .card.lead, .grid-5 .card:not(.lead) { grid-column: auto; }
  .grid-4 { grid-template-columns: 1fr; }
  .remote-grid { grid-template-columns: 1fr; gap: 38px; }
  .remote .phone { order: -1; }
  .qual { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 520px) {
  .tcell .num { font-size: 1.6rem; }
  .qual { grid-template-columns: 1fr; }
  .nav-cta { display: none; }
  .price .pv { font-size: 2.5rem; }
}
@media (prefers-reduced-motion: reduce) {
  .mh-root * { animation: none !important; }
  .reveal { opacity: 1; transform: none; transition: none; }
  .reticle { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
