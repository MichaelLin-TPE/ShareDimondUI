// 天堂塔防的特效:箭、法球、爆炸、冰、閃電、刀光、粒子、飄字、整個畫面的閃光與警示。
// 這裡只管「長什麼樣子」;什麼時候放哪一個,由 scene.ts 照後端的事件決定。
// 時間單位跟後端一樣是 tick(一秒 20 tick)。
import { VH, W, glow, glowOf, rng } from './terrain'

type C2 = CanvasRenderingContext2D

export type FxKind =
  | 'arrow' | 'orb' | 'wave'                       // 會飛的:箭、法球、劍氣
  | 'explode' | 'flames' | 'spikes' | 'shards'     // 火焰爆炸、火柱、冰刺、落下的冰錐
  | 'bolt' | 'cleave' | 'slash' | 'flash' | 'pillar' | 'soul' | 'shield'
  | 'ring' | 'frost' | 'circle' | 'scorch'         // 貼在地上的:震波、結冰、魔法陣、焦痕

export interface Fx {
  kind: FxKind; born: number; life: number
  x0: number; y0: number; x1: number; y1: number
  /** 顏色一律寫成 #rrggbb(要拿去做光暈) */
  color: string; r: number
  /** 每種特效自己的參數:箭的種類、刀痕的角度、面向… */
  v: number
  /** 畫在人和怪的腳下 */
  ground: boolean
  seed: number
}
type FxOpts = Partial<Pick<Fx, 'x1' | 'y1' | 'color' | 'r' | 'v' | 'ground'>>

// 粒子的種類
export const P = { DOT: 0, GLOW: 1, ICE: 2, BUBBLE: 3, SMOKE: 4, STREAK: 5, STAR: 6, COIN: 7, DEBRIS: 8, FLAME: 9 } as const
interface Particle { x: number; y: number; vx: number; vy: number; born: number; life: number; size: number; color: string; g: number; drag: number; kind: number; rot: number }
interface FloatText { x: number; y: number; text: string; color: string; size: number; born: number; life: number; vy: number; style: number }
interface Screen { kind: 'flash' | 'edge' | 'banner'; born: number; life: number; color: string; power: number; text: string; sub: string }

const GROUND: FxKind[] = ['ring', 'frost', 'circle', 'scorch']

export class FxLayer {
  /** 現在的時間(tick);每一格由場景更新 */
  t = 0
  /** 畫質倍率(1 = 全開;手機跑不動時場景會調到 0.35):粒子數量、同時存在的上限都照它打折 */
  quality = 1
  parts: Particle[] = []
  private floats: FloatText[] = []
  list: Fx[] = []
  private screens: Screen[] = []

  clear() { this.parts = []; this.floats = []; this.list = []; this.screens = [] }

  add(kind: FxKind, delay: number, life: number, x0: number, y0: number, o: FxOpts = {}) {
    this.list.push({
      kind, born: this.t + delay, life, x0, y0, x1: o.x1 ?? x0, y1: o.y1 ?? y0, color: o.color ?? '#ffffff', r: o.r ?? 10, v: o.v ?? 0,
      ground: o.ground ?? GROUND.includes(kind), seed: Math.floor(Math.random() * 1e9),
    })
  }

  // ===================== 粒子 =====================

  private part(x: number, y: number, vx: number, vy: number, delay: number, life: number, size: number, color: string, kind: number, g = 0, drag = 0) {
    this.parts.push({ x, y, vx, vy, born: this.t + delay, life, size, color, g, drag, kind, rot: Math.random() * 6.28 })
  }

  /** 要噴幾顆:照畫質打折,但至少留一顆讓人看得出有打到 */
  private n(count: number) {
    return this.quality >= 1 ? count : Math.max(1, Math.round(count * this.quality))
  }

  /** 往四面八方噴的光點 */
  burst(x: number, y: number, color: string, n: number, delay = 0, kind: number = P.GLOW, power = 1) {
    n = this.n(n)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (1 + Math.random() * 3.4) * power
      this.part(x, y, Math.cos(a) * s, Math.sin(a) * s * 0.75 - 1, delay, 7 + Math.random() * 8, 1.6 + Math.random() * 2.6, color, kind, 0.16, 0.04)
    }
  }
  /** 打到東西迸出來的火花(拖著尾巴) */
  sparks(x: number, y: number, color: string, n: number, delay = 0, power = 1) {
    n = this.n(n)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (2.4 + Math.random() * 4) * power
      this.part(x, y, Math.cos(a) * s, Math.sin(a) * s * 0.8 - 0.6, delay, 4 + Math.random() * 5, 1 + Math.random() * 1.4, color, P.STREAK, 0.22, 0.07)
    }
  }
  smoke(x: number, y: number, n: number, delay = 0, color = '#2a2420', spread = 14) {
    if (this.quality < 1) return          // 煙最吃效能(大張半透明),降畫質就不畫
    for (let i = 0; i < n; i++) {
      this.part(x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 0.5, -0.5 - Math.random() * 0.7, delay + Math.random() * 3, 16 + Math.random() * 14, 7 + Math.random() * 8, color, P.SMOKE, 0, 0.02)
    }
  }
  /** 往上飄的火星 */
  embers(x: number, y: number, color: string, n: number, delay = 0, spread = 20) {
    n = this.n(n)
    for (let i = 0; i < n; i++) {
      this.part(x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread * 0.6, (Math.random() - 0.5) * 1.2, -1 - Math.random() * 2, delay + Math.random() * 4, 10 + Math.random() * 12, 1.4 + Math.random() * 1.8, color, P.FLAME, -0.02, 0.02)
    }
  }
  ice(x: number, y: number, n: number, delay = 0, power = 1) {
    n = this.n(n)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (1 + Math.random() * 3) * power
      this.part(x, y, Math.cos(a) * s, Math.sin(a) * s * 0.7 - 1.4, delay, 9 + Math.random() * 9, 2 + Math.random() * 2.6, i % 2 ? '#d6f6ff' : '#ffffff', P.ICE, 0.14, 0.03)
    }
  }
  bubble(x: number, y: number, color: string, n: number, delay = 0) {
    for (let i = 0; i < n; i++) {
      this.part(x + (Math.random() * 20 - 10), y + (Math.random() * 12 - 6), Math.random() * 0.6 - 0.3, -0.7 - Math.random() * 0.6, delay, 12 + Math.random() * 8, 2 + Math.random() * 2, color, P.BUBBLE)
    }
  }
  /** 腳下往上冒的光(升級、復活) */
  rise(x: number, y: number, color: string, n: number, spread = 22) {
    n = this.n(n)
    for (let i = 0; i < n; i++) {
      this.part(x + (Math.random() * 2 - 1) * spread, y - Math.random() * 10, 0, -1.6 - Math.random() * 2.2, Math.random() * 4, 10 + Math.random() * 8, 1.8 + Math.random() * 2.2, color, i % 4 === 0 ? P.STAR : P.GLOW)
    }
  }
  stars(x: number, y: number, color: string, n: number, delay = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.4 + Math.random() * 2.4
      this.part(x, y, Math.cos(a) * s, Math.sin(a) * s * 0.7 - 1.2, delay, 9 + Math.random() * 7, 3 + Math.random() * 2.4, color, P.STAR, 0.1, 0.03)
    }
  }
  /** 怪倒下掉出來的天幣 */
  coins(x: number, y: number, n: number, delay = 0) {
    for (let i = 0; i < n; i++) {
      this.part(x, y, (Math.random() - 0.5) * 3.2, -3.4 - Math.random() * 2.2, delay + i * 0.5, 13 + Math.random() * 4, 3.2, '#ffd24d', P.COIN, 0.42)
    }
  }
  debris(x: number, y: number, color: string, n: number, delay = 0) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * Math.random(), s = 1.6 + Math.random() * 3
      this.part(x, y, Math.cos(a) * s, Math.sin(a) * s - 1, delay, 10 + Math.random() * 6, 2 + Math.random() * 2.4, color, P.DEBRIS, 0.36)
    }
  }

  // ===================== 飄字、整個畫面的效果 =====================

  /** style:0 一般、1 暴擊(大、會彈一下) */
  float(x: number, y: number, text: string, color: string, size: number, life: number, delay = 0, style = 0) {
    this.floats.push({ x, y, text, color, size, born: this.t + delay, life, vy: 1.3, style })
  }
  screenFlash(color: string, power: number, life: number) { this.screens.push({ kind: 'flash', born: this.t, life, color, power, text: '', sub: '' }) }
  screenEdge(color: string, power: number, life: number) { this.screens.push({ kind: 'edge', born: this.t, life, color, power, text: '', sub: '' }) }
  banner(text: string, sub: string, color: string, life: number) { this.screens.push({ kind: 'banner', born: this.t, life, color, power: 1, text, sub }) }

  // ===================== 每一格 =====================

  /** dt = 這一格過了幾個 tick */
  update(dt: number) {
    const t = this.t
    for (const p of this.parts) {
      if (t < p.born) continue
      p.x += p.vx * dt; p.y += p.vy * dt
      p.vy += p.g * dt
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k }
    }
    // 飛行中的東西沿路掉一點光屑
    for (const f of this.list) {
      const p = (t - f.born) / f.life
      if (p < 0 || p > 1) continue
      if (f.kind === 'arrow' && f.v > 0 && Math.random() < dt * 1.6) {
        const [x, y] = flyPos(f, p)
        if (f.v === 2) this.part(x, y, (Math.random() - 0.5) * 0.6, -0.4 - Math.random() * 0.5, 0, 6 + Math.random() * 4, 2 + Math.random() * 1.6, Math.random() > 0.5 ? '#ff7a1f' : '#ffd24d', P.FLAME, -0.02)
        else this.part(x, y, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 0, 5 + Math.random() * 3, 1.4, '#c8ffe6', P.GLOW)
      } else if (f.kind === 'orb' && Math.random() < dt * 2.2) {
        const [x, y] = flyPos(f, p)
        this.part(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6 - (f.v === 1 ? 0.5 : 0), 0, 6 + Math.random() * 4, 1.6 + Math.random() * 1.6, f.color, f.v === 2 ? P.ICE : f.v === 1 ? P.FLAME : P.GLOW)
      }
    }
    this.parts = this.parts.filter((p) => t - p.born < p.life)
    this.floats = this.floats.filter((f) => t - f.born < f.life)
    this.list = this.list.filter((f) => t - f.born < f.life)
    this.screens = this.screens.filter((s) => t - s.born < s.life)
    const cap = this.quality >= 1 ? 1100 : 320
    if (this.parts.length > cap) this.parts.splice(0, this.parts.length - cap)
    if (this.floats.length > 90) this.floats.splice(0, this.floats.length - 90)
    if (this.list.length > 260) this.list.splice(0, this.list.length - 260)
  }

  drawGround(c: C2) { this.drawList(c, true) }
  drawAir(c: C2) { this.drawList(c, false); this.drawParticles(c) }

  private drawList(c: C2, ground: boolean) {
    const t = this.t
    for (const f of this.list) {
      if (f.ground !== ground) continue
      const age = t - f.born
      if (age < 0) continue
      c.save()
      drawFx(c, f, age / f.life, age)
      c.restore()
    }
  }

  private drawParticles(c: C2) {
    const t = this.t
    c.save()
    // 先畫一般的(煙、碎片、天幣),再畫會發光的(疊亮)
    for (const p of this.parts) {
      const age = t - p.born
      if (age < 0) continue
      const k = age / p.life
      if (p.kind === P.SMOKE) {
        c.globalAlpha = (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) * 0.4
        const s = p.size * (1 + k * 1.6)
        c.drawImage(glowOf(p.color), p.x - s, p.y - s, s * 2, s * 2)
      } else if (p.kind === P.DOT) {
        c.globalAlpha = 1 - k
        c.fillStyle = p.color
        c.beginPath(); c.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, Math.PI * 2); c.fill()
      } else if (p.kind === P.ICE) {
        const s = p.size * (1 - k * 0.3)
        c.globalAlpha = 1 - k
        c.fillStyle = p.color
        c.beginPath(); c.moveTo(p.x, p.y - s); c.lineTo(p.x + s * 0.6, p.y); c.lineTo(p.x, p.y + s); c.lineTo(p.x - s * 0.6, p.y); c.fill()
      } else if (p.kind === P.BUBBLE) {
        c.globalAlpha = 1 - k
        c.strokeStyle = p.color; c.lineWidth = 1.2
        c.beginPath(); c.arc(p.x, p.y, p.size * (0.6 + k), 0, Math.PI * 2); c.stroke()
      } else if (p.kind === P.COIN) {
        c.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1
        const wv = Math.abs(Math.cos(age * 0.7 + p.rot))
        c.fillStyle = '#a86a12'
        c.beginPath(); c.ellipse(p.x, p.y + 0.8, p.size * (0.25 + 0.75 * wv), p.size, 0, 0, Math.PI * 2); c.fill()
        c.fillStyle = p.color
        c.beginPath(); c.ellipse(p.x, p.y, p.size * (0.25 + 0.75 * wv), p.size, 0, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#fff3b0'
        c.beginPath(); c.ellipse(p.x - p.size * 0.2 * wv, p.y - p.size * 0.3, p.size * 0.22 * wv, p.size * 0.3, 0, 0, Math.PI * 2); c.fill()
      } else if (p.kind === P.DEBRIS) {
        c.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1
        c.fillStyle = p.color
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot + age * 0.5)
        c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8)
        c.restore()
      }
    }
    c.globalCompositeOperation = 'lighter'
    for (const p of this.parts) {
      const age = t - p.born
      if (age < 0) continue
      const k = age / p.life
      if (p.kind === P.GLOW) {
        glow(c, p.x, p.y, p.size * 2.6 * (1 - k * 0.5), p.color, 1 - k)
      } else if (p.kind === P.FLAME) {
        glow(c, p.x, p.y, p.size * 2.8 * (1 - k * 0.6), p.color, (1 - k) * (0.7 + 0.3 * Math.sin(age * 3 + p.rot)))
      } else if (p.kind === P.STREAK) {
        c.globalAlpha = 1 - k
        c.strokeStyle = p.color; c.lineWidth = p.size; c.lineCap = 'round'
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); c.stroke()
      } else if (p.kind === P.STAR) {
        const s = p.size * (1 - k * 0.5)
        c.globalAlpha = 1 - k
        c.fillStyle = p.color
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot + age * 0.25)
        star4(c, s, s * 0.32)
        c.restore()
      }
    }
    c.restore()
  }

  drawFloats(c: C2) {
    const t = this.t
    c.save()
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'
    for (const f of this.floats) {
      if (t < f.born) continue
      const k = (t - f.born) / f.life
      const crit = f.style === 1
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * (crit ? 1 : 0.6) : (crit ? 1.6 : 1.2) - Math.min(crit ? 0.6 : 0.2, (k - 0.15) * (crit ? 2.4 : 0.5))
      c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
      c.font = `${crit ? 800 : 700} ${Math.round(f.size * pop)}px Inter, 'Noto Sans TC', sans-serif`
      const y = f.y - f.vy * (t - f.born)
      c.lineWidth = crit ? 4 : 3
      c.strokeStyle = crit ? 'rgba(90,20,0,0.9)' : 'rgba(0,0,0,0.85)'
      c.strokeText(f.text, f.x, y)
      c.fillStyle = f.color
      c.fillText(f.text, f.x, y)
    }
    c.restore()
  }

  /** 整個畫面的效果(不跟著鏡頭晃,用畫面座標):閃光、邊緣泛紅、首領來襲的橫幅 */
  drawScreen(c: C2) {
    const t = this.t
    const H = VH
    for (const s of this.screens) {
      const p = (t - s.born) / s.life
      if (p < 0) continue
      c.save()
      if (s.kind === 'flash') {
        c.globalAlpha = s.power * (1 - p) * (1 - p)
        c.fillStyle = s.color
        c.fillRect(0, 0, W, H)
      } else if (s.kind === 'edge') {
        const g = c.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.95)
        g.addColorStop(0, s.color + '00'); g.addColorStop(1, s.color)
        c.globalAlpha = s.power * Math.sin(Math.min(1, p * 1.0) * Math.PI) * (0.75 + 0.25 * Math.sin(t * 0.9))
        c.fillStyle = g
        c.fillRect(0, 0, W, H)
      } else {
        const inK = Math.min(1, p * 6), outK = Math.min(1, (1 - p) * 5), a = Math.min(inK, outK)
        const y = H * 0.4, bh = 84 * (0.4 + 0.6 * a)
        c.globalAlpha = a * 0.78
        c.fillStyle = '#0a0406'
        c.fillRect(0, y - bh / 2, W, bh)
        c.globalAlpha = a
        // 上下兩條會跑的警示斜紋
        c.fillStyle = s.color
        for (const yy of [y - bh / 2 - 5, y + bh / 2]) {
          c.save()
          c.beginPath(); c.rect(0, yy, W, 5); c.clip()
          const off = (t * 3) % 28
          for (let x = -40 + off; x < W + 40; x += 28) { c.beginPath(); c.moveTo(x, yy + 5); c.lineTo(x + 14, yy + 5); c.lineTo(x + 22, yy); c.lineTo(x + 8, yy); c.fill() }
          c.restore()
        }
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'
        const slide = (1 - inK) * 120
        c.font = `800 ${Math.round(34 + 4 * Math.sin(t * 0.6))}px 'Noto Sans TC', sans-serif`
        // 不用 shadowBlur(手機 GPU 畫大字的模糊陰影很貴):用粗一點的彩色描邊代替光暈
        c.lineWidth = 9; c.strokeStyle = s.color + '66'
        c.strokeText(s.text, W / 2 - slide, y - 10)
        c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,0.9)'
        c.strokeText(s.text, W / 2 - slide, y - 10)
        c.fillStyle = '#fff1e6'
        c.fillText(s.text, W / 2 - slide, y - 10)
        c.font = "600 15px 'Noto Sans TC', sans-serif"
        c.fillStyle = s.color
        c.fillText(s.sub, W / 2 + slide, y + 22)
      }
      c.restore()
    }
  }
}

// ===================== 各種特效怎麼畫 =====================

/** 箭和法球飛到一半在哪(中間會拱起來一點) */
function flyPos(f: Fx, p: number): [number, number] {
  const lift = f.kind === 'orb' ? 26 : f.kind === 'arrow' ? 12 + (f.seed % 9) : 0
  return [f.x0 + (f.x1 - f.x0) * p, f.y0 + (f.y1 - f.y0) * p - Math.sin(p * Math.PI) * lift]
}

function star4(c: C2, len: number, wid: number) {
  c.beginPath(); c.moveTo(-len, 0); c.lineTo(0, -wid); c.lineTo(len, 0); c.lineTo(0, wid); c.fill()
  c.beginPath(); c.moveTo(0, -len); c.lineTo(wid, 0); c.lineTo(0, len); c.lineTo(-wid, 0); c.fill()
}

/** 一道月牙:圓心在 (0,0)、半徑 R,從角度 a0 掃到 a1,刀尖(a1 那頭)最厚、尾巴收細 */
function crescent(c: C2, R: number, a0: number, a1: number, thick: number, color: string, alpha: number) {
  const n = 16
  c.globalAlpha = Math.max(0, Math.min(1, alpha))
  c.fillStyle = color
  c.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    if (i === 0) c.moveTo(Math.cos(a) * R, Math.sin(a) * R); else c.lineTo(Math.cos(a) * R, Math.sin(a) * R)
  }
  for (let i = n; i >= 0; i--) {
    const k = i / n, a = a0 + (a1 - a0) * k
    const th = thick * (k < 0.88 ? Math.pow(k / 0.88, 1.5) : (1 - k) / 0.12)
    c.lineTo(Math.cos(a) * (R - th), Math.sin(a) * (R - th))
  }
  c.closePath()
  c.fill()
}

/** 一道刀痕:從 xa 劃到 xb,中間鼓、兩頭尖 */
function blade(c: C2, xa: number, xb: number, w: number, color: string, alpha: number) {
  const mid = xa + (xb - xa) * 0.62
  c.globalAlpha = Math.max(0, Math.min(1, alpha))
  c.fillStyle = color
  c.beginPath()
  c.moveTo(xa, 0)
  c.quadraticCurveTo(mid, -w * 1.7, xb, 0)
  c.quadraticCurveTo(mid, w * 0.7, xa, 0)
  c.fill()
}

function jag(x0: number, y0: number, x1: number, y1: number, rnd: () => number, amp = 10): number[] {
  const d = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.max(3, Math.round(d / 20))
  const nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1)
  const pts: number[] = [x0, y0]
  for (let i = 1; i < n; i++) {
    const k = i / n, o = (rnd() * 2 - 1) * amp
    pts.push(x0 + (x1 - x0) * k + nx * o, y0 + (y1 - y0) * k + ny * o)
  }
  pts.push(x1, y1)
  return pts
}
function strokePts(c: C2, pts: number[], color: string, w: number, alpha: number) {
  c.globalAlpha = Math.max(0, Math.min(1, alpha))
  c.strokeStyle = color; c.lineWidth = w
  c.beginPath()
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) c.moveTo(pts[i] ?? 0, pts[i + 1] ?? 0); else c.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0)
  }
  c.stroke()
}

/** 低畫質時由場景設 true:火舌少一點、閃電不畫最外層的光 */
export let lowQuality = false
export function setLowQuality(v: boolean) { lowQuality = v }

function drawFx(c: C2, f: Fx, p: number, age: number) {
  switch (f.kind) {
    case 'arrow': {
      // v:0 一般的箭、1 風之箭(尾巴長)、2 火箭
      const [x, y] = flyPos(f, p)
      const [bx, by] = flyPos(f, p - 0.06)
      c.translate(x, y); c.rotate(Math.atan2(y - by, x - bx))
      const len = f.v === 1 ? 70 : 46
      const g = c.createLinearGradient(-len, 0, 0, 0)
      g.addColorStop(0, f.color + '00'); g.addColorStop(1, f.color + 'dd')
      c.globalCompositeOperation = 'lighter'
      c.strokeStyle = g; c.lineWidth = f.v === 2 ? 5 : 3.2; c.lineCap = 'round'
      c.beginPath(); c.moveTo(-len, 0); c.lineTo(0, 0); c.stroke()
      glow(c, 5, 0, f.v === 2 ? 15 : 10, f.color, 0.95)
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1
      c.strokeStyle = '#f4ead2'; c.lineWidth = 1.8
      c.beginPath(); c.moveTo(-15, 0); c.lineTo(5, 0); c.stroke()
      c.fillStyle = '#ffffff'
      c.beginPath(); c.moveTo(11, 0); c.lineTo(3, -3.6); c.lineTo(5, 0); c.lineTo(3, 3.6); c.closePath(); c.fill()
      c.strokeStyle = f.color; c.lineWidth = 1.4
      c.beginPath(); c.moveTo(-15, 0); c.lineTo(-19, -3.4); c.moveTo(-15, 0); c.lineTo(-19, 3.4); c.moveTo(-12, 0); c.lineTo(-16, -3.4); c.moveTo(-12, 0); c.lineTo(-16, 3.4); c.stroke()
      break
    }
    case 'orb': {
      // v:0 魔力球、1 火球、2 冰球
      const [x, y] = flyPos(f, p)
      c.globalCompositeOperation = 'lighter'
      glow(c, x, y, f.r * 3.6, f.color, 0.9)
      glow(c, x, y, f.r * 1.7, '#ffffff', 0.95)
      for (let i = 0; i < 2; i++) {
        const a = age * 1.4 + i * Math.PI
        glow(c, x + Math.cos(a) * f.r * 1.6, y + Math.sin(a) * f.r, f.r, f.color, 0.8)
      }
      break
    }
    case 'wave': {
      // 劍氣:一道月牙從騎士飛到怪身上,後面拖兩道殘影
      const x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p
      c.translate(x, y); c.rotate(Math.atan2(f.y1 - f.y0, f.x1 - f.x0))
      c.globalCompositeOperation = 'lighter'
      for (let i = 2; i >= 0; i--) {
        c.save()
        c.translate(-f.r - i * 11, 0)
        crescent(c, f.r, -0.85, 0.85, f.r * 0.34, i === 0 ? '#ffffff' : '#7fc4ff', (0.95 - p * 0.3) / (1 + i * 1.3))
        c.restore()
      }
      glow(c, 0, 0, 16, '#9fd4ff', 0.7)
      break
    }
    case 'explode': {
      // 火焰爆炸:白光一閃 → 火球脹開 → 一圈震波
      const e = 1 - (1 - p) * (1 - p)
      // 火球本體用一般的疊法畫(疊亮的話在草地上會整團變白,看不出是火),只有中心那一下才疊亮
      glow(c, f.x0, f.y0, f.r * (0.6 + 0.8 * e), f.color, Math.pow(1 - p, 1.2))
      c.globalCompositeOperation = 'lighter'
      glow(c, f.x0, f.y0, f.r * 0.62 * (1 - p * 0.4), '#ffd24d', Math.pow(1 - p, 2) * 0.8)
      if (p < 0.3) glow(c, f.x0, f.y0, f.r * (0.3 + p * 1.2), '#ffffff', (1 - p / 0.3) * 0.9)
      c.globalAlpha = 1 - p
      c.strokeStyle = '#ffe2b0'; c.lineWidth = 1 + 4 * (1 - p)
      c.beginPath(); c.ellipse(f.x0, f.y0 + f.r * 0.12, f.r * e * 1.05, f.r * e * 0.6, 0, 0, Math.PI * 2); c.stroke()
      break
    }
    case 'flames': {
      // 火風暴:範圍裡一根根火舌竄上來
      // 每根火舌三層:外面紅、中間橘(一般疊法,顏色才不會被洗白),芯是疊亮的黃
      const rnd = rng(f.seed)
      const flames = lowQuality ? 6 : 13
      for (let i = 0; i < flames; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * f.r * 0.85, ph = rnd(), hh = 46 + rnd() * 44, ww = 13 + rnd() * 9
        const x = f.x0 + Math.cos(a) * d, y = f.y0 + Math.sin(a) * d * 0.6 + 6
        const k = Math.sin(Math.min(1, Math.max(0, p * 1.3 - ph * 0.3)) * Math.PI)
        if (k <= 0) continue
        const h = hh * k * (0.8 + 0.2 * Math.sin(age * 2.3 + i * 1.7))
        const sway = Math.sin(age * 1.7 + i * 2.1) * 3
        c.globalCompositeOperation = 'source-over'
        c.globalAlpha = 0.8 * k
        c.drawImage(glowOf('#d4300a'), x - ww * 1.25 + sway, y - h * 1.08, ww * 2.5, h * 1.3)
        c.globalAlpha = 0.9 * k
        c.drawImage(glowOf(f.color), x - ww + sway * 0.6, y - h * 0.9, ww * 2, h * 1.08)
        c.globalCompositeOperation = 'lighter'
        c.globalAlpha = 0.85 * k
        c.drawImage(glowOf('#ffd24d'), x - ww * 0.5, y - h * 0.6, ww, h * 0.72)
      }
      break
    }
    case 'shards': {
      // 冰雪颶風:冰錐從天上斜斜砸下來
      const rnd = rng(f.seed)
      c.globalCompositeOperation = 'lighter'
      c.lineCap = 'round'
      for (let i = 0; i < 11; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * f.r * 0.9, st = rnd() * 0.5
        const k = (p - st) / 0.5
        if (k < 0 || k > 1) continue
        const x = f.x0 + Math.cos(a) * d - 46 * (1 - k), y = f.y0 + Math.sin(a) * d * 0.62 - 150 * (1 - k)
        c.globalAlpha = 0.9
        c.strokeStyle = '#d6f6ff'; c.lineWidth = 2.6
        c.beginPath(); c.moveTo(x - 9, y - 28); c.lineTo(x, y); c.stroke()
        glow(c, x, y, 8, f.color, 0.9)
      }
      break
    }
    case 'spikes': {
      // 地上長出一圈冰刺,過一下碎掉
      const rnd = rng(f.seed)
      const fade = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45
      for (let i = 0; i < 10; i++) {
        const a = rnd() * Math.PI * 2, d = (0.2 + rnd() * 0.72) * f.r, hh = 16 + rnd() * 24, ww = 4 + rnd() * 4, lean = (rnd() - 0.5) * 0.5, ph = rnd() * 0.12
        const grow = Math.min(1, Math.max(0, (p - ph) * 8))
        if (grow <= 0) continue
        const x = f.x0 + Math.cos(a) * d, y = f.y0 + Math.sin(a) * d * 0.62
        const h = hh * (1 - (1 - grow) * (1 - grow))
        const tx = x + lean * h
        c.globalAlpha = fade
        c.fillStyle = '#8fd0ee'
        c.beginPath(); c.moveTo(x - ww, y); c.lineTo(tx, y - h); c.lineTo(x + ww, y); c.closePath(); c.fill()
        c.fillStyle = '#eafaff'
        c.beginPath(); c.moveTo(x - ww * 0.15, y); c.lineTo(tx, y - h); c.lineTo(x + ww, y); c.closePath(); c.fill()
        c.strokeStyle = 'rgba(40,110,160,0.6)'; c.lineWidth = 0.8
        c.beginPath(); c.moveTo(x - ww, y); c.lineTo(tx, y - h); c.lineTo(x + ww, y); c.stroke()
      }
      break
    }
    case 'bolt': {
      // 閃電:每隔一下重新抖一次形狀,外層藍光、中間白芯,再岔出一條小的
      const rnd = rng(f.seed + Math.floor(age / 0.8) * 977)
      const pts = jag(f.x0, f.y0, f.x1, f.y1, rnd)
      const a = p < 0.25 ? 1 : 1 - (p - 0.25) / 0.75
      c.globalCompositeOperation = 'lighter'
      c.lineJoin = 'round'; c.lineCap = 'round'
      if (!lowQuality) strokePts(c, pts, '#3f7dff', 11, 0.35 * a)
      strokePts(c, pts, '#bfe0ff', 4.6, 0.85 * a)
      strokePts(c, pts, '#ffffff', 1.9, a)
      const mi = Math.floor(pts.length / 4) * 2
      const mx = pts[mi] ?? f.x0, my = pts[mi + 1] ?? f.y0
      const ba = Math.atan2(f.y1 - f.y0, f.x1 - f.x0) + (rnd() > 0.5 ? 0.9 : -0.9), bl = 22 + rnd() * 22
      strokePts(c, jag(mx, my, mx + Math.cos(ba) * bl, my + Math.sin(ba) * bl, rnd, 5), '#bfe0ff', 2, 0.7 * a)
      glow(c, f.x1, f.y1, 24, '#7fb0ff', a)
      glow(c, f.x1, f.y1, 10, '#ffffff', a)
      break
    }
    case 'cleave': {
      // 騎士的刀光:一道月牙從頭頂往身前劈下來(x1 = 面向,1 右 -1 左)
      c.translate(f.x0, f.y0); c.scale(f.x1, 1)
      const head = -1.9 + 2.9 * Math.min(1, p * 1.7)
      const span = 1.9 * (1 - p * 0.45)
      const a = Math.min(1, (1 - p) * 1.8)
      c.globalCompositeOperation = 'lighter'
      crescent(c, f.r * 1.04, head - span, head, f.r * 0.5, '#5aa8ff', a * 0.55)
      crescent(c, f.r, head - span * 0.9, head, f.r * 0.28, '#ffffff', a)
      glow(c, Math.cos(head) * f.r, Math.sin(head) * f.r, 13, '#ffffff', a)
      break
    }
    case 'slash': {
      // 一道刀痕劃過去(v = 角度)
      c.translate(f.x0, f.y0); c.rotate(f.v)
      const reveal = Math.min(1, p * 3.5)
      const a = p < 0.3 ? 1 : 1 - (p - 0.3) / 0.7
      const wd = Math.max(0.8, f.r * 0.17 * a)
      const xh = -f.r + 2 * f.r * reveal
      c.globalCompositeOperation = 'lighter'
      blade(c, -f.r, xh, wd * 2.4, f.color, a * 0.7)
      blade(c, -f.r, xh, wd, '#ffffff', a)
      break
    }
    case 'flash': {
      // 命中的閃光:一顆光球加十字星芒(v = 星芒轉幾度)
      c.globalCompositeOperation = 'lighter'
      glow(c, f.x0, f.y0, f.r * (0.6 + p * 0.9), f.color, 1 - p)
      glow(c, f.x0, f.y0, f.r * 0.45, '#ffffff', 1 - p)
      c.translate(f.x0, f.y0); c.rotate(f.v)
      c.globalAlpha = 1 - p
      c.fillStyle = '#ffffff'
      star4(c, f.r * 1.5 * (1 - p * 0.4), f.r * 0.11 * (1 - p))
      break
    }
    case 'pillar': {
      // 一道光柱從天上打下來(升級、復活、起死回生)
      const a = Math.sin(Math.min(1, p) * Math.PI)
      const w = f.r * (1.3 - 0.5 * p), h = 250
      c.globalCompositeOperation = 'lighter'
      c.globalAlpha = a * 0.8
      c.drawImage(glowOf(f.color), f.x0 - w, f.y0 - h, w * 2, h + 30)
      c.globalAlpha = a
      c.drawImage(glowOf('#ffffff'), f.x0 - w * 0.4, f.y0 - h, w * 0.8, h + 20)
      c.drawImage(glowOf(f.color), f.x0 - w * 1.8, f.y0 - 14, w * 3.6, 28)
      break
    }
    case 'soul': {
      // 怪倒下之後飄走的一縷魂
      const x = f.x0 + Math.sin(age * 0.5 + f.seed) * 6, y = f.y0 - 52 * p
      c.globalCompositeOperation = 'lighter'
      glow(c, x - Math.sin(age * 0.5 + f.seed - 0.6) * 3, y + 9, 6, f.color, (1 - p) * 0.45)
      glow(c, x, y, 10 * (1 - p * 0.5), f.color, (1 - p) * 0.9)
      glow(c, x, y, 4, '#ffffff', 1 - p)
      break
    }
    case 'shield': {
      // 半圓的結界閃一下(女神像擋下、騎士反擊)
      const a = 1 - p
      const R = f.r * (0.92 + 0.14 * p)
      c.translate(f.x0, f.y0)
      c.globalCompositeOperation = 'lighter'
      c.globalAlpha = a * 0.3
      c.fillStyle = f.color
      c.beginPath(); c.arc(0, 0, R, Math.PI, 0); c.fill()
      c.globalAlpha = a
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.5
      c.beginPath(); c.arc(0, 0, R, Math.PI, 0); c.stroke()
      c.strokeStyle = f.color; c.lineWidth = 1.2
      c.beginPath(); c.arc(0, 0, R * 0.68, Math.PI, 0); c.stroke()
      for (let i = 1; i < 6; i++) {
        const an = Math.PI + (i / 6) * Math.PI
        c.beginPath(); c.moveTo(Math.cos(an) * R * 0.68, Math.sin(an) * R * 0.68); c.lineTo(Math.cos(an) * R, Math.sin(an) * R); c.stroke()
      }
      break
    }
    case 'ring': {
      // 貼地的一圈震波(v = 線多粗)
      const e = 1 - (1 - p) * (1 - p)
      c.globalAlpha = 1 - p
      c.strokeStyle = f.color; c.lineWidth = 1 + (f.v || 4) * (1 - p)
      c.beginPath(); c.ellipse(f.x0, f.y0, f.r * e, f.r * e * 0.6, 0, 0, Math.PI * 2); c.stroke()
      break
    }
    case 'frost': {
      // 地面結一片冰,上面有裂紋
      const e = Math.min(1, p * 5)
      const fade = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5
      const R = f.r * (0.3 + 0.7 * e)
      c.translate(f.x0, f.y0); c.scale(1, 0.62)
      const g = c.createRadialGradient(0, 0, 0, 0, 0, R)
      g.addColorStop(0, 'rgba(235,250,255,0.6)'); g.addColorStop(0.7, 'rgba(159,232,255,0.4)'); g.addColorStop(1, 'rgba(159,232,255,0)')
      c.globalAlpha = fade
      c.fillStyle = g
      c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill()
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6
      c.beginPath(); c.arc(0, 0, R * 0.9, 0, Math.PI * 2); c.stroke()
      const rnd = rng(f.seed)
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1
      for (let i = 0; i < 7; i++) {
        const a = rnd() * Math.PI * 2, b = (rnd() - 0.5) * 0.5
        c.beginPath(); c.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12)
        c.lineTo(Math.cos(a + b) * R * 0.55, Math.sin(a + b) * R * 0.55)
        c.lineTo(Math.cos(a - b * 0.6) * R * 0.86, Math.sin(a - b * 0.6) * R * 0.86)
        c.stroke()
      }
      break
    }
    case 'circle': {
      // 施法者腳下的魔法陣:兩圈、六芒星、一圈刻痕,慢慢轉
      const a = Math.min(1, p * 5) * Math.min(1, (1 - p) * 3)
      const R = f.r
      c.translate(f.x0, f.y0); c.scale(1, 0.45); c.rotate(age * 0.12)
      c.globalCompositeOperation = 'lighter'
      c.globalAlpha = a * 0.25
      c.drawImage(glowOf(f.color), -R * 1.3, -R * 1.3, R * 2.6, R * 2.6)
      c.globalAlpha = a
      c.strokeStyle = f.color; c.lineWidth = 2.4
      c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke()
      c.lineWidth = 1.4
      c.beginPath(); c.arc(0, 0, R * 0.8, 0, Math.PI * 2); c.stroke()
      for (let k = 0; k < 2; k++) {
        c.beginPath()
        for (let i = 0; i < 3; i++) {
          const an = k * Math.PI + (i / 3) * Math.PI * 2
          if (i === 0) c.moveTo(Math.cos(an) * R * 0.8, Math.sin(an) * R * 0.8); else c.lineTo(Math.cos(an) * R * 0.8, Math.sin(an) * R * 0.8)
        }
        c.closePath(); c.stroke()
      }
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * Math.PI * 2
        c.beginPath(); c.moveTo(Math.cos(an) * R * 0.86, Math.sin(an) * R * 0.86); c.lineTo(Math.cos(an) * R * 0.95, Math.sin(an) * R * 0.95); c.stroke()
      }
      break
    }
    case 'scorch': {
      // 地上留一塊焦痕(或霜痕),慢慢淡掉
      c.globalAlpha = (p < 0.08 ? p / 0.08 : 1 - (p - 0.08) / 0.92) * 0.55
      c.drawImage(glowOf(f.color), f.x0 - f.r, f.y0 - f.r * 0.6, f.r * 2, f.r * 1.2)
      break
    }
  }
}
