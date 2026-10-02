// 天堂塔防的畫面:地圖、塔、怪、女神像、特效,全部畫在一張 Canvas 上。
//
// 這裡只負責「把後端算好的結果演出來」:打一波時後端回傳事件序列(誰在第幾個 tick 出場、走到哪、被誰打、扣多少血),
// 這個檔照時間軸播放。傷害、機率、勝負都不在這裡算 —— 改這個檔只會改變畫面,改不了成績。
import { EV, HIT_FLAG, KNIGHT, STATUS, type RunView, type TdConfig, type TowerView } from './api'

const ASSET = '/aegis/td/'
const W = 1000
const H = 600

export interface SceneAssets {
  cls: { idle: HTMLImageElement; attack: HTMLImageElement }[]
  mobs: HTMLImageElement[]
  bosses: HTMLImageElement[]
  goddess: HTMLImageElement
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
  return { cls, mobs, bosses, goddess }
}

// 每個場景的配色:[地表深, 地表淺, 路, 路邊, 點綴]
const THEMES: [string, string, string, string, string][] = [
  ['#2f5a34', '#47793f', '#c2a26b', '#7a6238', '#6fae58'],   // 說話之島
  ['#34562b', '#54783a', '#b8996a', '#6f5a36', '#8fb04d'],   // 古魯丁
  ['#5b5f2c', '#7d8038', '#cdb076', '#80693a', '#c9b24a'],   // 風木
  ['#4a4f47', '#676c60', '#a39884', '#5c5548', '#8d9a8a'],   // 奇岩
  ['#245a5c', '#35807b', '#d2c69c', '#7d7350', '#6fc7b6'],   // 海音
  ['#4b2a22', '#6e4032', '#93705a', '#4f3a2e', '#d2683c'],   // 龍之谷
  ['#7d92a0', '#a9bcc7', '#e2e7ea', '#93a3ad', '#ffffff'],   // 歐瑞
]

// 職業的代表色(特效、徽章用):妖精、騎士、法師、黑妖、君主
const CLS_COLOR = ['#8fe06a', '#cfd8e6', '#b78bff', '#ff5a7a', '#ffd35a']
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
  kHp: number; kMax: number; down: boolean; upAt: number
  bornAt: number
}
interface MobVis {
  id: number; type: number; rank: number; hp: number; maxHp: number
  keyPos: number; keyTick: number; v: number
  x: number; y: number; dir: number; moving: boolean
  flashAt: number; slowUntil: number; stunUntil: number; poisonUntil: number
  gone: boolean; goneAt: number; leaked: boolean; bornAt: number
}
interface Particle { x: number; y: number; vx: number; vy: number; born: number; life: number; size: number; color: string; g: number; kind: number }
interface FloatText { x: number; y: number; text: string; color: string; size: number; born: number; life: number; vy: number }
interface Fx { kind: 'arrow' | 'orb' | 'ring' | 'bolt' | 'slash' | 'stab' | 'cleave' | 'wave'; born: number; life: number; x0: number; y0: number; x1: number; y1: number; color: string; r: number; pts?: number[] }

export class TdScene {
  private ctx: CanvasRenderingContext2D
  private bg: HTMLCanvasElement | null = null
  private bgKey = ''
  private white = new Map<HTMLImageElement, HTMLCanvasElement>()
  private segEnd: number[] = []
  private length = 0
  private raf = 0
  private last = 0
  private destroyed = false

  private towers: (TowerVis | null)[] = []
  private mobs = new Map<number, MobVis>()
  private parts: Particle[] = []
  private floats: FloatText[] = []
  private fx: Fx[] = []

  /** 畫面效果用的時鐘(一直往前走) */
  private fxTick = 0
  /** 戰鬥播放到第幾個 tick */
  private playTick = 0
  private events: number[][] | null = null
  private evIdx = 0
  private ended = false
  private endedAt = 0
  private done: (() => void) | null = null
  private lastCast = new Map<number, { tick: number; kind: number; first: boolean; px: number; py: number; pts: number[] }>()

  private chapter = 0
  private wave = 1
  private goddessHp = 20
  private goddessMax = 20
  private goddessHitAt = -999
  private reviveAt = -999
  private shakeAt = -999
  private shakeAmp = 0

  speed = 1
  selected = -1
  hover = -1
  /** 正在挑位置放哪個職業(-1 = 沒有);會把空位標亮並預覽射程 */
  placing = -1
  placingRange = 0
  onSlot: (slot: number) => void = () => {}

  constructor(private canvas: HTMLCanvasElement, private cfg: TdConfig, private assets: SceneAssets) {
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    let acc = 0
    for (let i = 0; i < cfg.path.length - 1; i++) {
      const a = cfg.path[i] as number[], b = cfg.path[i + 1] as number[]
      acc += (Math.abs((b[0] ?? 0) - (a[0] ?? 0)) + Math.abs((b[1] ?? 0) - (a[1] ?? 0))) * cfg.unit
      this.segEnd.push(acc)
    }
    this.length = acc
    canvas.addEventListener('click', this.onClick)
    canvas.addEventListener('mousemove', this.onMove)
    canvas.addEventListener('mouseleave', this.onLeave)
    this.resize()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('click', this.onClick)
    this.canvas.removeEventListener('mousemove', this.onMove)
    this.canvas.removeEventListener('mouseleave', this.onLeave)
    this.done?.()
  }

  /** 畫布大小跟著外框走(外框維持 5:3) */
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cw = Math.max(320, this.canvas.clientWidth)
    this.canvas.width = Math.round(cw * dpr)
    this.canvas.height = Math.round((cw * H) / W * dpr)
    this.bgKey = ''
  }

  // ===================== 布置階段:把後端給的局面擺出來 =====================

  setRun(run: RunView) {
    this.wave = run.wave
    this.chapter = Math.floor((run.wave - 1) / 10) % THEMES.length
    this.goddessHp = run.goddessHp
    this.goddessMax = run.goddessMax
    const prev = this.towers
    this.towers = run.towers.map((t, i) => (t ? this.makeTower(i, t, prev[i] ?? null) : null))
    if (!this.events) {
      this.mobs.clear()
    }
  }

  private makeTower(slot: number, t: TowerView, old: TowerVis | null): TowerVis {
    const cls = ['ELF', 'KNIGHT', 'WIZARD', 'DARKELF', 'PRINCE'].indexOf(t.cls)
    const s = this.cfg.slots[slot] as number[]
    const sx = s[0] ?? 0, sy = s[1] ?? 0
    const x = sx, y = sy
    const guards = (t.guards ?? []).map((g) => this.posXY(g))
    const same = old && old.cls === cls
    if (!same) this.burst(x, y - 30, CLS_COLOR[cls] ?? '#fff', 18)                     // 新蓋的塔:冒一圈光
    else if (old.level !== t.level || old.path !== t.path) this.levelUp(x, y, cls)       // 升級 / 選路線
    return {
      slot, cls, level: t.level, path: t.path, sx, sy, x, y, guards, rangePx: t.rangePx,
      attackAt: same ? old.attackAt : -999, faceLeft: same ? old.faceLeft : false,
      kHp: t.hp, kMax: t.hp, down: false, upAt: -999, bornAt: same ? old.bornAt : this.fxTick,
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
    for (const t of this.towers) if (t) { t.down = false; t.kHp = t.kMax; t.attackAt = -999 }
    return new Promise((resolve) => { this.done = resolve })
  }

  get playing() { return this.events !== null }

  /** 不想看了:直接跳到結果 */
  skip() {
    if (!this.events) return
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
    this.advance(dt)
    this.raf = requestAnimationFrame(this.frame)
  }

  /** 往前走 dt 秒並重畫一次(平常由瀏覽器每一格呼叫) */
  advance(dt: number) {
    const tps = this.cfg.tps
    this.fxTick += dt * tps * (this.events ? this.speed : 1)
    if (this.events) {
      if (!this.ended) {
        this.playTick += dt * tps * this.speed
        while (this.evIdx < this.events.length && ((this.events[this.evIdx] as number[])[1] ?? 0) <= this.playTick) {
          this.apply(this.events[this.evIdx++] as number[], false)
        }
      } else if (this.fxTick - this.endedAt > 14) {
        this.finish()   // 最後一下的特效播完再收
      }
    }
    this.update()
    this.draw()
  }

  private apply(e: number[], silent: boolean) {
    const t = this.fxTick
    switch (e[0]) {
      case EV.SPAWN: {
        const [x, y] = this.posXY(0)
        this.mobs.set(e[2] ?? 0, {
          id: e[2] ?? 0, type: e[3] ?? 0, rank: e[4] ?? 0, hp: e[5] ?? 1, maxHp: e[5] ?? 1,
          keyPos: 0, keyTick: e[1] ?? 0, v: 0, x, y, dir: 1, moving: false,
          flashAt: -99, slowUntil: -99, stunUntil: -99, poisonUntil: -99, gone: false, goneAt: 0, leaked: false, bornAt: t,
        })
        if (e[4] === 2 && !silent) this.shake(7)
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
        if (tw) {
          tw.attackAt = t
          if (m) tw.faceLeft = m.x < tw.x
          this.lastCast.set(tw.slot, { tick: e[1] ?? 0, kind: e[3] ?? 0, first: true, px: tw.x, py: tw.y - 44, pts: [] })
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
        if (e[3] === STATUS.SLOW) m.slowUntil = t + (e[4] ?? 0)
        if (e[3] === STATUS.STUN) m.stunUntil = t + (e[4] ?? 0)
        if (e[3] === STATUS.POISON) m.poisonUntil = t + (e[4] ?? 0)
        break
      }
      case EV.DIE: {
        const m = this.mobs.get(e[2] ?? -1)
        if (!m) break
        m.gone = true; m.goneAt = t; m.hp = 0
        if (silent) break
        this.float(m.x, m.y - this.mobHeight(m) - 6, '+' + (e[3] ?? 0), '#ffd76a', 13, 22)
        this.burst(m.x, m.y - this.mobHeight(m) / 2, m.rank === 2 ? '#ffb347' : '#fff4c7', m.rank === 2 ? 60 : m.rank === 1 ? 22 : 9)
        if (m.rank === 2) this.shake(12)
        break
      }
      case EV.LEAK: {
        const m = this.mobs.get(e[2] ?? -1)
        if (m) { m.gone = true; m.goneAt = t; m.leaked = true }
        this.goddessHp = e[4] ?? 0
        if (silent) break
        const g = this.cfg.goddess
        if ((e[3] ?? 0) > 0) {
          this.goddessHitAt = t
          this.float(g[0] ?? 0, (g[1] ?? 0) - 120, '-' + e[3], '#ff5a4a', 22, 30)
          this.burst(g[0] ?? 0, (g[1] ?? 0) - 50, '#ff5a4a', 16)
          this.shake(e[3] === 10 ? 14 : 5)
        } else {
          this.float(g[0] ?? 0, (g[1] ?? 0) - 120, '結界擋下', '#9fe8ff', 14, 30)
        }
        break
      }
      case EV.KNIGHT: {
        const tw = this.towers[e[2] ?? -1]
        if (!tw) break
        tw.kHp = e[3] ?? 0
        if (!silent && e[4] === KNIGHT.HIT) this.fx.push({ kind: 'slash', born: t, life: 4, x0: tw.x, y0: tw.y - 42, x1: 0, y1: 0, color: '#ff6a5a', r: 18 })   // 被怪抓了一下
        if (e[4] === KNIGHT.DOWN) { tw.down = true; if (!silent) this.float(tw.x, tw.y - 80, '倒下', '#ff8f7a', 14, 30) }
        if (e[4] === KNIGHT.UP) { tw.down = false; tw.upAt = t; tw.kHp = tw.kMax; if (!silent) this.levelUp(tw.x, tw.y, 1) }
        break
      }
      case EV.REVIVE: {
        this.goddessHp = e[2] ?? 0
        this.reviveAt = t
        if (!silent) {
          const g = this.cfg.goddess
          this.float(g[0] ?? 0, (g[1] ?? 0) - 140, '起死回生', '#fff3a8', 20, 44)
          this.burst(g[0] ?? 0, (g[1] ?? 0) - 60, '#fff3a8', 70)
        }
        break
      }
      case EV.END:
        this.ended = true
        this.endedAt = t
        break
    }
  }

  /**
   * 一下命中的特效:依出手的職業與路線畫箭、火球、閃電、刀光,再跳傷害數字。
   * 出手到命中有一點時間差(拉弓放箭、舉劍劈下、法球飛過去),閃白和數字等招式「到」了才出現。
   */
  private hitFx(slot: number, m: MobVis, dmg: number, flags: number) {
    const t = this.fxTick
    const my = m.y - this.mobHeight(m) / 2
    const tw = this.towers[slot]
    const cast = this.lastCast.get(slot)
    if (flags & HIT_FLAG.POISON) {
      m.flashAt = t
      this.float(m.x + 8, my - 10, String(dmg), '#8ff06a', 11, 18)
      this.bubble(m.x, my, '#8ff06a', 3)
      return
    }
    if (flags & HIT_FLAG.REFLECT) {
      m.flashAt = t
      this.fx.push({ kind: 'slash', born: t, life: 5, x0: m.x, y0: my, x1: m.x, y1: my, color: '#dfe8ff', r: 16 })
      this.float(m.x, my - 14, String(dmg), '#dfe8ff', 11, 18)
      return
    }
    const crit = (flags & HIT_FLAG.CRIT) !== 0
    const brave = (flags & HIT_FLAG.BRAVE) !== 0
    let delay = 0
    if (tw && cast) {
      const cls = Math.floor(cast.kind / 10), path = cast.kind % 10
      const color = CLS_COLOR[cls] ?? '#fff'
      const dir = tw.faceLeft ? -1 : 1
      if (cls === 0) {          // 妖精:拉弓、放箭,箭飛過去
        delay = 4.4
        this.fx.push({ kind: 'arrow', born: t + 1.4, life: 3, x0: tw.x + dir * 20, y0: tw.y - 46, x1: m.x, y1: my, color: path === 3 ? '#ff9b3d' : '#e9ffd0', r: 0 })
        if (path === 3 && crit) this.burstLater(m.x, my, '#ff8a2a', 14, delay, 1)
      } else if (cls === 1) {   // 騎士:舉劍劈下,刀光掃過身前,劍氣飛到路上的怪身上
        delay = 4.4
        if (cast.first) this.fx.push({ kind: 'cleave', born: t + 1.5, life: 4.5, x0: tw.x + dir * 14, y0: tw.y - 40, x1: dir, y1: 0, color: '#ffffff', r: 56 })
        this.fx.push({ kind: 'wave', born: t + 2.2, life: 2.2, x0: tw.x + dir * 40, y0: tw.y - 40, x1: m.x, y1: my, color: '#dff1ff', r: 20 })
        this.burstLater(m.x, my, '#fff6d8', 9, delay, 1)
      } else if (cls === 2) {
        if (path === 3) {       // 極光雷電:從上一個命中點連到這一個
          delay = 1.5
          this.fx.push({ kind: 'bolt', born: t + delay, life: 5, x0: cast.px, y0: cast.py, x1: m.x, y1: my, color: '#cfe4ff', r: 0, pts: jag(cast.px, cast.py, m.x, my) })
          cast.px = m.x; cast.py = my
          this.burstLater(m.x, my, '#bcd8ff', 5, delay, 1)
        } else {                // 範圍魔法:法球飛到主目標,再炸開
          delay = 4.6
          if (cast.first) {
            const ice = path === 2
            const r = path === 1 ? 91 : 70
            this.fx.push({ kind: 'orb', born: t + 1.6, life: 3, x0: tw.x + dir * 16, y0: tw.y - 74, x1: m.x, y1: my, color: ice ? '#9fe8ff' : '#ff8a3d', r: 7 })
            this.fx.push({ kind: 'ring', born: t + delay, life: 8, x0: m.x, y0: m.y - 6, x1: 0, y1: 0, color: ice ? '#9fe8ff' : '#ff8a3d', r })
            this.burstLater(m.x, m.y - 14, ice ? '#d6f6ff' : '#ffb25a', path === 1 ? 34 : 22, delay, ice ? 2 : 1)
          }
        }
      } else if (cls === 3) {   // 黑妖:衝上去兩刀
        delay = 2
        this.fx.push({ kind: 'stab', born: t + delay, life: 5, x0: m.x, y0: my, x1: m.x, y1: my, color, r: 22 })
        if (path === 2) this.bubble(m.x, my, '#8ff06a', 5)
      }
      cast.first = false
    }
    m.flashAt = t + delay
    const big = crit || brave
    this.float(m.x + (Math.random() * 16 - 8), my - 12, String(dmg) + (crit ? '!' : ''), crit ? '#ffe14d' : brave ? '#ffab4d' : '#ffffff', big ? 17 : 12, big ? 26 : 18, delay)
  }

  // ===================== 每一格:更新位置 =====================

  private update() {
    const t = this.fxTick
    for (const m of this.mobs.values()) {
      if (m.gone) continue
      const pos = Math.min(this.length, m.keyPos + m.v * Math.max(0, this.playTick - m.keyTick))
      const [x, y] = this.posXY(pos)
      if (Math.abs(x - m.x) > 0.01) m.dir = x > m.x ? 1 : -1
      m.moving = m.v > 0
      m.x = x; m.y = y
      if (t < m.poisonUntil && Math.random() < 0.06) this.bubble(m.x, m.y - this.mobHeight(m) / 2, '#8ff06a', 1)
    }
    for (const [id, m] of this.mobs) if (m.gone && t - m.goneAt > 12) this.mobs.delete(id)
    this.parts = this.parts.filter((p) => t - p.born < p.life)
    this.floats = this.floats.filter((f) => t - f.born < f.life)
    this.fx = this.fx.filter((f) => t - f.born < f.life)
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900)
    if (this.floats.length > 90) this.floats.splice(0, this.floats.length - 90)
  }

  // ===================== 畫 =====================

  private draw() {
    const c = this.ctx
    const k = this.canvas.width / W
    const t = this.fxTick
    c.setTransform(k, 0, 0, k, 0, 0)
    const sh = t - this.shakeAt < 8 ? this.shakeAmp * (1 - (t - this.shakeAt) / 8) : 0
    if (sh > 0.1) c.translate(Math.sin(t * 5.1) * sh, Math.cos(t * 6.7) * sh)
    this.drawBackground(c)

    // 塔位底座 + 君主光環 + 射程
    for (let i = 0; i < this.cfg.slots.length; i++) this.drawSlot(c, i)
    for (const tw of this.towers) if (tw && tw.cls === 4) this.drawAura(c, tw)
    this.drawRange(c)

    // 人、怪、女神像照 y 由遠到近畫
    const items: { y: number; fn: () => void }[] = []
    for (const tw of this.towers) if (tw) items.push({ y: tw.y, fn: () => this.drawTower(c, tw) })
    for (const m of this.mobs.values()) items.push({ y: m.y + (m.type === 4 ? 30 : 0), fn: () => this.drawMob(c, m) })
    items.push({ y: this.cfg.goddess[1] ?? 0, fn: () => this.drawGoddess(c) })
    items.sort((a, b) => a.y - b.y)
    for (const it of items) it.fn()

    this.drawFx(c)
    this.drawParticles(c)
    this.drawFloats(c)
    this.drawBossBar(c)
  }

  private drawBackground(c: CanvasRenderingContext2D) {
    const key = this.chapter + ':' + this.canvas.width
    if (this.bgKey !== key || !this.bg) {
      this.bg = this.renderBackground()
      this.bgKey = key
    }
    c.drawImage(this.bg, 0, 0, W, H)
  }

  private renderBackground(): HTMLCanvasElement {
    const cv = document.createElement('canvas')
    cv.width = this.canvas.width
    cv.height = this.canvas.height
    const c = cv.getContext('2d') as CanvasRenderingContext2D
    c.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0)
    const th = THEMES[this.chapter] ?? THEMES[0]
    const [deep, light, road, edge, dot] = th as [string, string, string, string, string]
    const g = c.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, light)
    g.addColorStop(1, deep)
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
    // 地表的斑點與草叢(位置用固定的假亂數,同一個場景每次長一樣)
    let seed = 1234567 + this.chapter * 7919
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W, y = rnd() * H, r = 6 + rnd() * 26
      c.globalAlpha = 0.05 + rnd() * 0.06
      c.fillStyle = rnd() > 0.5 ? '#000' : '#fff'
      c.beginPath(); c.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2); c.fill()
    }
    c.globalAlpha = 1
    // 路
    const line = (w: number, color: string, dash?: number[]) => {
      c.strokeStyle = color; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'
      c.setLineDash(dash ?? [])
      c.beginPath()
      this.cfg.path.forEach((p, i) => (i === 0 ? c.moveTo((p[0] ?? 0) - 30, p[1] ?? 0) : c.lineTo(p[0] ?? 0, p[1] ?? 0)))
      c.stroke()
      c.setLineDash([])
    }
    line(62, 'rgba(0,0,0,0.28)')
    line(54, edge)
    line(46, road)
    c.globalAlpha = 0.18
    line(40, '#fff', [2, 26])
    c.globalAlpha = 1
    // 草叢 / 石頭點綴,不畫在路上
    for (let i = 0; i < 150; i++) {
      const x = rnd() * W, y = rnd() * H
      if (this.nearPath(x, y, 44)) continue
      c.fillStyle = dot
      c.globalAlpha = 0.5 + rnd() * 0.4
      const s = 3 + rnd() * 4
      c.beginPath()
      c.moveTo(x - s, y); c.lineTo(x - s / 2, y - s * 2); c.lineTo(x, y); c.lineTo(x + s / 2, y - s * 2.4); c.lineTo(x + s, y)
      c.fill()
    }
    c.globalAlpha = 1
    // 入口
    const p0 = this.cfg.path[0] as number[]
    const eg = c.createRadialGradient(0, p0[1] ?? 0, 4, 0, p0[1] ?? 0, 60)
    eg.addColorStop(0, 'rgba(0,0,0,0.85)'); eg.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = eg
    c.fillRect(0, (p0[1] ?? 0) - 60, 70, 120)
    // 四周壓暗
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95)
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)')
    c.fillStyle = v
    c.fillRect(0, 0, W, H)
    return cv
  }

  private nearPath(x: number, y: number, d: number) {
    for (let i = 0; i < this.cfg.path.length - 1; i++) {
      const a = this.cfg.path[i] as number[], b = this.cfg.path[i + 1] as number[]
      const x0 = Math.min(a[0] ?? 0, b[0] ?? 0) - d, x1 = Math.max(a[0] ?? 0, b[0] ?? 0) + d
      const y0 = Math.min(a[1] ?? 0, b[1] ?? 0) - d, y1 = Math.max(a[1] ?? 0, b[1] ?? 0) + d
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true
    }
    return false
  }

  private drawSlot(c: CanvasRenderingContext2D, i: number) {
    const s = this.cfg.slots[i] as number[]
    const x = s[0] ?? 0, y = s[1] ?? 0
    const tw = this.towers[i]
    const t = this.fxTick
    const hot = this.hover === i || this.selected === i
    c.save()
    c.translate(x, y)
    // 石台
    c.fillStyle = 'rgba(0,0,0,0.35)'
    c.beginPath(); c.ellipse(0, 6, 30, 13, 0, 0, Math.PI * 2); c.fill()
    const g = c.createLinearGradient(0, -10, 0, 10)
    g.addColorStop(0, hot ? '#f0e2b8' : '#b9b2a0'); g.addColorStop(1, hot ? '#a08a52' : '#6f6a5e')
    c.fillStyle = g
    c.beginPath(); c.ellipse(0, 0, 27, 11, 0, 0, Math.PI * 2); c.fill()
    c.strokeStyle = this.selected === i ? '#ffd76a' : 'rgba(0,0,0,0.45)'
    c.lineWidth = this.selected === i ? 2.5 : 1.2
    c.stroke()
    if (!tw) {
      const pulse = this.placing >= 0 ? 0.55 + 0.45 * Math.sin(t * 0.35 + i) : 0.5
      c.globalAlpha = hot ? 1 : pulse
      c.strokeStyle = this.placing >= 0 ? '#ffd76a' : '#ffffff'
      c.lineWidth = 2.4
      c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.moveTo(0, -4); c.lineTo(0, 4); c.stroke()
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
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.8, `rgba(${col},0.07)`); g.addColorStop(1, `rgba(${col},0.16)`)
    c.fillStyle = g
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill()
    c.rotate(t * 0.012)
    c.strokeStyle = `rgba(${col},0.55)`
    c.lineWidth = 1.6
    c.setLineDash([10, 12])
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke()
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
    c.fillStyle = 'rgba(255,255,255,0.07)'
    c.strokeStyle = 'rgba(255,255,255,0.55)'
    c.lineWidth = 1.5
    c.setLineDash([6, 6])
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
    const ps = this.pose(tw.cls, t - tw.attackAt, dir)
    const img = ps.attack ? a.attack : a.idle
    const h = 84
    const w = (img.width / img.height) * h
    const born = Math.min(1, (t - tw.bornAt) / 6)
    const breathe = 1 + 0.028 * Math.sin(t * 0.16 + tw.slot)
    // 原圖朝哪邊不一定,要翻成面向目標
    const faces = FACES_LEFT[tw.cls]
    const flip = tw.faceLeft !== (ps.attack ? faces?.attack : faces?.idle)
    c.save()
    c.translate(tw.x + ps.dx, tw.y + ps.dy)
    c.fillStyle = 'rgba(0,0,0,0.32)'
    c.beginPath(); c.ellipse(-ps.dx * 0.5, 2 - ps.dy, 24, 8, 0, 0, Math.PI * 2); c.fill()
    if (tw.down) {
      c.globalAlpha = 0.5
      c.rotate(tw.faceLeft ? -1.35 : 1.35)
      c.translate(0, 10)
    }
    if (t - tw.upAt < 10) { c.shadowColor = '#fff3a8'; c.shadowBlur = 24 * (1 - (t - tw.upAt) / 10) }
    c.rotate(ps.rot)
    c.scale((flip ? -1 : 1) * ps.sx * born, ps.sy * breathe * born)
    c.drawImage(img, -w / 2, -h, w, h)
    c.restore()

    // 法師舉杖的時候杖頭亮一下
    const at = t - tw.attackAt
    if (tw.cls === 2 && at >= 0 && at < 5) {
      const k = Math.sin((at / 5) * Math.PI)
      c.save()
      const gx = tw.x + dir * 16, gy = tw.y - 76 + ps.dy
      const g = c.createRadialGradient(gx, gy, 1, gx, gy, 20)
      g.addColorStop(0, 'rgba(255,255,255,' + 0.9 * k + ')'); g.addColorStop(0.4, 'rgba(183,139,255,' + 0.6 * k + ')'); g.addColorStop(1, 'rgba(183,139,255,0)')
      c.fillStyle = g
      c.beginPath(); c.arc(gx, gy, 20, 0, Math.PI * 2); c.fill()
      c.restore()
    }

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

  private drawMob(c: CanvasRenderingContext2D, m: MobVis) {
    const t = this.fxTick
    const img = m.rank === 2 ? this.assets.bosses[this.chapter % this.assets.bosses.length] : this.assets.mobs[m.type]
    if (!img) return
    const h = this.mobHeight(m)
    const w = (img.width / img.height) * h
    const flying = m.type === 4 && m.rank !== 2
    const stunned = t < m.stunUntil
    const walk = m.moving && !stunned
    const bob = walk ? Math.abs(Math.sin(t * (flying ? 0.25 : 0.5) + m.id)) * (flying ? 6 : 3.2) : 0
    const tilt = walk ? Math.sin(t * 0.5 + m.id) * 0.05 : 0
    const lift = flying ? 30 : 0
    let alpha = 1, scale = Math.min(1, (t - m.bornAt) / 4)
    if (m.gone) {
      const p = Math.min(1, (t - m.goneAt) / 10)
      alpha = 1 - p
      scale = m.leaked ? 1 - p * 0.6 : 1 + p * 0.25
    }
    c.save()
    c.translate(m.x, m.y)
    c.globalAlpha = alpha * 0.3
    c.fillStyle = '#000'
    c.beginPath(); c.ellipse(0, 3, w * 0.34, w * 0.12, 0, 0, Math.PI * 2); c.fill()
    c.globalAlpha = alpha
    if (m.rank === 1) { c.shadowColor = '#ff4a3d'; c.shadowBlur = 14 }
    if (m.rank === 2) { c.shadowColor = '#ffb347'; c.shadowBlur = 22 }
    c.translate(0, -lift - bob - (m.gone && !m.leaked ? (t - m.goneAt) * 1.4 : 0))
    c.rotate(tilt)
    c.scale(m.dir * scale, scale)
    c.drawImage(img, -w / 2, -h, w, h)
    c.shadowBlur = 0
    const flash = t - m.flashAt
    if (flash >= 0 && flash < 2.4) {       // 被打到:整隻閃白
      c.globalAlpha = alpha * (1 - flash / 2.4) * 0.85
      c.drawImage(this.whiteOf(img), -w / 2, -h, w, h)
    }
    c.restore()

    if (m.gone) return
    const top = m.y - lift - bob - h
    if (t < m.slowUntil) {      // 緩速:腳下一圈冰
      c.save()
      c.globalAlpha = 0.55
      c.fillStyle = '#9fe8ff'
      c.beginPath(); c.ellipse(m.x, m.y + 2, w * 0.4, w * 0.14, 0, 0, Math.PI * 2); c.fill()
      c.restore()
    }
    if (stunned) {              // 暈眩:頭上轉星星
      c.save()
      c.fillStyle = '#ffe14d'
      c.font = '13px sans-serif'; c.textAlign = 'center'
      for (let i = 0; i < 3; i++) {
        const a = t * 0.3 + (i * Math.PI * 2) / 3
        c.fillText('★', m.x + Math.cos(a) * 13, top - 2 + Math.sin(a) * 4)
      }
      c.restore()
    }
    if (m.rank !== 2 && m.hp < m.maxHp) this.bar(c, m.x, top - 7, m.rank === 1 ? 44 : 28, m.hp / m.maxHp, m.rank === 1 ? '#ff7a4d' : '#7dff8a')
  }

  private whiteOf(img: HTMLImageElement): HTMLCanvasElement {
    let cv = this.white.get(img)
    if (!cv) {
      cv = document.createElement('canvas')
      cv.width = img.width; cv.height = img.height
      const c = cv.getContext('2d') as CanvasRenderingContext2D
      c.drawImage(img, 0, 0)
      c.globalCompositeOperation = 'source-in'
      c.fillStyle = '#fff'
      c.fillRect(0, 0, cv.width, cv.height)
      this.white.set(img, cv)
    }
    return cv
  }

  private drawGoddess(c: CanvasRenderingContext2D) {
    const t = this.fxTick
    const g = this.cfg.goddess
    const x = g[0] ?? 0, y = (g[1] ?? 0) + 40
    const img = this.assets.goddess
    const h = 124, w = (img.width / img.height) * h
    const hit = t - this.goddessHitAt
    const glow = 0.5 + 0.5 * Math.sin(t * 0.08)
    c.save()
    c.translate(x, y)
    const halo = c.createRadialGradient(0, -h * 0.5, 6, 0, -h * 0.5, 96)
    const hot = t - this.reviveAt < 30
    halo.addColorStop(0, hot ? 'rgba(255,243,168,0.75)' : `rgba(255,244,200,${0.22 + glow * 0.14})`)
    halo.addColorStop(1, 'rgba(255,244,200,0)')
    c.fillStyle = halo
    c.beginPath(); c.arc(0, -h * 0.5, 96, 0, Math.PI * 2); c.fill()
    if (hit >= 0 && hit < 6) c.translate(Math.sin(hit * 4) * 3 * (1 - hit / 6), 0)
    c.drawImage(img, -w / 2, -h, w, h)
    if (hit >= 0 && hit < 5) {
      c.globalAlpha = 0.6 * (1 - hit / 5)
      c.globalCompositeOperation = 'source-atop'
      c.drawImage(this.whiteOf(img), -w / 2, -h, w, h)
    }
    c.restore()
    const ratio = Math.max(0, this.goddessHp / Math.max(1, this.goddessMax))
    this.bar(c, x, y + 10, 86, ratio, ratio > 0.5 ? '#ffe9a8' : ratio > 0.25 ? '#ffb347' : '#ff5a4a', 7)
    c.save()
    c.font = '600 12px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.lineWidth = 3
    const label = `${Math.max(0, this.goddessHp)} / ${this.goddessMax}`
    c.strokeText(label, x, y + 24); c.fillText(label, x, y + 24)
    c.restore()
  }

  private bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number, color: string, h = 4) {
    c.save()
    c.fillStyle = 'rgba(0,0,0,0.65)'
    c.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2)
    c.fillStyle = color
    c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), h)
    c.restore()
  }

  private drawFx(c: CanvasRenderingContext2D) {
    const t = this.fxTick
    for (const f of this.fx) {
      const p = (t - f.born) / f.life
      if (p < 0) continue
      c.save()
      if (f.kind === 'arrow') {
        const x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p - Math.sin(p * Math.PI) * 14
        const ang = Math.atan2(f.y1 - f.y0, f.x1 - f.x0)
        c.translate(x, y); c.rotate(ang)
        c.strokeStyle = f.color; c.lineWidth = 2.2; c.lineCap = 'round'
        c.shadowColor = f.color; c.shadowBlur = 8
        c.beginPath(); c.moveTo(-16, 0); c.lineTo(4, 0); c.stroke()
        c.fillStyle = '#fff'
        c.beginPath(); c.moveTo(8, 0); c.lineTo(1, -3.5); c.lineTo(1, 3.5); c.fill()
      } else if (f.kind === 'orb') {
        const x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p - Math.sin(p * Math.PI) * 26
        c.shadowColor = f.color; c.shadowBlur = 18
        c.fillStyle = f.color
        c.beginPath(); c.arc(x, y, f.r, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#fff'
        c.beginPath(); c.arc(x, y, f.r * 0.45, 0, Math.PI * 2); c.fill()
      } else if (f.kind === 'ring') {
        const r = f.r * (0.25 + 0.75 * Math.sqrt(p))
        c.globalAlpha = (1 - p) * 0.9
        const g = c.createRadialGradient(f.x0, f.y0, r * 0.2, f.x0, f.y0, r)
        g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.75, f.color + '55'); g.addColorStop(1, f.color)
        c.fillStyle = g
        c.beginPath(); c.ellipse(f.x0, f.y0, r, r * 0.72, 0, 0, Math.PI * 2); c.fill()
        c.strokeStyle = '#fff'; c.lineWidth = 2 * (1 - p)
        c.stroke()
      } else if (f.kind === 'bolt' && f.pts) {
        c.globalAlpha = 1 - p
        c.strokeStyle = '#fff'; c.lineWidth = 3.2 * (1 - p * 0.5); c.lineJoin = 'round'
        c.shadowColor = '#7fb8ff'; c.shadowBlur = 16
        c.beginPath()
        for (let i = 0; i < f.pts.length; i += 2) (i === 0 ? c.moveTo(f.pts[i] ?? 0, f.pts[i + 1] ?? 0) : c.lineTo(f.pts[i] ?? 0, f.pts[i + 1] ?? 0))
        c.stroke()
      } else if (f.kind === 'cleave') {
        // 騎士的刀光:一道月牙從頭頂往身前掃下來(x1 = 面向,1 右 -1 左)
        c.translate(f.x0, f.y0)
        c.scale(f.x1, 1)
        const head = -1.75 + 2.5 * Math.min(1, p * 1.5)       // 刀尖掃到哪
        const tail = head - 1.5 * (1 - p * 0.5)
        c.globalAlpha = Math.min(1, (1 - p) * 1.6)
        c.shadowColor = '#bfe2ff'; c.shadowBlur = 16
        c.lineCap = 'round'
        for (let i = 0; i < 6; i++) {                          // 尾巴越來越細、越來越淡
          const a0 = tail + ((head - tail) * i) / 6, a1 = tail + ((head - tail) * (i + 1)) / 6 + 0.03
          c.strokeStyle = 'rgba(255,255,255,' + (0.15 + 0.14 * i) + ')'
          c.lineWidth = 2 + i * 1.9
          c.beginPath(); c.arc(0, 0, f.r, a0, a1); c.stroke()
        }
      } else if (f.kind === 'wave') {
        // 劍氣:一道小月牙從騎士飛到怪身上
        const x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p
        c.translate(x, y)
        c.rotate(Math.atan2(f.y1 - f.y0, f.x1 - f.x0))
        c.globalAlpha = 0.95 - p * 0.35
        c.shadowColor = '#9fd4ff'; c.shadowBlur = 14
        c.strokeStyle = f.color; c.lineCap = 'round'; c.lineWidth = 5
        c.beginPath(); c.arc(-f.r, 0, f.r, -0.75, 0.75); c.stroke()
        c.strokeStyle = '#fff'; c.lineWidth = 2
        c.beginPath(); c.arc(-f.r, 0, f.r, -0.55, 0.55); c.stroke()
      } else if (f.kind === 'slash') {
        c.globalAlpha = 1 - p
        c.translate(f.x0, f.y0); c.rotate(-0.7)
        c.strokeStyle = f.color; c.lineWidth = 5 * (1 - p); c.lineCap = 'round'
        c.shadowColor = f.color; c.shadowBlur = 12
        c.beginPath(); c.arc(0, 0, f.r, -1.1 + p * 0.6, 1.1 + p * 0.6); c.stroke()
      } else if (f.kind === 'stab') {
        c.globalAlpha = 1 - p
        c.translate(f.x0, f.y0)
        c.strokeStyle = f.color; c.lineWidth = 3.5 * (1 - p); c.lineCap = 'round'
        c.shadowColor = f.color; c.shadowBlur = 14
        const r = f.r * (0.6 + p * 0.6)
        c.beginPath(); c.moveTo(-r, -r); c.lineTo(r, r); c.moveTo(r, -r); c.lineTo(-r, r); c.stroke()
      }
      c.restore()
    }
  }

  private drawParticles(c: CanvasRenderingContext2D) {
    const t = this.fxTick
    c.save()
    for (const p of this.parts) {
      const age = t - p.born
      if (age < 0) continue
      const k = age / p.life
      const x = p.x + p.vx * age, y = p.y + p.vy * age + 0.5 * p.g * age * age
      c.globalAlpha = 1 - k
      c.fillStyle = p.color
      if (p.kind === 2) {          // 雪花 / 冰晶:小菱形
        const s = p.size * (1 - k * 0.3)
        c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.6, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.6, y); c.fill()
      } else if (p.kind === 3) {   // 毒泡泡:空心圓
        c.strokeStyle = p.color; c.lineWidth = 1.2
        c.beginPath(); c.arc(x, y, p.size * (0.6 + k), 0, Math.PI * 2); c.stroke()
      } else {
        c.beginPath(); c.arc(x, y, p.size * (1 - k * 0.6), 0, Math.PI * 2); c.fill()
      }
    }
    c.restore()
  }

  private drawFloats(c: CanvasRenderingContext2D) {
    const t = this.fxTick
    c.save()
    c.textAlign = 'center'; c.textBaseline = 'middle'
    for (const f of this.floats) {
      if (t < f.born) continue
      const k = (t - f.born) / f.life
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.5)
      c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
      c.font = `700 ${Math.round(f.size * pop)}px Inter, 'Noto Sans TC', sans-serif`
      c.lineWidth = 3
      c.strokeStyle = 'rgba(0,0,0,0.85)'
      const y = f.y - f.vy * (t - f.born)
      c.strokeText(f.text, f.x, y)
      c.fillStyle = f.color
      c.fillText(f.text, f.x, y)
    }
    c.restore()
  }

  private drawBossBar(c: CanvasRenderingContext2D) {
    let boss: MobVis | null = null
    for (const m of this.mobs.values()) if (m.rank === 2 && !m.gone) boss = m
    if (!boss) return
    const name = this.cfg.bosses[this.chapter % this.cfg.bosses.length] ?? '王'
    c.save()
    const w = 420, x = W / 2, y = 24
    c.fillStyle = 'rgba(0,0,0,0.7)'
    c.fillRect(x - w / 2 - 3, y - 3, w + 6, 16)
    const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
    g.addColorStop(0, '#ff5a3d'); g.addColorStop(1, '#ffb347')
    c.fillStyle = g
    c.fillRect(x - w / 2, y, w * Math.max(0, boss.hp / boss.maxHp), 10)
    c.font = "600 14px 'Noto Sans TC', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.fillStyle = '#fff3cf'
    c.strokeText(name, x, y - 12); c.fillText(name, x, y - 12)
    c.restore()
  }

  // ===================== 特效小工具 =====================

  private shake(amp: number) { this.shakeAt = this.fxTick; this.shakeAmp = amp }

  private float(x: number, y: number, text: string, color: string, size: number, life: number, delay = 0) {
    this.floats.push({ x, y, text, color, size, born: this.fxTick + delay, life, vy: 1.3 })
  }

  private burst(x: number, y: number, color: string, n: number) { this.burstLater(x, y, color, n, 0, 1) }

  private burstLater(x: number, y: number, color: string, n: number, delay: number, kind: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.4
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.75 - 1, born: this.fxTick + delay, life: 7 + Math.random() * 8, size: 1.6 + Math.random() * 2.6, color, g: 0.16, kind })
    }
  }

  private bubble(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ x: x + (Math.random() * 20 - 10), y: y + (Math.random() * 12 - 6), vx: Math.random() * 0.6 - 0.3, vy: -0.7 - Math.random() * 0.6, born: this.fxTick, life: 12 + Math.random() * 8, size: 2 + Math.random() * 2, color, g: 0, kind: 3 })
    }
  }

  /** 升級 / 復活:腳下往上冒光 */
  private levelUp(x: number, y: number, cls: number) {
    const color = CLS_COLOR[cls] ?? '#fff'
    for (let i = 0; i < 26; i++) {
      this.parts.push({ x: x + (Math.random() * 44 - 22), y: y - Math.random() * 10, vx: 0, vy: -1.6 - Math.random() * 2.2, born: this.fxTick + Math.random() * 3, life: 10 + Math.random() * 8, size: 1.8 + Math.random() * 2.2, color, g: 0, kind: 1 })
    }
  }

  // ===================== 座標與滑鼠 =====================

  /** 沿路線走了 pos(後端的單位)之後在畫面上的位置 */
  private posXY(pos: number): [number, number] {
    const u = this.cfg.unit
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
    void u
    const last = path[path.length - 1] as number[]
    return [last[0] ?? 0, last[1] ?? 0]
  }

  private slotAt(ev: MouseEvent): number {
    const r = this.canvas.getBoundingClientRect()
    const x = ((ev.clientX - r.left) / r.width) * W, y = ((ev.clientY - r.top) / r.height) * H
    // 手機上地圖縮得很小:點擊範圍至少留 24 個實際像素的半徑,手指才點得到
    const reach = Math.max(46, (24 * W) / r.width)
    let best = -1, bestD = reach * reach
    this.cfg.slots.forEach((s, i) => {
      const tw = this.towers[i]
      // 塔站著的地方(騎士在路上)和石台本身都可以點
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
}

/** 兩點之間的一條鋸齒線(閃電) */
function jag(x0: number, y0: number, x1: number, y1: number): number[] {
  const pts: number[] = [x0, y0]
  const n = 6
  for (let i = 1; i < n; i++) {
    const k = i / n
    pts.push(x0 + (x1 - x0) * k + (Math.random() * 18 - 9), y0 + (y1 - y0) * k + (Math.random() * 18 - 9))
  }
  pts.push(x1, y1)
  return pts
}
