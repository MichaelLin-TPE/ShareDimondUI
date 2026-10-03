// 天堂塔防的畫面:地圖、塔、怪、女神像、特效,全部畫在一張 Canvas 上。
//
// 這裡只負責「把後端算好的結果演出來」:打一波時後端回傳事件序列(誰在第幾個 tick 出場、走到哪、被誰打、扣多少血),
// 這個檔照時間軸播放。傷害、機率、勝負都不在這裡算 —— 改這個檔只會改變畫面,改不了成績。
// 地圖怎麼畫在 terrain.ts,特效怎麼畫在 fx.ts,這個檔決定「什麼時候放哪一個」。
import { EV, HIT_FLAG, KNIGHT, STATUS, type RunView, type TdConfig, type TowerView } from './api'
import type { SfxName } from './audio'
import { FxLayer, P, setLowQuality } from './fx'
import { DECOR_SPRITES, H, THEME_COUNT, TOP, VH, W, clearGlowCache, drawAmbientOver, drawAmbientUnder, glow, renderTerrain, type Terrain } from './terrain'

const ASSET = '/aegis/td/'

export interface SceneAssets {
  cls: { idle: HTMLImageElement; attack: HTMLImageElement }[]
  mobs: HTMLImageElement[]
  bosses: HTMLImageElement[]
  goddess: HTMLImageElement
  /** 地圖上的擺設(樹、房子…);載不到的就不在裡面,地圖會改用畫的 */
  decor: Record<string, HTMLImageElement>
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('圖片載入失敗:' + src))
    img.src = src
  })
}

export async function loadAssets(): Promise<SceneAssets> {
  const cls = await Promise.all([0, 1, 2, 3, 4].map(async (i) => ({
    idle: await loadImage(`${ASSET}cls${i}_idle.webp`),
    attack: await loadImage(`${ASSET}cls${i}_attack.webp`),
  })))
  const mobs = await Promise.all([0, 1, 2, 3, 4, 5, 6].map((i) => loadImage(`${ASSET}mob${i}.webp`)))
  const bosses = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => loadImage(`${ASSET}boss${i}.webp`)))
  const goddess = await loadImage(`${ASSET}goddess.webp`)
  const decor: Record<string, HTMLImageElement> = {}
  await Promise.all(DECOR_SPRITES.map(async (n) => {
    try { decor[n] = await loadImage(`${ASSET}decor_${n}.webp`) } catch { /* 少一張擺設不影響遊戲 */ }
  }))
  return { cls, mobs, bosses, goddess, decor }
}

// 職業的代表色(特效、徽章用):妖精、騎士、法師、黑妖、君主
const CLS_COLOR = ['#8fe06a', '#cfd8e6', '#b78bff', '#ff5a7a', '#ffd35a']
// 法師三條路線的顏色:沒選、火、冰、雷
const WIZ_COLOR = ['#b78bff', '#ff7a1f', '#8fe0ff', '#9fc4ff']
// 每張圖畫出來本來面向哪一邊(true = 朝左)。攻擊時要轉向目標,所以得先知道原圖朝哪。順序:妖精、騎士、法師、黑妖、君主
const FACES_LEFT: { idle: boolean; attack: boolean }[] = [
  { idle: false, attack: false },
  { idle: true, attack: true },
  { idle: true, attack: false },
  { idle: true, attack: true },
  { idle: false, attack: false },
]
// 怪顯示多高(邏輯像素):一般、快速、厚血、成群、飛行、魔抗、物抗
const MOB_H = [46, 40, 62, 32, 46, 48, 48]

interface TowerVis {
  slot: number; cls: number; level: number; path: number
  /** 塔位座標 */
  sx: number; sy: number
  /** 角色站的位置(就是塔位) */
  x: number; y: number
  /** 騎士在路上把怪攔下來的地方(畫面座標) */
  guards: [number, number][]
  rangePx: number
  attackAt: number; faceLeft: boolean
  kHp: number; kMax: number; down: boolean; upAt: number; hurtAt: number
  bornAt: number
}
interface MobVis {
  id: number; type: number; rank: number; hp: number; maxHp: number
  keyPos: number; keyTick: number; v: number
  x: number; y: number; dir: number; moving: boolean
  flashAt: number; slowUntil: number; stunUntil: number; poisonUntil: number
  /** 狀態的樣子從什麼時候開始出現(招式飛到了才變色) */
  slowFrom: number; stunFrom: number
  gone: boolean; goneAt: number; leaked: boolean; bornAt: number
}
interface Cast { kind: number; first: boolean; n: number; px: number; py: number }

export class TdScene {
  private ctx: CanvasRenderingContext2D
  private terrain: Terrain | null = null
  private terrainKey = ''
  private tints = new Map<string, HTMLCanvasElement>()
  private segEnd: number[] = []
  private length = 0
  private raf = 0
  private last = 0
  private destroyed = false

  private towers: (TowerVis | null)[] = []
  private mobs = new Map<number, MobVis>()
  private fx = new FxLayer()
  private sfxQueue: { at: number; name: SfxName; scale: number }[] = []

  /** 畫面效果用的時鐘(一直往前走;開快轉時跟著變快) */
  private fxTick = 0
  /** 真實時間(秒):飄雪、水面這些氛圍不跟著快轉 */
  private clock = 0
  /** 戰鬥播放到第幾個 tick */
  private playTick = 0
  private events: number[][] | null = null
  private evIdx = 0
  private ended = false
  private endedAt = 0
  private done: (() => void) | null = null
  private lastCast = new Map<number, Cast>()

  /** 跑不動就自動降畫質(手機打到後面怪多塔多,光效太多會卡到白屏):0 全開、1 減特效關氛圍、2 再降解析度 */
  private lowQ = false
  private tier = 0
  /** 手機(觸控):預設就用輕一點的畫質 */
  private mobile = window.matchMedia('(pointer: coarse)').matches
  /** 最近幾格平均花幾毫秒 */
  private frameMs = 16
  private lowSince = 0
  private chapter = 0
  private bossKind = 0
  private wave = 0
  private goddessHp = 20
  private goddessMax = 20
  private goddessHitAt = -999
  private reviveAt = -999
  private shakeAt = -999
  private shakeAmp = 0
  private bossLag = 1

  speed = 1
  selected = -1
  hover = -1
  /** 正在挑位置放哪個職業(-1 = 沒有);會把空位標亮並預覽射程 */
  placing = -1
  placingRange = 0
  onSlot: (slot: number) => void = () => {}
  /** 該出聲了(射箭、爆炸、怪倒下…);要不要真的播由外面決定 */
  onSfx: (name: SfxName, scale: number) => void = () => {}

  private canvas: HTMLCanvasElement
  private frames = 0

  constructor(canvas: HTMLCanvasElement, private cfg: TdConfig, private assets: SceneAssets) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    let acc = 0
    for (let i = 0; i < cfg.path.length - 1; i++) {
      const a = cfg.path[i] as number[], b = cfg.path[i + 1] as number[]
      acc += (Math.abs((b[0] ?? 0) - (a[0] ?? 0)) + Math.abs((b[1] ?? 0) - (a[1] ?? 0))) * cfg.unit
      this.segEnd.push(acc)
    }
    this.length = acc
    this.bindCanvas()
    // 手機切到別的 App 再回來,瀏覽器會把背景分頁的畫布內容丟掉(底圖那張就變成全黑):回到前景就全部重畫
    document.addEventListener('visibilitychange', this.onVisible)
    window.addEventListener('pageshow', this.onVisible)
    this.fx.quality = this.mobile ? 0.6 : 1
    this.resizeNow()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.unbindCanvas()
    window.clearTimeout(this.resizeTimer)
    document.removeEventListener('visibilitychange', this.onVisible)
    window.removeEventListener('pageshow', this.onVisible)
    this.releaseTerrain()
    this.done?.()
  }

  private bindCanvas() {
    const c = this.canvas
    c.addEventListener('click', this.onClick)
    c.addEventListener('mousemove', this.onMove)
    c.addEventListener('mouseleave', this.onLeave)
    c.addEventListener('contextlost', this.onContextLost)
    c.addEventListener('contextrestored', this.onVisible)
  }

  private unbindCanvas() {
    const c = this.canvas
    c.removeEventListener('click', this.onClick)
    c.removeEventListener('mousemove', this.onMove)
    c.removeEventListener('mouseleave', this.onLeave)
    c.removeEventListener('contextlost', this.onContextLost)
    c.removeEventListener('contextrestored', this.onVisible)
  }

  /**
   * 畫布被瀏覽器殺掉了(手機 Chrome 切全螢幕、記憶體不夠時會發生,畫面整片白、左上角一個哭臉):
   * 同一張畫布救不回來,直接換一張新的放回同一個位置,底圖和快取全部重畫。
   */
  private replaceCanvas(reason: string) {
    const old = this.canvas
    const oldSize = `${old.width}×${old.height}`
    this.lastReplace = performance.now()
    this.replaced++
    const cv = document.createElement('canvas')
    cv.style.cursor = old.style.cursor
    // Vue 的 scoped 樣式靠 data-v-xxx 屬性認元素:新畫布要帶一樣的屬性,不然 width:100% 不會套到它
    for (const a of Array.from(old.attributes)) if (a.name.startsWith('data-v-') || a.name === 'class') cv.setAttribute(a.name, a.value)
    this.unbindCanvas()
    old.replaceWith(cv)
    old.width = 0; old.height = 0
    this.canvas = cv
    this.ctx = cv.getContext('2d') as CanvasRenderingContext2D
    this.bindCanvas()
    this.releaseTerrain()
    this.tints.clear()
    clearGlowCache()
    this.canvas.width = 0
    this.resizeNow()
    this.onCanvasLost(`畫面重建 #${this.replaced}(${reason};舊畫布 ${oldSize}、dpr ${window.devicePixelRatio}、視窗 ${window.innerWidth}×${window.innerHeight}${document.fullscreenElement ? '、全螢幕' : ''}、畫質 ${this.tier}、${this.frameMs.toFixed(0)}ms/格、第 ${this.wave} 波)`)
  }

  private resizeTimer = 0
  /** 外框變了:等它穩定(全螢幕、轉向的過程會跳好幾次)再真的改畫布 */
  resize() {
    window.clearTimeout(this.resizeTimer)
    this.resizeTimer = window.setTimeout(() => this.resizeNow(), 150)
  }

  /** 畫布大小跟著外框走(外框維持 1000:660) */
  private resizeNow() {
    // 低畫質時解析度降到 1.25 倍:手機 GPU 最吃的是像素數
    const dpr = Math.min(this.tier >= 2 ? 1.25 : this.mobile ? 1.5 : 2, window.devicePixelRatio || 1)
    const cw = Math.max(320, this.canvas.clientWidth)
    const w = Math.round(cw * dpr)
    // 手機網址列縮進縮出會讓外框差個一兩像素,每次都重做底圖(100ms)太浪費:差很少就不動
    if (Math.abs(w - this.canvas.width) < 4 && this.canvas.width > 0) return
    this.canvas.width = w
    this.canvas.height = Math.round((cw * VH) / W * dpr)
  }

  private releaseTerrain() {
    // 舊底圖主動縮成 0:有些手機瀏覽器不會馬上回收畫布的記憶體,一直換場景會累積到被整個丟掉
    if (this.terrain) { this.terrain.canvas.width = 0; this.terrain.canvas.height = 0 }
    this.terrain = null
    this.terrainKey = ''
  }

  /**
   * 每一格花了多久:連續一秒都超過 45ms 就降一階(先減特效、關氛圍;還是超過 70ms 才降解析度);
   * 降了之後要連續五秒都很順才升回來
   */
  private watchFps(ms: number, now: number) {
    this.frameMs = this.frameMs * 0.9 + ms * 0.1
    const limit = this.tier === 0 ? 45 : 70
    if (this.tier < 2 && this.frameMs > limit) {
      if (!this.lowSince) this.lowSince = now; else if (now - this.lowSince > 1000) this.setTier(this.tier + 1, now)
    } else if (this.tier > 0 && this.frameMs < 20) {
      if (!this.lowSince) this.lowSince = now; else if (now - this.lowSince > 5000) this.setTier(0, now)
    } else this.lowSince = 0
  }

  private setTier(tier: number, now: number) {
    this.tier = tier
    this.lowQ = tier > 0
    this.lowSince = 0
    this.frameMs = tier > 0 ? 30 : 16
    this.fx.quality = tier > 0 ? 0.35 : this.mobile ? 0.6 : 1
    setLowQuality(tier > 0)
    this.releaseTerrain()
    this.canvas.width = 0          // 讓 resize 一定重設
    this.resizeNow()
    this.last = now
  }

  private setQuality(low: boolean, now: number) { this.setTier(low ? 1 : 0, now) }

  /** 網址帶 debug 時在畫面右下角印效能數字(手機沒主控台) */
  private debug = /[?&]debug/.test(location.href)
  private drawDebug(c: CanvasRenderingContext2D) {
    c.save()
    c.font = '600 12px monospace'; c.textAlign = 'right'; c.textBaseline = 'bottom'
    c.fillStyle = 'rgba(0,0,0,0.7)'
    c.fillRect(W - 330, VH - 44, 330, 44)
    c.fillStyle = '#8ff06a'
    c.fillText(`${this.frameMs.toFixed(1)}ms/格  畫質${this.tier === 0 ? '一般' : '低' + this.tier}  ${this.canvas.width}×${this.canvas.height}  dpr${window.devicePixelRatio}`, W - 8, VH - 24)
    c.fillText(`粒子${this.fx.parts.length} 特效${this.fx.list.length} 怪${this.mobs.size} 重建${this.replaced} ${document.fullscreenElement ? '全螢幕' : ''} ${this.mobile ? '觸控' : ''}`, W - 8, VH - 6)
    c.restore()
  }

  /** 畫布死掉的時候給頁面看的診斷(顯示在畫面上,手機沒有主控台) */
  onCanvasLost: (info: string) => void = () => {}
  private lastReplace = 0
  private replaced = 0

  private probeCv: HTMLCanvasElement | null = null
  private deadProbes = 0
  private probe() {
    // 畫布還沒有尺寸、底圖還沒畫出來,讀到透明是正常的,不算
    if (this.canvas.width === 0 || !this.terrain) return
    let px: Uint8ClampedArray
    try {
      if (!this.probeCv) { this.probeCv = document.createElement('canvas'); this.probeCv.width = 1; this.probeCv.height = 1 }
      const pc = this.probeCv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
      pc.clearRect(0, 0, 1, 1)
      pc.drawImage(this.canvas, Math.floor(this.canvas.width / 2), Math.floor(this.canvas.height / 2), 1, 1, 0, 0, 1, 1)
      px = pc.getImageData(0, 0, 1, 1).data
    } catch {
      return
    }
    const dead = (px[3] ?? 0) === 0 || ((px[0] ?? 0) > 250 && (px[1] ?? 0) > 250 && (px[2] ?? 0) > 250)
    if (!dead) { this.deadProbes = 0; return }
    if (++this.deadProbes < 2) return             // 連續兩秒都是死的才算(偶爾一格沒畫到不算)
    this.deadProbes = 0
    const now = performance.now()
    if (now - this.lastReplace < 5000) return      // 剛換過還是死的:不要一直換,等下一次
    this.replaceCanvas(`像素 ${px[0]},${px[1]},${px[2]},${px[3]}`)
  }

  // ===================== 布置階段:把後端給的局面擺出來 =====================

  setRun(run: RunView) {
    const first = this.wave === 0
    const chapter = Math.floor((run.wave - 1) / 10) % THEME_COUNT
    // 換場景:中間跳出這一章的名字
    if (!first && chapter !== this.chapter) this.fx.banner(run.chapter, `第 ${run.wave} 波`, '#ffd76a', 56)
    this.wave = run.wave
    this.chapter = chapter
    this.bossKind = Math.floor((run.wave - 1) / 10) % this.assets.bosses.length
    this.goddessHp = run.goddessHp
    this.goddessMax = run.goddessMax
    const prev = this.towers
    this.towers = run.towers.map((t, i) => (t ? this.makeTower(i, t, prev[i] ?? null, first) : null))
    if (!this.events) {
      this.mobs.clear()
    }
  }

  private makeTower(slot: number, t: TowerView, old: TowerVis | null, quiet: boolean): TowerVis {
    const cls = ['ELF', 'KNIGHT', 'WIZARD', 'DARKELF', 'PRINCE'].indexOf(t.cls)
    const s = this.cfg.slots[slot] as number[]
    const sx = s[0] ?? 0, sy = s[1] ?? 0
    const x = sx, y = sy
    const guards = (t.guards ?? []).map((g) => this.posXY(g))
    const same = old && old.cls === cls
    const color = CLS_COLOR[cls] ?? '#ffffff'
    if (!same) {
      if (!quiet) {      // 新招募的:一道光打下來
        this.fx.add('pillar', 0, 14, x, y, { r: 24, color })
        this.fx.add('ring', 0, 10, x, y, { r: 44, color })
        this.fx.burst(x, y - 30, color, 18)
      }
    } else if (old.level !== t.level || old.path !== t.path) {   // 升級 / 選路線
      this.fx.rise(x, y, color, 26)
      this.fx.add('ring', 0, 10, x, y, { r: 40, color })
      if (old.path !== t.path) this.fx.add('pillar', 0, 16, x, y, { r: 28, color })
    }
    return {
      slot, cls, level: t.level, path: t.path, sx, sy, x, y, guards, rangePx: t.rangePx,
      attackAt: same ? old.attackAt : -999, faceLeft: same ? old.faceLeft : false,
      kHp: t.hp, kMax: t.hp, down: false, upAt: -999, hurtAt: -999, bornAt: same ? old.bornAt : this.fxTick,
    }
  }

  // ===================== 打一波:照事件序列播放 =====================

  /** 播完(或被 destroy)才 resolve */
  play(events: number[][]): Promise<void> {
    this.events = events
    this.evIdx = 0
    this.playTick = 0
    this.ended = false
    this.mobs.clear()
    this.lastCast.clear()
    this.bossLag = 1
    for (const t of this.towers) if (t) { t.down = false; t.kHp = t.kMax; t.attackAt = -999 }
    this.fx.float(W / 2, 222, `第 ${this.wave} 波`, '#fff3cf', 22, 34, 0, 1)
    return new Promise((resolve) => { this.done = resolve })
  }

  get playing() { return this.events !== null }

  /** 不想看了:直接跳到結果 */
  skip() {
    if (!this.events) return
    this.sfxQueue = []
    while (this.evIdx < this.events.length) this.apply(this.events[this.evIdx++] as number[], true)
    this.finish()
  }

  private finish() {
    this.events = null
    for (const m of this.mobs.values()) if (!m.gone) { m.gone = true; m.goneAt = this.fxTick }
    const d = this.done
    this.done = null
    d?.()
  }

  private frame = (now: number) => {
    if (this.destroyed) return
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    const t0 = performance.now()
    // 每半秒檢查一次畫布還在不在(有些瀏覽器殺掉畫布不會通知):不在就換一張新的
    if (++this.frames % 30 === 0) {
      const ctx = this.ctx as CanvasRenderingContext2D & { isContextLost?: () => boolean }
      if (ctx.isContextLost?.()) this.replaceCanvas('isContextLost')
    }
    this.advance(dt)
    // 每秒探一個像素:底圖畫完之後畫布中間一定是不透明的顏色;讀到透明或整片白就是畫布已經壞了(手機 Chrome 不一定會通知)
    if (this.frames % 60 === 0 && document.visibilityState === 'visible') this.probe()
    if (this.events) this.watchFps(performance.now() - t0, now)   // 只在戰鬥中量(布置時本來就很輕)
    this.raf = requestAnimationFrame(this.frame)
  }

  /** 往前走 dt 秒並重畫一次(平常由瀏覽器每一格呼叫) */
  advance(dt: number) {
    const d = dt * this.cfg.tps * (this.events ? this.speed : 1)
    this.clock += dt
    this.fxTick += d
    this.fx.t = this.fxTick
    if (this.events) {
      if (!this.ended) {
        this.playTick += d
        while (this.evIdx < this.events.length && ((this.events[this.evIdx] as number[])[1] ?? 0) <= this.playTick) {
          this.apply(this.events[this.evIdx++] as number[], false)
        }
      } else if (this.fxTick - this.endedAt > 20) {
        this.finish()   // 最後一下的特效播完再收
      }
    }
    if (this.sfxQueue.length) {
      this.sfxQueue = this.sfxQueue.filter((s) => {
        if (s.at > this.fxTick) return true
        this.onSfx(s.name, s.scale)
        return false
      })
    }
    this.update(d)
    this.draw()
  }

  private sfx(name: SfxName, delay = 0, scale = 1) {
    if (delay <= 0) this.onSfx(name, scale)
    else this.sfxQueue.push({ at: this.fxTick + delay, name, scale })
  }

  private apply(e: number[], silent: boolean) {
    const t = this.fxTick
    const fx = this.fx
    switch (e[0]) {
      case EV.SPAWN: {
        const [x, y] = this.posXY(0)
        const rank = e[4] ?? 0
        this.mobs.set(e[2] ?? 0, {
          id: e[2] ?? 0, type: e[3] ?? 0, rank, hp: e[5] ?? 1, maxHp: e[5] ?? 1,
          keyPos: 0, keyTick: e[1] ?? 0, v: 0, x, y, dir: 1, moving: false,
          flashAt: -99, slowUntil: -99, stunUntil: -99, poisonUntil: -99, slowFrom: 0, stunFrom: 0, gone: false, goneAt: 0, leaked: false, bornAt: t,
        })
        if (silent) break
        fx.smoke(x + 14, y - 14, rank === 2 ? 8 : 2, 0, '#3a1f5a', 10)
        if (rank === 2) {      // 王出場:橫幅、畫面邊緣泛紅、吼一聲
          fx.banner('首領來襲', this.cfg.bosses[this.bossKind] ?? '', '#ff4a3d', 40)
          fx.screenEdge('#ff2a1a', 0.6, 40)
          fx.add('ring', 0, 16, x + 20, y, { r: 120, color: '#ff6a4a', v: 6 })
          this.shake(8)
          this.sfx(('boss' + this.bossKind) as SfxName)
        } else if (rank === 1) {
          fx.add('ring', 0, 10, x + 16, y, { r: 46, color: '#ff6a4a' })
        }
        break
      }
      case EV.MOVE: {
        const m = this.mobs.get(e[2] ?? -1)
        if (m) { m.keyPos = e[3] ?? 0; m.keyTick = e[1] ?? 0; m.v = e[4] ?? 0 }
        break
      }
      case EV.CAST: {
        const tw = this.towers[e[2] ?? -1]
        const m = this.mobs.get(e[4] ?? -1)
        if (!tw) break
        tw.attackAt = t
        if (m) tw.faceLeft = m.x < tw.x
        const kind = e[3] ?? 0
        const dir = tw.faceLeft ? -1 : 1
        this.lastCast.set(tw.slot, { kind, first: true, n: 0, px: tw.x + dir * 16, py: tw.y - 78 })
        if (silent) break
        const cls = Math.floor(kind / 10), path = kind % 10
        if (cls === 0) {
          this.sfx('elf_shoot', 1.4)
        } else if (cls === 1) {
          this.sfx((['sword1', 'sword2', 'sword3'] as const)[Math.floor(Math.random() * 3)] ?? 'sword1', 1.6)
        } else if (cls === 2) {   // 法師:腳下亮起魔法陣
          fx.add('circle', 0, 9, tw.x, tw.y + 2, { r: 34, color: WIZ_COLOR[path] ?? '#b78bff' })
          if (path === 3) this.sfx('lightning', 1.3)
          else {
            this.sfx(path === 1 ? 'fireball' : 'staff', 1.6)
            this.sfx(path === 1 ? 'firestorm' : path === 2 ? 'blizzard' : 'fireball', path === 2 ? 3.4 : 4.6)
          }
        } else if (cls === 3) {
          this.sfx(Math.random() > 0.5 ? 'dagger1' : 'dagger2', 1.6)
        }
        break
      }
      case EV.HIT: {
        const m = this.mobs.get(e[3] ?? -1)
        if (!m) break
        m.hp = e[6] ?? 0
        if (silent) break
        this.hitFx(e[2] ?? -1, m, e[4] ?? 0, e[5] ?? 0)
        break
      }
      case EV.STATUS: {
        const m = this.mobs.get(e[2] ?? -1)
        if (!m) break
        if (e[3] === STATUS.SLOW) { if (t >= m.slowUntil) m.slowFrom = silent ? t : t + 4.2; m.slowUntil = t + (e[4] ?? 0) }
        if (e[3] === STATUS.POISON) m.poisonUntil = t + (e[4] ?? 0)
        if (e[3] === STATUS.STUN) {
          if (t >= m.stunUntil) m.stunFrom = silent ? t : t + 4.4
          m.stunUntil = t + (e[4] ?? 0)
          if (silent) break
          // 衝擊之暈:劍氣到了才暈,冒一圈星星
          fx.stars(m.x, this.mobMid(m) - this.mobHeight(m) / 2, '#ffe14d', 7, 4.4)
          fx.add('ring', 4.4, 9, m.x, m.y, { r: 34, color: '#ffe14d', v: 3 })
          this.sfx('stun', 4.4)
        }
        break
      }
      case EV.DIE: {
        const m = this.mobs.get(e[2] ?? -1)
        if (!m) break
        m.gone = true; m.goneAt = t; m.hp = 0
        if (silent) break
        const my = this.mobMid(m)
        fx.float(m.x, my - this.mobHeight(m) / 2 - 6, '+' + (e[3] ?? 0), '#ffd76a', 13, 22)
        if (m.rank === 2) {     // 王倒下:連環爆炸、整個畫面閃白、噴一地天幣
          for (let i = 0; i < 7; i++) {
            fx.add('explode', i * 2.2, 12, m.x + (Math.random() - 0.5) * 90, my + (Math.random() - 0.5) * 80, { r: 44 + Math.random() * 34, color: i % 2 ? '#ff8a2a' : '#ffd24d' })
          }
          fx.add('ring', 0, 18, m.x, m.y, { r: 240, color: '#ffe2b0', v: 8 })
          fx.add('ring', 5, 18, m.x, m.y, { r: 170, color: '#ffb347', v: 6 })
          fx.add('pillar', 3, 26, m.x, m.y, { r: 44, color: '#ffd76a' })
          fx.burst(m.x, my, '#ffb347', 70, 0, P.GLOW, 1.8)
          fx.sparks(m.x, my, '#fff0c0', 40, 0, 1.6)
          fx.smoke(m.x, my, 12, 4, '#2a2420', 40)
          fx.coins(m.x, my, 18)
          fx.screenFlash('#ffffff', 0.7, 12)
          this.shake(14)
          this.sfx(('bossdie' + this.bossKind) as SfxName)
        } else {
          const elite = m.rank === 1
          fx.add('soul', 2, 18, m.x, my, { color: elite ? '#ff9a7a' : '#bfe0ff' })
          fx.add('flash', 0, 4, m.x, my, { r: elite ? 22 : 13, color: '#fff4c7' })
          fx.burst(m.x, my, '#fff4c7', elite ? 16 : 6)
          fx.smoke(m.x, m.y - 8, elite ? 4 : 2, 0, '#3a3430', 8)
          fx.coins(m.x, my, elite ? 4 : 1)
          this.sfx(('die' + m.type) as SfxName, 0, elite ? 1 : 0.75)
        }
        break
      }
      case EV.LEAK: {
        const m = this.mobs.get(e[2] ?? -1)
        if (m) { m.gone = true; m.goneAt = t; m.leaked = true }
        this.goddessHp = e[4] ?? 0
        if (silent) break
        const g = this.cfg.goddess
        const gx = g[0] ?? 0, gy = g[1] ?? 0
        if ((e[3] ?? 0) > 0) {
          this.goddessHitAt = t
          fx.float(gx, gy - 120, '-' + e[3], '#ff5a4a', 22, 30, 0, 1)
          fx.sparks(gx, gy - 40, '#ff8a6a', 14)
          fx.burst(gx, gy - 50, '#ff5a4a', 12)
          fx.add('flash', 0, 6, gx, gy - 40, { r: 34, color: '#ff5a4a' })
          fx.screenEdge('#ff2a1a', e[3] === 10 ? 0.75 : 0.5, 12)
          this.shake(e[3] === 10 ? 14 : 5)
          this.sfx('goddess_hit')
        } else {
          fx.add('shield', 0, 12, gx, gy + 44, { r: 86, color: '#7fd8ff' })
          fx.float(gx, gy - 120, '結界擋下', '#9fe8ff', 14, 30)
          this.sfx('shield')
        }
        break
      }
      case EV.KNIGHT: {
        const tw = this.towers[e[2] ?? -1]
        if (!tw) break
        tw.kHp = e[3] ?? 0
        if (e[4] === KNIGHT.HIT && !silent) {       // 被怪抓了一下
          tw.hurtAt = t
          fx.add('slash', 0, 5, tw.x, tw.y - 40, { r: 17, color: '#ff5a4a', v: -0.9 + Math.random() * 0.5 })
          fx.sparks(tw.x, tw.y - 40, '#ffb09a', 3, 0, 0.6)
        }
        if (e[4] === KNIGHT.DOWN) {
          tw.down = true
          if (!silent) {
            fx.float(tw.x, tw.y - 80, '倒下', '#ff8f7a', 14, 30)
            fx.smoke(tw.x, tw.y - 10, 5, 0, '#3a3430', 14)
            this.sfx('knight_down')
          }
        }
        if (e[4] === KNIGHT.UP) {
          tw.down = false; tw.upAt = t; tw.kHp = tw.kMax
          if (!silent) {
            fx.add('pillar', 0, 16, tw.x, tw.y, { r: 26, color: '#fff3a8' })
            fx.rise(tw.x, tw.y, '#fff3a8', 22)
            this.sfx('knight_up')
          }
        }
        break
      }
      case EV.BLOCK: {
        // 怪被騎士攔下來:撞上去迸一點火花
        const m = this.mobs.get(e[3] ?? -1)
        if (!m || silent || e[4] !== 1) break
        fx.sparks(m.x + m.dir * 10, this.mobMid(m), '#ffffff', 5, 0, 0.7)
        fx.add('flash', 0, 4, m.x + m.dir * 10, this.mobMid(m), { r: 10, color: '#cfe4ff' })
        break
      }
      case EV.REVIVE: {
        this.goddessHp = e[2] ?? 0
        this.reviveAt = t
        if (!silent) {
          const g = this.cfg.goddess
          const gx = g[0] ?? 0, gy = (g[1] ?? 0) + 40
          fx.float(gx, gy - 222, '起死回生', '#fff3a8', 20, 44, 0, 1)
          fx.add('pillar', 0, 40, gx, gy, { r: 64, color: '#fff3a8' })
          fx.add('ring', 0, 18, gx, gy, { r: 200, color: '#fff3a8', v: 7 })
          fx.rise(gx, gy, '#fff3a8', 60, 60)
          fx.screenFlash('#fff3a8', 0.6, 16)
          this.sfx('revive')
        }
        break
      }
      case EV.END:
        this.ended = true
        this.endedAt = t
        if (!silent && this.goddessHp > 0) {
          fx.float(W / 2, H / 2 - 50, '守住了!', '#ffe9a8', 34, 26, 2, 1)
          const g = this.cfg.goddess
          fx.rise(g[0] ?? 0, (g[1] ?? 0) + 40, '#fff3c8', 24, 50)
        }
        break
    }
  }

  /**
   * 一下命中的特效:依出手的職業與路線放箭、火球、冰、閃電、刀光,再跳傷害數字。
   * 出手到命中有一點時間差(拉弓放箭、舉劍劈下、法球飛過去),閃白和數字等招式「到」了才出現。
   */
  private hitFx(slot: number, m: MobVis, dmg: number, flags: number) {
    const t = this.fxTick
    const fx = this.fx
    const my = this.mobMid(m)
    const tw = this.towers[slot]
    const cast = this.lastCast.get(slot)
    if (flags & HIT_FLAG.POISON) {
      fx.float(m.x + 8, my - 10, String(dmg), '#8ff06a', 11, 18)
      fx.bubble(m.x, my, '#8ff06a', 3)
      this.sfx('poison', 0, 0.7)
      return
    }
    if (flags & HIT_FLAG.REFLECT) {     // 反擊屏障:盾一亮,怪自己吃一刀
      m.flashAt = t
      if (tw) fx.add('shield', 0, 7, tw.x, tw.y, { r: 34, color: '#bcd8ff' })
      fx.add('slash', 0, 5, m.x, my, { r: 18, color: '#bcd8ff', v: 0.7 })
      fx.sparks(m.x, my, '#dfe8ff', 4, 0, 0.7)
      fx.float(m.x, my - 14, String(dmg), '#dfe8ff', 11, 18)
      return
    }
    const crit = (flags & HIT_FLAG.CRIT) !== 0
    const brave = (flags & HIT_FLAG.BRAVE) !== 0
    let delay = 0
    if (tw && cast) {
      const cls = Math.floor(cast.kind / 10), path = cast.kind % 10
      const dir = tw.faceLeft ? -1 : 1
      const n = cast.n++
      if (cls === 0) {
        // 妖精:拉弓、放箭,箭帶著光尾飛過去。三重矢一支接一支,風之箭尾巴長,火箭命中會炸
        const start = 1.4 + n * 0.45
        delay = start + 3
        const color = path === 3 ? '#ff8a2a' : path === 2 ? '#a8ffe0' : '#d8ff9a'
        if (n === 0) fx.add('flash', 1.2, 3, tw.x + dir * 22, tw.y - 46, { r: 9, color })
        fx.add('arrow', start, 3, tw.x + dir * 20, tw.y - 46, { x1: m.x, y1: my, color, v: path === 3 ? 2 : path === 2 ? 1 : 0 })
        fx.sparks(m.x, my, color, 4, delay, 0.7)
        fx.add('flash', delay, 3.5, m.x, my, { r: 10, color, v: 0.4 })
        if (path === 2) fx.add('ring', delay, 6, m.x, m.y, { r: 22, color: '#a8ffe0', v: 2 })
        if (path === 3 && crit) {
          fx.add('explode', delay, 10, m.x, my, { r: 36, color: '#ff7a1f' })
          fx.embers(m.x, my, '#ff9a3d', 10, delay, 12)
          this.sfx('crit_fire', delay)
        }
      } else if (cls === 1) {
        // 騎士:舉劍劈下,一道月牙刀光掃過身前,劍氣飛到路上的怪身上再劃開
        delay = 4.4
        if (cast.first) {
          fx.add('cleave', 1.5, 4.5, tw.x + dir * 14, tw.y - 40, { x1: dir, r: 58 })
          fx.smoke(tw.x + dir * 26, tw.y - 2, 2, 3, '#8a8072', 6)
        }
        fx.add('wave', 2.2, 2.2, tw.x + dir * 40, tw.y - 40, { x1: m.x, y1: my, r: 20 })
        fx.add('slash', delay, 5, m.x, my, { r: 22, color: '#9fd0ff', v: dir > 0 ? 0.9 : Math.PI - 0.9 })
        fx.add('flash', delay, 4, m.x, my, { r: 13, color: '#cfe8ff', v: 0.3 })
        fx.sparks(m.x, my, '#fff6d8', 6, delay)
      } else if (cls === 2) {
        const color = WIZ_COLOR[path] ?? '#b78bff'
        if (path === 3) {
          // 極光雷電:從杖頭打到第一隻,再一隻一隻跳過去
          delay = 1.5 + n * 0.8
          fx.add('bolt', delay, 5.5, cast.px, cast.py, { x1: m.x, y1: my, color })
          cast.px = m.x; cast.py = my
          fx.sparks(m.x, my, '#bcd8ff', 5, delay, 0.8)
          fx.burst(m.x, my, '#9fc4ff', 3, delay)
        } else {
          // 範圍魔法:法球飛到主目標再炸開(火風暴留下火舌和焦痕,冰雪颶風先落冰錐、地面結冰長冰刺)
          delay = 4.6
          if (cast.first) {
            const r = path === 1 ? 91 : 70
            fx.add('orb', 1.6, 3, tw.x + dir * 16, tw.y - 78, { x1: m.x, y1: my, color, r: path === 1 ? 8 : 7, v: path === 2 ? 2 : path === 1 ? 1 : 0 })
            if (path === 1) {
              fx.add('explode', delay, 12, m.x, m.y - 14, { r, color: '#ff7a1f' })
              fx.add('flames', delay, 16, m.x, m.y, { r, color: '#ff7a1f' })
              fx.add('scorch', delay, 110, m.x, m.y, { r: r * 0.9, color: '#140a06' })
              fx.embers(m.x, m.y - 10, '#ff9a3d', 26, delay, r * 0.6)
              fx.smoke(m.x, m.y - 26, 7, delay + 3, '#241a16', r * 0.4)
              fx.sparks(m.x, m.y - 14, '#ffd24d', 14, delay, 1.3)
              fx.debris(m.x, m.y - 6, '#3a2a20', 8, delay)
              this.shakeLater(3.5, delay)
            } else if (path === 2) {
              fx.add('shards', delay - 2.2, 4.4, m.x, m.y, { r, color })
              fx.add('frost', delay - 0.6, 30, m.x, m.y, { r })
              fx.add('spikes', delay - 0.4, 24, m.x, m.y, { r: r * 0.9 })
              fx.add('ring', delay - 0.4, 9, m.x, m.y, { r, color: '#eafaff', v: 3 })
              fx.ice(m.x, m.y - 14, 24, delay - 0.4, 1.3)
              fx.add('scorch', delay, 70, m.x, m.y, { r: r * 0.9, color: '#dff6ff' })
            } else {
              fx.add('explode', delay, 10, m.x, m.y - 14, { r, color })
              fx.add('ring', delay, 9, m.x, m.y, { r, color: '#e0d0ff', v: 3 })
              fx.sparks(m.x, m.y - 14, '#e0d0ff', 12, delay, 1.2)
              fx.burst(m.x, m.y - 14, color, 14, delay)
            }
          } else if (path === 1) fx.embers(m.x, my, '#ff9a3d', 3, delay, 8)
          else if (path === 2) fx.ice(m.x, my, 3, delay, 0.6)
        }
      } else if (cls === 3) {
        // 黑妖:衝上去,兩刀交叉劃開;雙重破壞多補兩刀,毒刃冒綠泡
        delay = 2
        const color = path === 2 ? '#8ff06a' : path === 3 ? '#ff2a4a' : '#ff5a7a'
        const big = m.rank === 2 ? 34 : 24
        fx.add('slash', delay, 5, m.x, my, { r: big, color, v: -0.75 })
        fx.add('slash', delay + 0.9, 5, m.x, my, { r: big, color, v: Math.PI + 0.75 })
        fx.sparks(m.x, my, color, 5, delay + 0.9)
        if (crit) {
          fx.add('slash', delay + 1.8, 5, m.x, my, { r: big * 1.2, color, v: 0.15 })
          fx.add('slash', delay + 2.5, 5, m.x, my, { r: big * 1.2, color, v: Math.PI / 2 })
          this.sfx('crit_double', delay + 1.6)
        }
        if (path === 2) fx.bubble(m.x, my, '#8ff06a', 5, delay)
      }
      cast.first = false
    }
    m.flashAt = t + delay
    const big = crit || brave
    if (crit) {
      fx.add('flash', delay, 5, m.x, my, { r: 22, color: '#ffe14d', v: 0.6 })
      fx.stars(m.x, my, '#ffe14d', 4, delay)
    }
    fx.float(m.x + (Math.random() * 16 - 8), my - 12, String(dmg) + (crit ? '!' : ''), crit ? '#ffe14d' : brave ? '#ffab4d' : '#ffffff', big ? 18 : 12, big ? 26 : 18, delay, crit ? 1 : 0)
  }

  // ===================== 每一格:更新位置 =====================

  private update(dt: number) {
    const t = this.fxTick
    const fx = this.fx
    for (const m of this.mobs.values()) {
      if (m.gone) continue
      const pos = Math.min(this.length, m.keyPos + m.v * Math.max(0, this.playTick - m.keyTick))
      const [x, y] = this.posXY(pos)
      if (Math.abs(x - m.x) > 0.01) m.dir = x > m.x ? 1 : -1
      m.moving = m.v > 0
      m.x = x; m.y = y
      if (t < m.poisonUntil && Math.random() < 0.06) fx.bubble(m.x, this.mobMid(m), '#8ff06a', 1)
      if (m.rank === 2 && Math.random() < dt * 0.5) fx.embers(m.x, m.y - 20, '#ff8a3d', 1, 0, 30)
    }
    for (const [id, m] of this.mobs) if (m.gone && t - m.goneAt > (m.rank === 2 ? 22 : 12)) this.mobs.delete(id)
    // 滿級的塔腳下偶爾冒一點金光;女神像身邊飄著光點
    for (const tw of this.towers) {
      if (tw && tw.level >= this.cfg.maxLevel && !tw.down && Math.random() < dt * 0.12) fx.rise(tw.x, tw.y, '#ffd76a', 1, 18)
    }
    if (Math.random() < dt * 0.22) fx.rise(this.cfg.goddess[0] ?? 0, (this.cfg.goddess[1] ?? 0) + 30, '#fff3c8', 1, 44)
    fx.update(dt)
  }

  // ===================== 畫 =====================

  private draw() {
    const c = this.ctx
    const k = this.canvas.width / W
    const t = this.fxTick
    c.setTransform(k, 0, 0, k, 0, 0)
    c.fillStyle = '#0b0f0b'
    c.fillRect(0, 0, W, VH)
    const sh = t - this.shakeAt < 8 && t >= this.shakeAt ? this.shakeAmp * (1 - (t - this.shakeAt) / 8) : 0
    if (sh > 0.1) c.translate(Math.sin(t * 5.1) * sh, Math.cos(t * 6.7) * sh)
    c.translate(0, TOP)      // 以下用地圖座標畫(畫面比地圖往上多露出 TOP)

    const key = this.chapter + ':' + this.canvas.width
    if (this.terrainKey !== key || !this.terrain) {
      this.releaseTerrain()
      this.terrain = renderTerrain(this.cfg, this.chapter, this.canvas.width, this.assets.decor)
      this.terrainKey = key
    }
    c.drawImage(this.terrain.canvas, 0, -TOP, W, VH)
    if (!this.lowQ) drawAmbientUnder(c, this.terrain, this.cfg, this.clock)

    // 塔位底座 + 君主光環 + 貼地的特效 + 射程
    for (let i = 0; i < this.cfg.slots.length; i++) this.drawSlot(c, i)
    for (const tw of this.towers) if (tw && tw.cls === 4) this.drawAura(c, tw)
    this.drawGoddessBase(c)
    this.fx.drawGround(c)
    this.drawRange(c)

    // 人、怪、女神像照 y 由遠到近畫
    const items: { y: number; fn: () => void }[] = []
    for (const tw of this.towers) if (tw) items.push({ y: tw.y, fn: () => this.drawTower(c, tw) })
    for (const m of this.mobs.values()) items.push({ y: m.y + (m.type === 4 ? 30 : 0), fn: () => this.drawMob(c, m) })
    items.push({ y: this.cfg.goddess[1] ?? 0, fn: () => this.drawGoddess(c) })
    items.sort((a, b) => a.y - b.y)
    for (const it of items) it.fn()

    this.fx.drawAir(c)
    if (!this.lowQ) {              // 低畫質:雲影、飄雪這些氛圍先省下來
      c.translate(0, -TOP)
      drawAmbientOver(c, this.terrain, this.clock)
      c.translate(0, TOP)
    }
    this.fx.drawFloats(c)

    // 以下不跟著鏡頭晃,用畫面座標
    c.setTransform(k, 0, 0, k, 0, 0)
    const ratio = this.goddessHp / Math.max(1, this.goddessMax)
    if (ratio > 0 && ratio <= 0.3) {       // 女神像快倒了:畫面邊緣一直泛紅
      const g = c.createRadialGradient(W / 2, VH / 2, VH * 0.4, W / 2, VH / 2, VH * 0.95)
      g.addColorStop(0, 'rgba(255,40,20,0)'); g.addColorStop(1, 'rgba(255,40,20,' + (0.22 + 0.12 * Math.sin(this.clock * 4)) + ')')
      c.fillStyle = g
      c.fillRect(0, 0, W, VH)
    }
    this.drawBossBar(c)
    this.fx.drawScreen(c)
    if (this.debug) this.drawDebug(c)
  }

  private drawSlot(c: CanvasRenderingContext2D, i: number) {
    const s = this.cfg.slots[i] as number[]
    const x = s[0] ?? 0, y = s[1] ?? 0
    const tw = this.towers[i]
    const t = this.fxTick
    const sel = this.selected === i
    const hot = this.hover === i || sel
    c.save()
    c.translate(x, y)
    // 石台:側面、檯面、內圈刻痕、上緣的反光
    c.fillStyle = hot ? '#6a5a34' : '#4a463e'
    c.beginPath(); c.ellipse(0, 6, 29, 12.5, 0, 0, Math.PI * 2); c.fill()
    const g = c.createLinearGradient(0, -12, 0, 12)
    g.addColorStop(0, hot ? '#f4e6bc' : '#c9c2b0'); g.addColorStop(1, hot ? '#b09a5e' : '#7d776a')
    c.fillStyle = g
    c.beginPath(); c.ellipse(0, 0, 29, 12.5, 0, 0, Math.PI * 2); c.fill()
    c.strokeStyle = sel ? '#ffd76a' : 'rgba(0,0,0,0.5)'
    c.lineWidth = sel ? 2.5 : 1.2
    c.stroke()
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1
    c.beginPath(); c.ellipse(0, 0, 21, 8.8, 0, 0, Math.PI * 2); c.stroke()
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.2
    c.beginPath(); c.ellipse(0, -0.5, 27, 11, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke()
    if (!tw) {
      const placing = this.placing >= 0
      const pulse = placing ? 0.55 + 0.45 * Math.sin(t * 0.35 + i) : 0.5
      if (placing) {
        c.globalCompositeOperation = 'lighter'
        glow(c, 0, 0, 30, '#ffd76a', (hot ? 0.7 : 0.4) * pulse)
        c.globalCompositeOperation = 'source-over'
      }
      c.globalAlpha = hot ? 1 : pulse
      c.strokeStyle = placing ? '#ffd76a' : '#ffffff'
      c.lineWidth = 2.4; c.lineCap = 'round'
      c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.moveTo(0, -4); c.lineTo(0, 4); c.stroke()
    } else if (tw.path > 0) {
      // 選了路線:石台邊緣亮一圈職業色
      c.globalCompositeOperation = 'lighter'
      c.globalAlpha = 0.5 + 0.2 * Math.sin(t * 0.12 + i)
      c.strokeStyle = tw.cls === 2 ? (WIZ_COLOR[tw.path] ?? '#fff') : (CLS_COLOR[tw.cls] ?? '#fff')
      c.lineWidth = 2
      c.beginPath(); c.ellipse(0, 0, 25, 10.4, 0, 0, Math.PI * 2); c.stroke()
    }
    c.restore()
    // 騎士:在路上標出他會把怪攔下來的地方
    if (tw && tw.cls === 1) {
      for (const [gx, gy] of tw.guards) {
        c.save()
        c.translate(gx, gy)
        c.globalAlpha = hot ? 0.95 : 0.6
        c.strokeStyle = CLS_COLOR[1] ?? '#fff'
        c.lineWidth = 2
        c.setLineDash([5, 4])
        c.beginPath(); c.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2); c.stroke()
        c.setLineDash([])
        c.fillStyle = CLS_COLOR[1] ?? '#fff'
        c.beginPath(); c.moveTo(-5, -5); c.lineTo(5, -5); c.lineTo(5, 0); c.quadraticCurveTo(5, 5, 0, 7); c.quadraticCurveTo(-5, 5, -5, 0); c.closePath(); c.fill()
        c.restore()
      }
    }
  }

  private drawAura(c: CanvasRenderingContext2D, tw: TowerVis) {
    const t = this.fxTick
    c.save()
    c.translate(tw.sx, tw.sy)
    const r = tw.rangePx
    const g = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r)
    const col = tw.path === 2 ? '255,170,90' : tw.path === 3 ? '255,110,110' : '255,214,110'
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.8, `rgba(${col},0.07)`); g.addColorStop(1, `rgba(${col},0.17)`)
    c.fillStyle = g
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill()
    // 一圈慢慢往外擴的波紋:看得出光環「在作用」
    const wave = (t * 0.012) % 1
    c.strokeStyle = `rgba(${col},${0.35 * (1 - wave)})`
    c.lineWidth = 2
    c.beginPath(); c.arc(0, 0, r * (0.25 + 0.75 * wave), 0, Math.PI * 2); c.stroke()
    c.rotate(t * 0.012)
    c.strokeStyle = `rgba(${col},0.6)`
    c.lineWidth = 1.6
    c.setLineDash([10, 12])
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke()
    c.setLineDash([])
    c.fillStyle = `rgba(${col},0.85)`
    for (let i = 0; i < 8; i++) {      // 圈上八顆菱形的符文
      const a = (i / 8) * Math.PI * 2
      const x = Math.cos(a) * r, y = Math.sin(a) * r
      c.beginPath(); c.moveTo(x, y - 4.5); c.lineTo(x + 3, y); c.lineTo(x, y + 4.5); c.lineTo(x - 3, y); c.fill()
    }
    c.restore()
  }

  private drawRange(c: CanvasRenderingContext2D) {
    const i = this.selected >= 0 ? this.selected : this.hover
    if (i < 0) return
    const tw = this.towers[i]
    let x = 0, y = 0, r = 0
    if (tw) { r = tw.rangePx; x = tw.sx; y = tw.sy }
    else if (this.placing >= 0) { const s = this.cfg.slots[i] as number[]; x = s[0] ?? 0; y = s[1] ?? 0; r = this.placingRange }
    if (r <= 0 || (tw && tw.cls === 4)) return
    c.save()
    const g = c.createRadialGradient(x, y, r * 0.55, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0.13)')
    c.fillStyle = g
    c.strokeStyle = 'rgba(255,255,255,0.7)'
    c.lineWidth = 1.5
    c.setLineDash([6, 6])
    c.lineDashOffset = -this.clock * 14
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke()
    c.restore()
  }

  /**
   * 出手之後過了 at 個 tick,這個職業的身體該是什麼姿勢。每個職業動作不同:
   * 妖精拉弓放箭(不往前衝)、騎士舉劍劈下、法師舉杖浮起、黑妖衝上去刺。dir = 面向(右 1、左 -1)。
   */
  private pose(cls: number, at: number, dir: number) {
    const p = { attack: false, rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }
    if (at < 0 || at >= 8) return p
    if (cls === 0) {
      p.attack = at < 6.5
      if (at < 1.4) { const k = at / 1.4; p.rot = -0.07 * k * dir; p.dx = -3 * k * dir; p.sx = 1 - 0.04 * k }        // 拉滿
      else if (at < 2.6) { const k = (at - 1.4) / 1.2; p.rot = (-0.07 + 0.12 * k) * dir; p.dx = (-3 + 5 * k) * dir; p.sx = 0.96 + 0.1 * k }   // 放箭
      else { const k = (at - 2.6) / 5.4; p.rot = 0.05 * (1 - k) * dir; p.dx = 2 * (1 - k) * dir; p.sx = 1.06 - 0.06 * k }
    } else if (cls === 1) {
      if (at < 1.5) { const k = at / 1.5; p.rot = -0.42 * k * dir; p.dy = -4 * k; p.sy = 1 + 0.05 * k }                 // 舉劍,身體往後仰
      else if (at < 3) { const k = (at - 1.5) / 1.5; p.attack = true; p.rot = (-0.42 + 0.95 * k) * dir; p.dy = -4 * (1 - k); p.dx = 4 * k * dir; p.sx = 1.06 }   // 劈下去
      else { const k = (at - 3) / 5; p.attack = at < 4.6; p.rot = 0.53 * (1 - k) * (1 - k) * dir; p.dx = 4 * (1 - k) * dir }
    } else if (cls === 2) {
      p.attack = at < 6.5
      const k = Math.sin(Math.min(1, at / 6.5) * Math.PI)
      p.dy = -6 * k; p.sx = 1 + 0.05 * k; p.sy = 1 + 0.05 * k; p.rot = -0.05 * k * dir
    } else if (cls === 3) {
      if (at < 1) { const k = at; p.dx = -6 * k * dir; p.sx = 1 - 0.06 * k; p.rot = -0.1 * k * dir }                     // 壓低蓄力
      else if (at < 3) { const k = (at - 1) / 2; p.attack = true; p.dx = (-6 + 24 * k) * dir; p.rot = 0.16 * dir; p.sx = 1.08 }   // 衝出去
      else { const k = (at - 3) / 5; p.attack = at < 4.5; p.dx = 18 * (1 - k) * (1 - k) * dir; p.rot = 0.16 * (1 - k) * dir }
    }
    return p
  }

  private drawTower(c: CanvasRenderingContext2D, tw: TowerVis) {
    const t = this.fxTick
    const a = this.assets.cls[tw.cls]
    if (!a) return
    const dir = tw.faceLeft ? -1 : 1
    const at = t - tw.attackAt
    const ps = this.pose(tw.cls, at, dir)
    const img = ps.attack ? a.attack : a.idle
    const h = 84
    const w = (img.width / img.height) * h
    const born = Math.min(1, (t - tw.bornAt) / 6)
    const breathe = 1 + 0.028 * Math.sin(this.clock * 3.2 + tw.slot)
    // 原圖朝哪邊不一定,要翻成面向目標
    const faces = FACES_LEFT[tw.cls]
    const flip = tw.faceLeft !== (ps.attack ? faces?.attack : faces?.idle)

    // 滿級:腳下一團金光
    if (tw.level >= this.cfg.maxLevel && !tw.down) {
      c.save()
      c.globalCompositeOperation = 'lighter'
      glow(c, tw.x, tw.y - 2, 34, '#ffd76a', 0.3 + 0.12 * Math.sin(this.clock * 2.4 + tw.slot))
      c.restore()
    }
    // 黑妖衝出去的時候後面拖兩道殘影
    if (tw.cls === 3 && at >= 1 && at < 4.6) {
      for (let i = 2; i >= 1; i--) {
        const gp = this.pose(3, at - i * 0.55, dir)
        c.save()
        c.translate(tw.x + gp.dx, tw.y)
        c.globalAlpha = 0.3 / i
        c.rotate(gp.rot)
        c.scale((flip ? -1 : 1) * gp.sx, 1)
        c.drawImage(this.tintOf(img, '#ff5a7a'), -w / 2, -h, w, h)
        c.restore()
      }
    }
    c.save()
    c.translate(tw.x + ps.dx, tw.y + ps.dy)
    c.fillStyle = 'rgba(0,0,0,0.32)'
    c.beginPath(); c.ellipse(-ps.dx * 0.5, 2 - ps.dy, 24, 8, 0, 0, Math.PI * 2); c.fill()
    if (tw.down) {
      c.globalAlpha = 0.5
      c.rotate(tw.faceLeft ? -1.35 : 1.35)
      c.translate(0, 10)
    }
    c.rotate(ps.rot)
    c.scale((flip ? -1 : 1) * ps.sx * born, ps.sy * breathe * born)
    c.drawImage(img, -w / 2, -h, w, h)
    const hurt = t - tw.hurtAt
    if (hurt >= 0 && hurt < 3) {            // 騎士挨打:閃一下紅
      c.globalAlpha = (tw.down ? 0.5 : 1) * (1 - hurt / 3) * 0.6
      c.drawImage(this.tintOf(img, '#ff4a3a'), -w / 2, -h, w, h)
    }
    const up = t - tw.upAt
    if (up >= 0 && up < 10) {               // 重新站起來:整個人亮一下
      c.globalAlpha = (1 - up / 10) * 0.7
      c.drawImage(this.tintOf(img, '#fff3a8'), -w / 2, -h, w, h)
    }
    c.restore()

    c.save()
    c.globalCompositeOperation = 'lighter'
    if (tw.cls === 2 && at >= 0 && at < 5) {
      // 法師舉杖的時候杖頭聚一團光
      const k = Math.sin((at / 5) * Math.PI)
      const gx = tw.x + dir * 16, gy = tw.y - 78 + ps.dy
      glow(c, gx, gy, 26 * k, WIZ_COLOR[tw.path] ?? '#b78bff', 0.9 * k)
      glow(c, gx, gy, 10 * k, '#ffffff', k)
    } else if (tw.cls === 0 && at >= 0.3 && at < 1.6) {
      // 妖精拉滿弓:箭尖亮一點
      const k = (at - 0.3) / 1.3
      glow(c, tw.x + dir * 22, tw.y - 46, 5 + 5 * k, tw.path === 3 ? '#ff8a2a' : '#d8ff9a', 0.8 * k)
    } else if (tw.cls === 4) {
      // 君主:頭上的王冠一閃一閃
      const k = Math.max(0, Math.sin(this.clock * 2 + tw.slot)) ** 4
      glow(c, tw.x, tw.y - 82, 8 + 6 * k, '#ffe9a0', 0.25 + 0.6 * k)
    }
    c.restore()

    // 等級與路線
    c.save()
    c.translate(tw.x + 22, tw.y - 8)
    c.fillStyle = 'rgba(10,10,14,0.85)'
    c.strokeStyle = tw.path ? (CLS_COLOR[tw.cls] ?? '#fff') : 'rgba(255,255,255,0.5)'
    c.lineWidth = 1.6
    c.beginPath(); c.arc(0, 0, 9.5, 0, Math.PI * 2); c.fill(); c.stroke()
    c.fillStyle = tw.level >= this.cfg.maxLevel ? '#ffd76a' : '#fff'
    c.font = '600 11px Inter, sans-serif'
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(String(tw.level), 0, 0.5)
    c.restore()

    if (tw.cls === 1 && this.events && tw.kMax > 0 && !tw.down) this.bar(c, tw.x, tw.y - h - 8, 40, tw.kHp / tw.kMax, '#7fd0ff')
  }

  private mobHeight(m: MobVis) {
    if (m.rank === 2) return 118
    return (MOB_H[m.type] ?? 46) * (m.rank === 1 ? 1.4 : 1)
  }
  /** 怪身體中間的高度(飛的離地 30) */
  private mobMid(m: MobVis) {
    return m.y - (m.type === 4 && m.rank !== 2 ? 30 : 0) - this.mobHeight(m) / 2
  }

  private drawMob(c: CanvasRenderingContext2D, m: MobVis) {
    const t = this.fxTick
    const img = m.rank === 2 ? this.assets.bosses[this.bossKind] : this.assets.mobs[m.type]
    if (!img) return
    const h = this.mobHeight(m)
    const w = (img.width / img.height) * h
    const flying = m.type === 4 && m.rank !== 2
    const stunned = t < m.stunUntil && t >= m.stunFrom
    const slowed = t < m.slowUntil && t >= m.slowFrom
    const walk = m.moving && !stunned
    const step = Math.sin(t * (flying ? 0.25 : 0.5) + m.id)
    const bob = walk ? Math.abs(step) * (flying ? 6 : 3.2) : 0
    const tilt = walk ? Math.sin(t * 0.5 + m.id) * 0.05 : stunned ? Math.sin(t * 0.4 + m.id) * 0.08 : 0
    const lift = flying ? 30 : 0
    let alpha = 1, sx = Math.min(1, (t - m.bornAt) / 4), sy = sx, rise = 0, whiten = 0
    // 走路:踩下去扁一點、彈起來長一點
    if (walk && !flying) { const q = Math.abs(step); sx *= 1.04 - 0.06 * q; sy *= 0.96 + 0.07 * q }
    const flash = t - m.flashAt
    if (!m.gone && flash >= 0 && flash < 3) { const q = 1 - flash / 3; sx *= 1 + 0.12 * q; sy *= 1 - 0.1 * q }   // 被打到:縮一下
    if (m.gone) {
      const life = m.rank === 2 ? 20 : 9
      const p = Math.min(1, (t - m.goneAt) / life)
      if (m.leaked) { alpha = 1 - p; sx *= 1 - p * 0.6; sy *= 1 - p * 0.6 }
      else if (m.rank === 2) { alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3; whiten = p; sx *= 1 + p * 0.25; sy *= 1 + p * 0.25 }
      else { alpha = 1 - p * p; whiten = (1 - p) * 0.55; sx *= 1 + p * 0.35; sy *= 1 - p * 0.7; rise = p * 6 }
    }
    c.save()
    c.translate(m.x, m.y)
    c.globalAlpha = alpha * 0.3
    c.fillStyle = '#000'
    c.beginPath(); c.ellipse(0, 3, w * 0.34, w * 0.12, 0, 0, Math.PI * 2); c.fill()
    if (m.rank > 0 && !m.gone) {     // 精英、王:腳下一團兇光
      c.globalCompositeOperation = 'lighter'
      glow(c, 0, -4, w * (m.rank === 2 ? 0.62 : 0.58), m.rank === 2 ? '#ff8a2a' : '#ff4a3d', 0.4 + 0.15 * Math.sin(t * 0.3 + m.id))
      c.globalCompositeOperation = 'source-over'
    }
    c.globalAlpha = alpha
    const shiver = m.gone && m.rank === 2 && !m.leaked ? Math.sin(t * 4) * 3 : 0
    c.translate(shiver, -lift - bob - rise)
    c.rotate(tilt)
    c.scale(m.dir * sx, sy)
    c.drawImage(img, -w / 2, -h, w, h)
    if (!m.gone && slowed) {         // 緩速:整隻泛藍
      c.globalAlpha = alpha * 0.38
      c.drawImage(this.tintOf(img, '#6ac8ff'), -w / 2, -h, w, h)
    }
    if (!m.gone && t < m.poisonUntil) {       // 中毒:一陣一陣泛綠
      c.globalAlpha = alpha * (0.18 + 0.12 * Math.sin(t * 0.5 + m.id))
      c.drawImage(this.tintOf(img, '#6aff5a'), -w / 2, -h, w, h)
    }
    if (flash >= 0 && flash < 2.4) whiten = Math.max(whiten, (1 - flash / 2.4) * 0.72)   // 被打到:整隻閃白
    if (whiten > 0) {
      c.globalAlpha = alpha * whiten
      c.drawImage(this.tintOf(img, '#ffffff'), -w / 2, -h, w, h)
    }
    c.restore()

    if (m.gone) return
    const top = m.y - lift - bob - h
    if (slowed) {      // 緩速:腳下一圈冰
      c.save()
      c.globalAlpha = 0.6
      c.fillStyle = '#9fe8ff'
      c.beginPath(); c.ellipse(m.x, m.y + 2, w * 0.4, w * 0.14, 0, 0, Math.PI * 2); c.fill()
      c.strokeStyle = '#ffffff'; c.lineWidth = 1
      c.beginPath(); c.ellipse(m.x, m.y + 2, w * 0.4, w * 0.14, 0, 0, Math.PI * 2); c.stroke()
      c.restore()
    }
    if (stunned) {              // 暈眩:頭上轉星星
      c.save()
      c.fillStyle = '#ffe14d'
      c.strokeStyle = 'rgba(90,50,0,0.8)'; c.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        const a = t * 0.3 + (i * Math.PI * 2) / 3
        const x = m.x + Math.cos(a) * 14, y = top - 4 + Math.sin(a) * 4.5
        c.beginPath()
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 2.2 : 5, an = (k / 10) * Math.PI * 2 - Math.PI / 2
          if (k === 0) c.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r); else c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r)
        }
        c.closePath(); c.fill(); c.stroke()
      }
      c.restore()
    }
    if (m.rank !== 2 && m.hp < m.maxHp) this.bar(c, m.x, top - 7, m.rank === 1 ? 44 : 28, m.hp / m.maxHp, m.rank === 1 ? '#ff7a4d' : '#7dff8a')
  }

  /** 這張圖的單色剪影(閃白、泛藍、泛綠、殘影都用它疊) */
  private tintOf(img: HTMLImageElement, color: string): HTMLCanvasElement {
    const key = img.src + color
    let cv = this.tints.get(key)
    if (!cv) {
      cv = document.createElement('canvas')
      cv.width = img.width; cv.height = img.height
      const c = cv.getContext('2d') as CanvasRenderingContext2D
      c.drawImage(img, 0, 0)
      c.globalCompositeOperation = 'source-in'
      c.fillStyle = color
      c.fillRect(0, 0, cv.width, cv.height)
      this.tints.set(key, cv)
    }
    return cv
  }

  /** 女神像腳下:石壇上慢慢轉的符文圈 */
  private drawGoddessBase(c: CanvasRenderingContext2D) {
    const g = this.cfg.goddess
    const x = g[0] ?? 0, y = (g[1] ?? 0) + 36
    const hot = this.fxTick - this.reviveAt < 30
    c.save()
    c.translate(x, y); c.scale(1, 0.485)
    c.globalCompositeOperation = 'lighter'
    c.globalAlpha = hot ? 1 : 0.55 + 0.25 * Math.sin(this.clock * 1.6)
    c.strokeStyle = '#ffe9a0'; c.lineWidth = 2.4
    c.rotate(this.clock * 0.35)
    c.setLineDash([14, 9])
    c.beginPath(); c.arc(0, 0, 58, 0, Math.PI * 2); c.stroke()
    c.rotate(-this.clock * 0.7)
    c.setLineDash([4, 10]); c.lineWidth = 2
    c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.stroke()
    c.restore()
  }

  private drawGoddess(c: CanvasRenderingContext2D) {
    const t = this.fxTick
    const g = this.cfg.goddess
    const x = g[0] ?? 0, y = (g[1] ?? 0) + 40
    const img = this.assets.goddess
    const h = 124, w = (img.width / img.height) * h
    const hit = t - this.goddessHitAt
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 1.6)
    const hot = t - this.reviveAt < 30
    const ratio = Math.max(0, this.goddessHp / Math.max(1, this.goddessMax))
    c.save()
    c.translate(x, y)
    // 背後的聖光:一圈慢慢轉的光芒 + 光暈;快倒的時候轉成紅色
    c.save()
    c.globalCompositeOperation = 'lighter'
    const tone = ratio <= 0.3 ? '#ff6a4a' : '#fff0b8'
    c.translate(0, -h * 0.55)
    glow(c, 0, 0, 100, tone, hot ? 0.85 : 0.3 + pulse * 0.16)
    c.rotate(this.clock * 0.18)
    c.fillStyle = tone
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, len = i % 2 ? 78 : 104
      c.globalAlpha = (hot ? 0.3 : 0.1) + 0.05 * Math.sin(this.clock * 2 + i)
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - 0.09) * len, Math.sin(a - 0.09) * len); c.lineTo(Math.cos(a + 0.09) * len, Math.sin(a + 0.09) * len); c.fill()
    }
    c.restore()
    if (hit >= 0 && hit < 6) c.translate(Math.sin(hit * 4) * 3 * (1 - hit / 6), 0)
    c.drawImage(img, -w / 2, -h, w, h)
    if (hit >= 0 && hit < 5) {
      c.globalAlpha = 0.7 * (1 - hit / 5)
      c.drawImage(this.tintOf(img, '#ff6a5a'), -w / 2, -h, w, h)
    }
    c.restore()
    // 生命條
    const bw = 92, bx = x - bw / 2, by = y + 10
    c.save()
    c.fillStyle = 'rgba(0,0,0,0.7)'
    c.beginPath(); c.roundRect(bx - 2, by - 2, bw + 4, 11, 4); c.fill()
    const col = ratio > 0.5 ? '#ffe9a8' : ratio > 0.25 ? '#ffb347' : '#ff5a4a'
    const bg = c.createLinearGradient(0, by, 0, by + 7)
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.35, col); bg.addColorStop(1, col)
    c.fillStyle = bg
    if (ratio > 0) { c.beginPath(); c.roundRect(bx, by, bw * ratio, 7, 3); c.fill() }
    c.font = '600 12px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.lineWidth = 3; c.lineJoin = 'round'
    const label = `${Math.max(0, this.goddessHp)} / ${this.goddessMax}`
    c.strokeText(label, x, y + 26); c.fillText(label, x, y + 26)
    c.restore()
  }

  private bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number, color: string, h = 4) {
    const r = Math.max(0, Math.min(1, ratio))
    c.save()
    c.fillStyle = 'rgba(0,0,0,0.7)'
    c.beginPath(); c.roundRect(x - w / 2 - 1, y - 1, w + 2, h + 2, 2); c.fill()
    c.fillStyle = color
    c.fillRect(x - w / 2, y, w * r, h)
    c.fillStyle = 'rgba(255,255,255,0.4)'
    c.fillRect(x - w / 2, y, w * r, 1)
    c.restore()
  }

  private drawBossBar(c: CanvasRenderingContext2D) {
    let boss: MobVis | null = null
    for (const m of this.mobs.values()) if (m.rank === 2 && !m.gone) boss = m
    if (!boss) return
    const name = this.cfg.bosses[this.bossKind] ?? '王'
    const ratio = Math.max(0, boss.hp / boss.maxHp)
    // 白色那條慢慢追上來,看得出剛剛掉了多少
    this.bossLag = Math.max(ratio, this.bossLag - 0.004)
    c.save()
    const w = 440, x = W / 2, y = 30
    c.fillStyle = 'rgba(0,0,0,0.75)'
    c.beginPath(); c.roundRect(x - w / 2 - 4, y - 4, w + 8, 20, 6); c.fill()
    c.strokeStyle = '#c9a25a'; c.lineWidth = 1.5
    c.beginPath(); c.roundRect(x - w / 2 - 4, y - 4, w + 8, 20, 6); c.stroke()
    c.fillStyle = 'rgba(255,255,255,0.85)'
    c.fillRect(x - w / 2, y, w * this.bossLag, 12)
    const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
    g.addColorStop(0, '#d4241a'); g.addColorStop(1, '#ffb347')
    c.fillStyle = g
    c.fillRect(x - w / 2, y, w * ratio, 12)
    c.fillStyle = 'rgba(255,255,255,0.3)'
    c.fillRect(x - w / 2, y, w * ratio, 3)
    c.font = "700 15px 'Noto Sans TC', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.fillStyle = '#fff3cf'
    c.strokeText(name, x, y - 14); c.fillText(name, x, y - 14)
    c.font = '600 10px Inter, sans-serif'
    c.lineWidth = 3
    const pct = Math.ceil(ratio * 100) + '%'
    c.strokeText(pct, x, y + 6.5); c.fillStyle = '#fff'; c.fillText(pct, x, y + 6.5)
    c.restore()
  }

  // ===================== 小工具 =====================

  private shake(amp: number) { this.shakeAt = this.fxTick; this.shakeAmp = amp }
  /** 等招式到了才晃(火風暴炸開那一下) */
  private shakeLater(amp: number, delay: number) {
    if (this.fxTick - this.shakeAt < 8 && this.shakeAmp > amp) return
    this.shakeAt = this.fxTick + delay; this.shakeAmp = amp
  }

  // ===================== 座標與滑鼠 =====================

  /** 沿路線走了 pos(後端的單位)之後在畫面上的位置 */
  private posXY(pos: number): [number, number] {
    const path = this.cfg.path
    let start = 0
    const p = Math.max(0, Math.min(this.length, pos))
    for (let i = 0; i < this.segEnd.length; i++) {
      const end = this.segEnd[i] ?? 0
      if (p <= end || i === this.segEnd.length - 1) {
        const a = path[i] as number[], b = path[i + 1] as number[]
        const k = end === start ? 0 : (p - start) / (end - start)
        return [(a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * k, (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * k]
      }
      start = end
    }
    const last = path[path.length - 1] as number[]
    return [last[0] ?? 0, last[1] ?? 0]
  }

  private slotAt(ev: MouseEvent): number {
    const r = this.canvas.getBoundingClientRect()
    const x = ((ev.clientX - r.left) / r.width) * W, y = ((ev.clientY - r.top) / r.height) * VH - TOP
    // 手機上地圖縮得很小:點擊範圍至少留 24 個實際像素的半徑,手指才點得到
    const reach = Math.max(46, (24 * W) / r.width)
    let best = -1, bestD = reach * reach
    this.cfg.slots.forEach((s, i) => {
      const tw = this.towers[i]
      // 人站著的地方和石台本身都可以點
      const pts: [number, number][] = [[s[0] ?? 0, (s[1] ?? 0) - 18]]
      if (tw) pts.push([tw.x, tw.y - 36])
      for (const [px, py] of pts) {
        const d = (px - x) * (px - x) + (py - y) * (py - y)
        if (d < bestD) { bestD = d; best = i }
      }
    })
    return best
  }

  private onClick = (ev: MouseEvent) => {
    if (this.events) return
    const i = this.slotAt(ev)
    if (i >= 0) this.onSlot(i)
  }
  private onMove = (ev: MouseEvent) => {
    this.hover = this.events ? -1 : this.slotAt(ev)
    this.canvas.style.cursor = this.hover >= 0 ? 'pointer' : 'default'
  }
  private onLeave = () => { this.hover = -1 }
  /** 回到前景:底圖、光暈、剪影快取全部作廢重畫 */
  private onVisible = () => {
    if (document.visibilityState === 'hidden') return
    this.releaseTerrain()
    this.tints.clear()
    clearGlowCache()
    this.last = performance.now()   // 在背景停了多久不算進動畫
  }
  /** 畫布被瀏覽器丟掉:先降畫質;一秒內沒還回來(contextrestored)就直接換一張新畫布 */
  private onContextLost = (e: Event) => {
    e.preventDefault()
    if (!this.lowQ) this.setQuality(true, performance.now())
    const lost = this.canvas
    window.setTimeout(() => {
      if (this.destroyed || this.canvas !== lost) return
      const ctx = this.ctx as CanvasRenderingContext2D & { isContextLost?: () => boolean }
      if (!ctx.isContextLost || ctx.isContextLost()) this.replaceCanvas('contextlost')
    }, 1000)
  }
}
