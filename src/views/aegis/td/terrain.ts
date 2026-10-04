// 天堂塔防的地圖:七個場景(說話之島、古魯丁、風木、奇岩、海音、龍之谷、歐瑞)各自的地表、路面、水池/岩漿/冰湖、
// 樹和石頭這些擺設,還有會動的氛圍(飄雪、落葉、火星、水面反光、雲影)。
//
// 不會動的部分只在換場景或畫布大小改變時畫一次,存成一張底圖;會動的部分每一格疊上去。
// 這裡全部只是「好不好看」,跟勝負無關:路線、塔位、女神像的位置都照後端給的 cfg 畫。
import type { TdConfig } from './api'

export const W = 1000
export const H = 600
/** 畫面比後端的地圖(1000×600)往上多露出這麼多:最上面那個塔位離上緣只有 25,不多留一點人會被切掉頭 */
export const TOP = 60
/** 整個畫面的高度 */
export const VH = H + TOP

export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ===================== 顏色小工具 =====================

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}
function hex(r: number, g: number, b: number) {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return '#' + h(r) + h(g) + h(b)
}
/** 兩個顏色之間取一點(k = 0 是 a、1 是 b) */
export function mix(a: string, b: string, k: number) {
  const x = rgb(a), y = rgb(b)
  return hex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k)
}
const lighten = (c: string, k: number) => mix(c, '#ffffff', k)
const darken = (c: string, k: number) => mix(c, '#000000', k)

const glowCache = new Map<string, HTMLCanvasElement>()
/** 手機切到別的 App 再回來,瀏覽器可能把畫布的內容丟掉:把快取清掉重畫 */
export function clearGlowCache() { glowCache.clear() }
/** 一顆柔邊的光球(顏色要寫成 #rrggbb);發光的東西都拿它疊 */
export function glowOf(color: string): HTMLCanvasElement {
  let cv = glowCache.get(color)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const c = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, color); g.addColorStop(0.3, color + 'b0'); g.addColorStop(0.65, color + '38'); g.addColorStop(1, color + '00')
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
    glowCache.set(color, cv)
  }
  return cv
}
/** 在 (x, y) 畫一顆半徑 r 的光球。會改 globalAlpha,呼叫的人要自己 save / restore */
export function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  if (alpha <= 0.004 || r <= 0) return
  c.globalAlpha = Math.min(1, alpha)
  c.drawImage(glowOf(color), x - r, y - r, r * 2, r * 2)
}

// ===================== 場景設定 =====================

type Scatter = 'grass' | 'flower' | 'pebble' | 'mushroom' | 'shell' | 'bone' | 'crack' | 'drift' | 'slab' | 'dune'
interface Theme {
  /** 地表:暗、中、亮 */
  ground: [string, string, string]
  /** 路:路面、路緣、路面上的暗紋 */
  road: [string, string, string]
  roadStyle: 'dirt' | 'cobble' | 'snow'
  /** 草叢的兩個顏色 */
  tuft: [string, string]
  flowers: string[]
  /** 散在地上的小東西:種類與數量 */
  scatter: [Scatter, number][]
  liquid: 'water' | 'lava' | 'ice'
  /** 水(或岩漿、冰):深、淺、岸邊 */
  liquidColor: [string, string, string]
  /** 右邊再多一池(海音是水都) */
  secondPool: boolean
  /** 擺設:大的(樹)、中的、小的、右邊空地的主景 */
  big: string[]; mid: string[]; small: string[]; feature: string[]
  ambient: 'pollen' | 'leaves' | 'sand' | 'mist' | 'glint' | 'embers' | 'snow'
  /** 雲影的顏色(龍之谷是煙) */
  cloud: string
}

const THEMES: Theme[] = [
  { // 說話之島:青草地、小池塘、蝴蝶
    ground: ['#2a5630', '#3f7a3c', '#62a04c'], road: ['#c9a973', '#7d6236', '#ad8c58'], roadStyle: 'dirt',
    tuft: ['#77bd5c', '#3d8a3a'], flowers: ['#ffffff', '#ffd84d', '#ff8fb0', '#b9a2ff'],
    scatter: [['grass', 190], ['flower', 60], ['pebble', 26], ['mushroom', 8]],
    liquid: 'water', liquidColor: ['#1f6f8f', '#56b6c9', '#8a7a4c'], secondPool: false,
    big: ['tree', 'tree', 'pine'], mid: ['bush', 'pine', 'tree', 'bush'], small: ['stump', 'bush', 'boulder', 'boulder'], feature: ['tent', 'campfire'],
    ambient: 'pollen', cloud: '#0c2410',
  },
  { // 古魯丁:秋天的村莊,石板路、房子、落葉
    ground: ['#3b5527', '#5a7a35', '#86a04a'], road: ['#b9a888', '#5f523c', '#94846a'], roadStyle: 'cobble',
    tuft: ['#9bb555', '#5d8436'], flowers: ['#ffd84d', '#ff9a4d', '#ffffff'],
    scatter: [['grass', 150], ['flower', 34], ['pebble', 30], ['mushroom', 5]],
    liquid: 'water', liquidColor: ['#28607c', '#5fa9bf', '#7a6c48'], secondPool: false,
    big: ['autumn', 'tree', 'autumn'], mid: ['bush', 'autumn', 'fence', 'bush'], small: ['stump', 'crate', 'boulder', 'bush'], feature: ['house', 'crate'],
    ambient: 'leaves', cloud: '#141c08',
  },
  { // 風木:沙漠綠洲,棕櫚、仙人掌、風沙
    ground: ['#a07c3a', '#c6a153', '#e4c87c'], road: ['#ecd9a2', '#94733c', '#cfb679'], roadStyle: 'dirt',
    tuft: ['#9aa843', '#70802f'], flowers: ['#ff7a5a', '#fff2a8'],
    scatter: [['dune', 46], ['pebble', 44], ['grass', 46], ['bone', 7], ['flower', 10]],
    liquid: 'water', liquidColor: ['#1f7f8a', '#5fd0c4', '#d9c48a'], secondPool: false,
    big: ['palm', 'palm', 'deadtree'], mid: ['cactus', 'rock', 'palm', 'cactus'], small: ['cactus', 'bones', 'boulder', 'boulder'], feature: ['tent', 'campfire'],
    ambient: 'sand', cloud: '#4a3410',
  },
  { // 奇岩:石頭城,石板路、石柱、火盆、薄霧
    ground: ['#3c443d', '#566054', '#7a8472'], road: ['#a69c88', '#48423a', '#80776a'], roadStyle: 'cobble',
    tuft: ['#7c9468', '#4f6a4a'], flowers: ['#d8d8ff', '#ffffff'],
    scatter: [['slab', 56], ['pebble', 60], ['grass', 80], ['flower', 12]],
    liquid: 'water', liquidColor: ['#1d3f55', '#4f8296', '#5a5648'], secondPool: false,
    big: ['pine', 'deadtree', 'pillar'], mid: ['pillar', 'rock', 'banner', 'pine'], small: ['torch', 'crate', 'boulder', 'gems'], feature: ['house', 'banner'],
    ambient: 'mist', cloud: '#0a0e0c',
  },
  { // 海音:水都,兩池碧綠的水、珊瑚、貝殼
    ground: ['#1f5a58', '#2f8478', '#62ae98'], road: ['#dcd3b2', '#7d7352', '#bcb18e'], roadStyle: 'cobble',
    tuft: ['#7fd0a8', '#3f9a84'], flowers: ['#ffffff', '#ffb0c8', '#8fe8ff'],
    scatter: [['grass', 130], ['shell', 26], ['flower', 40], ['pebble', 26]],
    liquid: 'water', liquidColor: ['#137c9a', '#5fe0dc', '#e6dcb0'], secondPool: true,
    big: ['palm', 'tree', 'palm'], mid: ['coral', 'bush', 'rock', 'coral'], small: ['coral', 'crystal', 'boulder', 'bush'], feature: ['coral', 'crystal'],
    ambient: 'glint', cloud: '#052a2c',
  },
  { // 龍之谷:焦土、岩漿、龍骨、火星
    ground: ['#291714', '#48281f', '#6c3e2f'], road: ['#8d6c58', '#33221c', '#6c5142'], roadStyle: 'dirt',
    tuft: ['#8a6038', '#5a3a26'], flowers: ['#ff7a3d'],
    scatter: [['crack', 30], ['pebble', 70], ['bone', 16], ['grass', 44]],
    liquid: 'lava', liquidColor: ['#c22a0a', '#ffb02e', '#1c110e'], secondPool: false,
    big: ['deadtree', 'deadtree', 'lavarock'], mid: ['lavarock', 'bones', 'rock', 'lavarock'], small: ['lavarock', 'bones', 'torch', 'boulder'], feature: ['bones', 'lavarock'],
    ambient: 'embers', cloud: '#1a0604',
  },
  { // 歐瑞:雪原、冰湖、雪松、飄雪
    ground: ['#8aa2b3', '#b8ccd8', '#eaf2f6'], road: ['#a4b6c4', '#566c7f', '#8094a5'], roadStyle: 'snow',
    tuft: ['#a8c2ce', '#7d9cac'], flowers: ['#ffffff'],
    scatter: [['drift', 52], ['pebble', 26], ['grass', 30]],
    liquid: 'ice', liquidColor: ['#7fb4d6', '#dff4ff', '#f4f9fc'], secondPool: false,
    big: ['snowtree', 'snowtree', 'icespike'], mid: ['snowtree', 'icespike', 'rock', 'snowtree'], small: ['icespike', 'snowman', 'crystal', 'boulder'], feature: ['crystal', 'icespike'],
    ambient: 'snow', cloud: '#30465a',
  },
]
export const THEME_COUNT = THEMES.length

/** 用圖片的擺設(public/aegis/td/decor_<名字>.webp);其他名字是下面用畫的 */
export const DECOR_SPRITES = ['tree', 'autumn', 'pine', 'bush', 'deadtree', 'stump', 'snowtree', 'house', 'tent', 'campfire', 'torch', 'gems', 'rock'] as const
/** 每種擺設畫多高(邏輯像素);沒列的照它那一格的大小 */
const PROP_H: Record<string, number> = {
  tree: 112, autumn: 112, pine: 104, snowtree: 104, deadtree: 104, palm: 108, bush: 50, stump: 44, house: 128, tent: 82,
  campfire: 40, torch: 44, gems: 44, rock: 56, pillar: 78, banner: 70, cactus: 52, lavarock: 46, icespike: 60, coral: 40,
  bones: 40, boulder: 26, crate: 30, fence: 30, crystal: 46, snowman: 38,
}
/** 會發光的擺設:顏色與光暈大小 */
const PROP_LIGHT: Record<string, [string, number]> = {
  campfire: ['#ff9a3d', 46], torch: ['#ff9a3d', 44], gems: ['#9fd8ff', 30], crystal: ['#8fd0ff', 40], lavarock: ['#ff6a1f', 40],
}

interface Anchor { x: number; y: number; size: 'big' | 'mid' | 'small' | 'feature' | 'feature2' }
// 擺設放哪:都挑在路、塔位、女神像碰不到的空地(上緣、下緣、左邊、右邊,和塔位之間的縫)
const ANCHORS: Anchor[] = [
  // 上緣(在第一排路後面)
  { x: 112, y: 50, size: 'big' }, { x: 196, y: 56, size: 'mid' }, { x: 286, y: 46, size: 'big' }, { x: 372, y: 55, size: 'mid' },
  { x: 590, y: 52, size: 'mid' }, { x: 676, y: 47, size: 'big' }, { x: 766, y: 55, size: 'mid' }, { x: 864, y: 49, size: 'big' }, { x: 958, y: 58, size: 'mid' },
  { x: 30, y: -8, size: 'mid' }, { x: 236, y: -14, size: 'small' }, { x: 420, y: -6, size: 'small' }, { x: 546, y: -10, size: 'small' }, { x: 720, y: -12, size: 'small' }, { x: 920, y: -10, size: 'mid' },
  // 左邊
  { x: 52, y: 246, size: 'big' }, { x: 120, y: 258, size: 'mid' }, { x: 100, y: 172, size: 'small' }, { x: 26, y: 168, size: 'small' },
  { x: 28, y: 424, size: 'small' }, { x: 136, y: 420, size: 'small' },
  // 下緣(在最後一排路前面,所以都不高,頂端不會蓋到路)
  { x: 232, y: 596, size: 'big' }, { x: 318, y: 548, size: 'small' }, { x: 396, y: 598, size: 'big' }, { x: 470, y: 572, size: 'mid' },
  { x: 650, y: 598, size: 'big' }, { x: 728, y: 568, size: 'mid' }, { x: 806, y: 598, size: 'big' }, { x: 868, y: 560, size: 'small' },
  { x: 150, y: 592, size: 'mid' }, { x: 978, y: 592, size: 'mid' },
  // 右邊
  { x: 928, y: 336, size: 'feature' }, { x: 872, y: 392, size: 'feature2' }, { x: 978, y: 150, size: 'mid' }, { x: 986, y: 396, size: 'small' },
  // 塔位之間的縫
  { x: 340, y: 214, size: 'small' }, { x: 522, y: 160, size: 'small' }, { x: 674, y: 226, size: 'small' },
  { x: 360, y: 398, size: 'small' }, { x: 540, y: 340, size: 'small' }, { x: 716, y: 404, size: 'small' },
]
const SIZE_H = { big: 108, mid: 62, small: 30, feature: 124, feature2: 40 }
// 下緣的大樹頂端不能蓋到最後一排路(路中心 y=450,路寬一半 30)
const MAX_TOP = 488

export interface Liquid { path: Path2D; cx: number; cy: number; rx: number; ry: number; kind: 'water' | 'lava' | 'ice'; seed: number }
export interface Light { x: number; y: number; r: number; color: string }
export interface Terrain { canvas: HTMLCanvasElement; liquids: Liquid[]; lights: Light[]; chapter: number }

// ===================== 幾何 =====================

/** (x, y) 離路線最近多遠 */
function distToPath(cfg: TdConfig, x: number, y: number) {
  let best = 1e9
  for (let i = 0; i < cfg.path.length - 1; i++) {
    const a = cfg.path[i] as number[], b = cfg.path[i + 1] as number[]
    let ax = a[0] ?? 0
    const ay = a[1] ?? 0, bx = b[0] ?? 0, by = b[1] ?? 0
    if (i === 0) ax -= 60      // 入口那段一路延伸到畫面外
    const dx = bx - ax, dy = by - ay
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
    const d = Math.hypot(x - (ax + dx * k), y - (ay + dy * k))
    if (d < best) best = d
  }
  return best
}

function blobPath(cx: number, cy: number, rx: number, ry: number, seed: number, scale = 1): Path2D {
  const rnd = rng(seed)
  const p1 = rnd() * 6.28, p2 = rnd() * 6.28
  const p = new Path2D()
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const k = scale * (1 + 0.1 * Math.sin(3 * a + p1) + 0.06 * Math.sin(5 * a + p2))
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k
    if (i === 0) p.moveTo(x, y); else p.lineTo(x, y)
  }
  p.closePath()
  return p
}

/** 路面的形狀(每段一個長方形 + 轉角一個圓,合起來就是圓角的粗線):拿來 clip,路面的紋理就不會畫出路外 */
function roadShape(cfg: TdConfig, halfW: number): Path2D {
  const p = new Path2D()
  for (let i = 0; i < cfg.path.length - 1; i++) {
    const a = cfg.path[i] as number[], b = cfg.path[i + 1] as number[]
    const [ax, ay] = i === 0 ? entrancePoint(cfg, 40) : [a[0] ?? 0, a[1] ?? 0], bx = b[0] ?? 0, by = b[1] ?? 0
    p.rect(Math.min(ax, bx) - (ay === by ? 0 : halfW), Math.min(ay, by) - (ax === bx ? 0 : halfW), Math.abs(bx - ax) + (ay === by ? 0 : halfW * 2), Math.abs(by - ay) + (ax === bx ? 0 : halfW * 2))
    p.moveTo(bx + halfW, by); p.arc(bx, by, halfW, 0, Math.PI * 2)
    if (i === 0) { p.moveTo(ax + halfW, ay); p.arc(ax, ay, halfW, 0, Math.PI * 2) }
  }
  return p
}

/** 入口朝哪邊:從第二個折點指向第一個折點的單位向量(路從畫布外進來的方向) */
function entranceDir(cfg: TdConfig): [number, number] {
  const a = cfg.path[0] as number[], b = cfg.path[1] as number[]
  const dx = (a[0] ?? 0) - (b[0] ?? 0), dy = (a[1] ?? 0) - (b[1] ?? 0)
  const len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len]
}
/** 入口往畫布外延伸 back 的那一點(路要畫到畫布外,入口才不會是圓頭) */
function entrancePoint(cfg: TdConfig, back: number): [number, number] {
  const p0 = cfg.path[0] as number[], [dx, dy] = entranceDir(cfg)
  return [(p0[0] ?? 0) + dx * back, (p0[1] ?? 0) + dy * back]
}

function tracePath(c: CanvasRenderingContext2D, cfg: TdConfig) {
  c.beginPath()
  const [ex, ey] = entrancePoint(cfg, 40)
  cfg.path.forEach((p, i) => (i === 0 ? c.moveTo(ex, ey) : c.lineTo(p[0] ?? 0, p[1] ?? 0)))
}
function strokeRoad(c: CanvasRenderingContext2D, cfg: TdConfig, w: number, color: string | CanvasGradient) {
  c.strokeStyle = color; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'
  tracePath(c, cfg)
  c.stroke()
}

// ===================== 地表 =====================

/** 一張小小的雜訊圖,放大之後就是深淺不一的地表 */
function noiseLayer(seed: number, ramp: [string, string, string]): HTMLCanvasElement {
  const w = 200, h = 120, G = 34
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const c = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  const img = c.createImageData(w, h)
  const rnd = rng(seed)
  const grid: number[] = []
  for (let i = 0; i < G * G; i++) grid.push(rnd())
  const at = (gx: number, gy: number) => grid[(gy % G) * G + (gx % G)] ?? 0
  const sample = (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y)
    const fx = x - x0, fy = y - y0
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const a = at(x0, y0), b = at(x0 + 1, y0), d = at(x0, y0 + 1), e = at(x0 + 1, y0 + 1)
    return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy
  }
  const cols = ramp.map(rgb) as [number, number, number][]
  const c0 = cols[0] as number[], c1 = cols[1] as number[], c2 = cols[2] as number[]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h
      let n = sample(u * 5, v * 3) * 0.55 + sample(u * 11 + 7, v * 6.6 + 3) * 0.3 + sample(u * 25 + 13, v * 15 + 5) * 0.15
      n += (0.5 - (u + v) / 2) * 0.22          // 光從左上來,左上亮一點
      n = Math.max(0, Math.min(1, (n - 0.5) * 1.7 + 0.5))
      const lo = n < 0.5 ? c0 : c1, hi = n < 0.5 ? c1 : c2, k = n < 0.5 ? n * 2 : (n - 0.5) * 2
      const o = (y * w + x) * 4
      img.data[o] = (lo[0] ?? 0) + ((hi[0] ?? 0) - (lo[0] ?? 0)) * k
      img.data[o + 1] = (lo[1] ?? 0) + ((hi[1] ?? 0) - (lo[1] ?? 0)) * k
      img.data[o + 2] = (lo[2] ?? 0) + ((hi[2] ?? 0) - (lo[2] ?? 0)) * k
      img.data[o + 3] = 255
    }
  }
  c.putImageData(img, 0, 0)
  return cv
}

type C2 = CanvasRenderingContext2D
type Rnd = () => number

function ellipse(c: C2, x: number, y: number, rx: number, ry: number, fill: string) {
  c.fillStyle = fill
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill()
}

// ---- 散在地上的小東西 ----

function grass(c: C2, x: number, y: number, s: number, a: string, b: string, rnd: Rnd) {
  const n = 3 + Math.floor(rnd() * 3)
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * s * 0.55, lean = (rnd() - 0.5) * s * 1.2, h = s * (1.5 + rnd() * 1.3)
    c.fillStyle = i % 2 ? a : b
    c.beginPath()
    c.moveTo(x + dx - s * 0.24, y)
    c.quadraticCurveTo(x + dx + lean * 0.25, y - h * 0.6, x + dx + lean, y - h)
    c.quadraticCurveTo(x + dx + lean * 0.55, y - h * 0.45, x + dx + s * 0.24, y)
    c.fill()
  }
}
function flower(c: C2, x: number, y: number, color: string, leaf: string, rnd: Rnd) {
  c.strokeStyle = leaf; c.lineWidth = 1
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 2, y - 5); c.stroke()
  c.fillStyle = color
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    c.beginPath(); c.arc(x + Math.cos(a) * 1.9, y - 6 + Math.sin(a) * 1.9, 1.5, 0, Math.PI * 2); c.fill()
  }
  c.fillStyle = '#ffcf3d'
  c.beginPath(); c.arc(x, y - 6, 1.1, 0, Math.PI * 2); c.fill()
}
function pebble(c: C2, x: number, y: number, s: number, color: string) {
  ellipse(c, x + 1, y + s * 0.35, s * 1.05, s * 0.5, 'rgba(0,0,0,0.25)')
  ellipse(c, x, y, s, s * 0.68, color)
  ellipse(c, x - s * 0.25, y - s * 0.2, s * 0.45, s * 0.26, lighten(color, 0.35))
}
function mushroom(c: C2, x: number, y: number) {
  c.fillStyle = '#f3ead8'
  c.fillRect(x - 1.4, y - 5, 2.8, 5)
  c.fillStyle = '#d8433a'
  c.beginPath(); c.ellipse(x, y - 5, 5, 3.6, 0, Math.PI, 0); c.fill()
  c.fillStyle = '#ffffff'
  c.beginPath(); c.arc(x - 2, y - 6.4, 0.9, 0, Math.PI * 2); c.arc(x + 1.6, y - 7, 0.8, 0, Math.PI * 2); c.fill()
}
function shell(c: C2, x: number, y: number, color: string) {
  c.fillStyle = color
  c.beginPath(); c.moveTo(x, y); c.arc(x, y, 4.6, Math.PI * 1.1, Math.PI * 1.9); c.closePath(); c.fill()
  c.strokeStyle = 'rgba(120,80,60,0.5)'; c.lineWidth = 0.6
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + i * 2.6, y - 4.2); c.stroke() }
}
function bone(c: C2, x: number, y: number, rnd: Rnd) {
  const a = rnd() * Math.PI, l = 5 + rnd() * 4
  const dx = Math.cos(a) * l, dy = Math.sin(a) * l * 0.5
  c.strokeStyle = '#e9e2cf'; c.lineWidth = 2; c.lineCap = 'round'
  c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke()
  c.fillStyle = '#e9e2cf'
  for (const k of [-1, 1]) { c.beginPath(); c.arc(x + dx * k, y + dy * k - 1, 1.5, 0, Math.PI * 2); c.arc(x + dx * k, y + dy * k + 1, 1.5, 0, Math.PI * 2); c.fill() }
}
function crack(c: C2, x: number, y: number, rnd: Rnd) {
  const pts: [number, number][] = [[x, y]]
  let a = rnd() * Math.PI * 2, px = x, py = y
  for (let i = 0; i < 4 + Math.floor(rnd() * 3); i++) {
    a += (rnd() - 0.5) * 1.3
    px += Math.cos(a) * (7 + rnd() * 9); py += Math.sin(a) * (4 + rnd() * 6)
    pts.push([px, py])
  }
  const line = (w: number, color: string) => {
    c.strokeStyle = color; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'
    c.beginPath()
    pts.forEach(([qx, qy], i) => (i === 0 ? c.moveTo(qx, qy) : c.lineTo(qx, qy)))
    c.stroke()
  }
  line(5, 'rgba(255,90,20,0.16)'); line(2.6, '#7a1c08'); line(1.1, '#ffb347')
}
function drift(c: C2, x: number, y: number, s: number) {
  ellipse(c, x + 2, y + s * 0.22, s * 1.05, s * 0.34, 'rgba(70,100,130,0.22)')
  ellipse(c, x, y, s, s * 0.36, '#f7fbfd')
  ellipse(c, x - s * 0.2, y - s * 0.08, s * 0.5, s * 0.16, '#ffffff')
}
function slab(c: C2, x: number, y: number, s: number, color: string, rnd: Rnd) {
  const w = s * (1.2 + rnd()), h = s * (0.6 + rnd() * 0.4)
  c.fillStyle = 'rgba(0,0,0,0.22)'
  c.beginPath(); c.roundRect(x - w / 2 + 1, y - h / 2 + 1.5, w, h, 2); c.fill()
  c.fillStyle = color
  c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 2); c.fill()
  c.fillStyle = 'rgba(255,255,255,0.12)'
  c.fillRect(x - w / 2 + 1, y - h / 2 + 0.6, w - 2, 1.2)
}
function dune(c: C2, x: number, y: number, s: number) {
  c.lineCap = 'round'
  c.strokeStyle = 'rgba(255,246,210,0.42)'; c.lineWidth = 1.6
  c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x, y - s * 0.3, x + s, y); c.stroke()
  c.strokeStyle = 'rgba(110,80,30,0.2)'; c.lineWidth = 1.4
  c.beginPath(); c.moveTo(x - s, y + 2); c.quadraticCurveTo(x, y - s * 0.3 + 2.4, x + s, y + 2); c.stroke()
}

// ---- 用畫的擺設(腳底在 (0, 0),高度大約 h) ----

const INK = '#1d1a17'
function poly(c: C2, pts: number[], fill: string, stroke = true) {
  c.beginPath()
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) c.moveTo(pts[i] ?? 0, pts[i + 1] ?? 0); else c.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0)
  }
  c.closePath()
  c.fillStyle = fill; c.fill()
  if (stroke) { c.strokeStyle = INK; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke() }
}

function boulder(c: C2, h: number, color: string, rnd: Rnd) {
  const w = h * (1.25 + rnd() * 0.4)
  poly(c, [-w * 0.5, 0, -w * 0.42, -h * 0.55, -w * 0.12, -h, w * 0.26, -h * 0.9, w * 0.5, -h * 0.4, w * 0.44, 0], color)
  poly(c, [-w * 0.42, -h * 0.55, -w * 0.12, -h, w * 0.26, -h * 0.9, w * 0.04, -h * 0.5], lighten(color, 0.28), false)
  poly(c, [w * 0.04, -h * 0.5, w * 0.26, -h * 0.9, w * 0.5, -h * 0.4, w * 0.44, 0, w * 0.1, 0], darken(color, 0.22), false)
}
function palm(c: C2, h: number, rnd: Rnd) {
  const lean = (rnd() - 0.5) * h * 0.4
  c.lineCap = 'round'
  c.strokeStyle = INK; c.lineWidth = h * 0.1 + 3
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * 0.2, -h * 0.5, lean, -h * 0.8); c.stroke()
  c.strokeStyle = '#9a6c3a'; c.lineWidth = h * 0.1
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * 0.2, -h * 0.5, lean, -h * 0.8); c.stroke()
  c.strokeStyle = 'rgba(60,36,14,0.5)'; c.lineWidth = 1.2
  for (let i = 1; i < 7; i++) {
    const k = i / 7, x = lean * k * k * 0.6 + lean * 0.4 * k * k, y = -h * 0.8 * k
    c.beginPath(); c.moveTo(x - h * 0.05, y); c.lineTo(x + h * 0.05, y - 1.5); c.stroke()
  }
  const cx = lean, cy = -h * 0.8
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.5 + (i - 3) * 0.52, len = h * (0.42 + (i % 2) * 0.06)
      const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len * 0.75 + len * 0.42
      const mx = cx + Math.cos(a) * len * 0.55, my = cy + Math.sin(a) * len * 0.75 - len * 0.12
      c.beginPath(); c.moveTo(cx, cy); c.quadraticCurveTo(mx, my - 5, ex, ey); c.quadraticCurveTo(mx, my + 6, cx, cy)
      if (pass === 0) { c.strokeStyle = INK; c.lineWidth = 3; c.stroke() }
      else { c.fillStyle = i % 2 ? '#5aa646' : '#3f8a3c'; c.fill() }
    }
  }
  c.fillStyle = '#7a4a22'
  c.beginPath(); c.arc(cx - 3, cy + 3, 3, 0, Math.PI * 2); c.arc(cx + 3, cy + 4, 3, 0, Math.PI * 2); c.fill()
}
function cactus(c: C2, h: number) {
  const w = h * 0.26
  const part = (x: number, y0: number, y1: number, ww: number) => {
    c.beginPath(); c.roundRect(x - ww / 2, y1, ww, y0 - y1, ww / 2)
    c.fillStyle = '#4f9a4a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke()
    c.fillStyle = 'rgba(255,255,255,0.22)'
    c.fillRect(x - ww * 0.25, y1 + ww * 0.4, ww * 0.16, (y0 - y1) - ww * 0.8)
  }
  part(-w * 1.25, -h * 0.34, -h * 0.72, w * 0.7)
  part(w * 1.25, -h * 0.46, -h * 0.86, w * 0.7)
  c.strokeStyle = INK; c.lineWidth = w * 0.7 + 3; c.lineCap = 'round'
  c.beginPath(); c.moveTo(-w * 1.25, -h * 0.4); c.lineTo(0, -h * 0.4); c.moveTo(w * 1.25, -h * 0.52); c.lineTo(0, -h * 0.52); c.stroke()
  c.strokeStyle = '#4f9a4a'; c.lineWidth = w * 0.7
  c.beginPath(); c.moveTo(-w * 1.25, -h * 0.4); c.lineTo(0, -h * 0.4); c.moveTo(w * 1.25, -h * 0.52); c.lineTo(0, -h * 0.52); c.stroke()
  part(0, 0, -h, w)
  c.fillStyle = '#ff7a9a'
  c.beginPath(); c.arc(0, -h, 2.6, 0, Math.PI * 2); c.fill()
}
function pillar(c: C2, h: number, rnd: Rnd) {
  const w = h * 0.3
  poly(c, [-w * 0.85, 0, -w * 0.85, -h * 0.1, w * 0.85, -h * 0.1, w * 0.85, 0], '#8f8a7c')
  const top = [-w * 0.6, -h * 0.1, -w * 0.6, -h * (0.8 + rnd() * 0.15), -w * 0.2, -h * (0.9 + rnd() * 0.1), w * 0.15, -h * (0.7 + rnd() * 0.15), w * 0.6, -h * (0.85 + rnd() * 0.1), w * 0.6, -h * 0.1]
  poly(c, top, '#b9b3a2')
  c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1.2
  for (const k of [-0.3, 0, 0.3]) { c.beginPath(); c.moveTo(w * k, -h * 0.14); c.lineTo(w * k, -h * 0.66); c.stroke() }
  c.fillStyle = 'rgba(255,255,255,0.2)'
  c.fillRect(-w * 0.52, -h * 0.66, w * 0.16, h * 0.52)
  c.fillStyle = '#6f9450'
  c.beginPath(); c.ellipse(-w * 0.5, -h * 0.1, w * 0.4, 3, 0, 0, Math.PI * 2); c.ellipse(w * 0.35, -h * 0.42, w * 0.22, 2.4, 0, 0, Math.PI * 2); c.fill()
}
function banner(c: C2, h: number) {
  c.strokeStyle = INK; c.lineWidth = 4.4; c.lineCap = 'round'
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -h); c.stroke()
  c.strokeStyle = '#8a6a3c'; c.lineWidth = 2.4
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -h); c.stroke()
  poly(c, [1, -h * 0.96, h * 0.42, -h * 0.9, h * 0.36, -h * 0.66, h * 0.44, -h * 0.44, 1, -h * 0.5], '#b8322c')
  poly(c, [h * 0.12, -h * 0.82, h * 0.26, -h * 0.72, h * 0.12, -h * 0.62], '#f1d98a', false)
  c.fillStyle = '#f1d98a'
  c.beginPath(); c.arc(0, -h, 3, 0, Math.PI * 2); c.fill()
}
function lavarock(c: C2, h: number, rnd: Rnd) {
  boulder(c, h, '#3a2a26', rnd)
  c.strokeStyle = '#ff7a1f'; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round'
  c.beginPath()
  c.moveTo(-h * 0.3, -h * 0.2); c.lineTo(-h * 0.08, -h * 0.5); c.lineTo(h * 0.1, -h * 0.36); c.lineTo(h * 0.3, -h * 0.62)
  c.moveTo(-h * 0.08, -h * 0.5); c.lineTo(-h * 0.14, -h * 0.8)
  c.stroke()
  c.strokeStyle = '#ffe08a'; c.lineWidth = 0.8
  c.stroke()
}
function icespike(c: C2, h: number, rnd: Rnd) {
  const spikes: [number, number, number][] = [[-h * 0.26, h * 0.62, -0.2], [h * 0.24, h * 0.74, 0.16], [0, h, 0.02], [-h * 0.1, h * 0.42, -0.34], [h * 0.12, h * 0.36, 0.36]]
  for (const [x, hh, lean] of spikes) {
    const w = hh * (0.2 + rnd() * 0.05), tx = x + lean * hh
    poly(c, [x - w, 0, tx, -hh, x + w, 0], '#a9dcf4')
    poly(c, [x - w * 0.1, 0, tx, -hh, x + w, 0], '#e8f8ff', false)
    poly(c, [x - w, 0, tx, -hh, x - w * 0.5, 0], '#7dbfe0', false)
  }
}
function coral(c: C2, h: number, rnd: Rnd) {
  const color = rnd() > 0.5 ? '#ff7f9a' : '#ff9a5a'
  const branch = (x: number, y: number, a: number, len: number, depth: number, w: number, ink: boolean) => {
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len
    c.strokeStyle = ink ? INK : color; c.lineWidth = w + (ink ? 3 : 0); c.lineCap = 'round'
    c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke()
    if (depth > 0) { branch(ex, ey, a - 0.5, len * 0.68, depth - 1, w * 0.78, ink); branch(ex, ey, a + 0.45, len * 0.62, depth - 1, w * 0.78, ink) }
  }
  for (const ink of [true, false]) {
    branch(0, 0, -Math.PI / 2, h * 0.38, 2, h * 0.13, ink)
    branch(-h * 0.2, 0, -Math.PI / 2 - 0.5, h * 0.26, 1, h * 0.1, ink)
    branch(h * 0.2, 0, -Math.PI / 2 + 0.55, h * 0.24, 1, h * 0.1, ink)
  }
  ellipse(c, 0, 1, h * 0.42, h * 0.1, '#cfc7a8')
}
function bones(c: C2, h: number) {
  c.lineCap = 'round'
  for (const ink of [true, false]) {
    c.strokeStyle = ink ? INK : '#ece5d0'
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * h * 0.24, hh = h * (0.95 - Math.abs(i - 2) * 0.16)
      c.lineWidth = (ink ? 3 : 0) + h * 0.075
      c.beginPath(); c.moveTo(x - h * 0.02, 0); c.quadraticCurveTo(x - h * 0.16, -hh * 0.75, x + h * 0.12, -hh); c.stroke()
    }
    c.lineWidth = (ink ? 3 : 0) + h * 0.09
    c.beginPath(); c.moveTo(-h * 0.62, -h * 0.02); c.lineTo(h * 0.62, -h * 0.02); c.stroke()
  }
}
function crate(c: C2, h: number) {
  const w = h * 0.95
  poly(c, [-w / 2, 0, -w / 2, -h * 0.8, w / 2, -h * 0.8, w / 2, 0], '#a9783f')
  poly(c, [-w / 2, -h * 0.8, -w * 0.3, -h, w * 0.7, -h, w / 2, -h * 0.8], '#c99a58')
  poly(c, [w / 2, 0, w / 2, -h * 0.8, w * 0.7, -h, w * 0.7, -h * 0.2], '#7d5528')
  c.strokeStyle = 'rgba(40,22,8,0.55)'; c.lineWidth = 1.4
  c.beginPath(); c.moveTo(-w / 2, -h * 0.4); c.lineTo(w / 2, -h * 0.4); c.moveTo(-w / 2, 0); c.lineTo(w / 2, -h * 0.8); c.stroke()
}
function fence(c: C2, h: number) {
  const w = h * 2.2
  c.lineCap = 'round'
  for (const ink of [true, false]) {
    c.strokeStyle = ink ? INK : '#b98d55'
    c.lineWidth = (ink ? 3 : 0) + 3
    c.beginPath(); c.moveTo(-w / 2, -h * 0.35); c.lineTo(w / 2, -h * 0.35); c.moveTo(-w / 2, -h * 0.7); c.lineTo(w / 2, -h * 0.7); c.stroke()
    c.lineWidth = (ink ? 3 : 0) + 4
    for (let i = 0; i < 4; i++) { const x = -w / 2 + (w * i) / 3; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, -h); c.stroke() }
  }
}
function crystal(c: C2, h: number, rnd: Rnd) {
  const shards: [number, number, number][] = [[-h * 0.24, h * 0.6, -0.28], [h * 0.22, h * 0.7, 0.24], [0, h, 0]]
  poly(c, [-h * 0.5, 0, -h * 0.36, -h * 0.16, h * 0.36, -h * 0.16, h * 0.5, 0], '#6a6a78')
  for (const [x, hh, lean] of shards) {
    const w = hh * (0.2 + rnd() * 0.04), tx = x + lean * hh
    poly(c, [x - w, -h * 0.08, x - w * 1.1 + lean * hh * 0.6, -hh * 0.62, tx, -hh, x + w * 1.1 + lean * hh * 0.6, -hh * 0.62, x + w, -h * 0.08], '#6ab8ff')
    poly(c, [x, -h * 0.08, tx, -hh, x + w * 1.1 + lean * hh * 0.6, -hh * 0.62, x + w, -h * 0.08], '#c9ecff', false)
  }
}
function snowman(c: C2, h: number) {
  c.fillStyle = '#ffffff'; c.strokeStyle = INK; c.lineWidth = 1.6
  c.beginPath(); c.arc(0, -h * 0.3, h * 0.3, 0, Math.PI * 2); c.fill(); c.stroke()
  c.beginPath(); c.arc(0, -h * 0.74, h * 0.22, 0, Math.PI * 2); c.fill(); c.stroke()
  c.fillStyle = INK
  c.beginPath(); c.arc(-h * 0.08, -h * 0.78, 1.5, 0, Math.PI * 2); c.arc(h * 0.08, -h * 0.78, 1.5, 0, Math.PI * 2); c.fill()
  poly(c, [0, -h * 0.72, h * 0.2, -h * 0.68, 0, -h * 0.66], '#ff8a3d', false)
  c.strokeStyle = '#c0392b'; c.lineWidth = 3
  c.beginPath(); c.arc(0, -h * 0.74, h * 0.2, 0.5, 2.6); c.stroke()
}

// ===================== 底圖 =====================

/**
 * 畫一張場景的底圖。reuse = 上一張底圖的畫布:尺寸一樣就直接畫在它上面,不另外新建
 * (手機 Chrome 的 GPU 記憶體有限,換場景一直新建大畫布,會把正在用的主畫布擠掉變成整片透明)
 */
export function renderTerrain(cfg: TdConfig, chapter: number, pxWidth: number, decor: Record<string, HTMLImageElement>, reuse: HTMLCanvasElement | null = null): Terrain {
  const th = THEMES[chapter % THEMES.length] as Theme
  const height = Math.round((pxWidth * VH) / W)
  const cv = reuse && reuse.width === pxWidth && reuse.height === height ? reuse : document.createElement('canvas')
  if (cv !== reuse) { cv.width = pxWidth; cv.height = height }
  // 底圖用 CPU 畫:一次幾千個小筆畫(草、石頭、路面顆粒)一口氣丟給手機 GPU 會讓它重置,所有畫布一起清空
  const c = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, cv.width, cv.height)
  c.globalAlpha = 1
  c.globalCompositeOperation = 'source-over'
  const k = cv.width / W
  // 底圖涵蓋 y = -TOP ~ H;下面都用地圖座標畫
  const world = () => c.setTransform(k, 0, 0, k, 0, k * TOP)
  world()
  const ry = () => -TOP + rnd() * VH
  const rnd = rng(1234567 + chapter * 7919)
  const liquids: Liquid[] = []
  const lights: Light[] = []

  // ---- 地表 ----
  c.imageSmoothingEnabled = true
  c.imageSmoothingQuality = 'high'
  c.drawImage(noiseLayer(4242 + chapter * 131, th.ground), 0, -TOP, W, VH)
  for (let i = 0; i < 150; i++) {
    const x = rnd() * W, y = ry(), r = 8 + rnd() * 26
    c.globalAlpha = 0.03 + rnd() * 0.05
    ellipse(c, x, y, r * 1.7, r, rnd() > 0.5 ? '#000000' : '#ffffff')
  }
  c.globalAlpha = 1

  // ---- 水池 / 岩漿 / 冰湖 ----
  // 水池的位置是固定的,壓到這張地圖的路或塔位就不畫
  const poolOk = ([cx, cy, rx, ry]: [number, number, number, number]) =>
    distToPath(cfg, cx, cy) > rx + 40 && !cfg.slots.some((sl) => Math.abs((sl[0] ?? 0) - cx) < rx + 44 && Math.abs((sl[1] ?? 0) - cy) < ry + 30)
  const pools: [number, number, number, number][] = ([[70, 506, 64, 58]] as [number, number, number, number][]).filter(poolOk)
  if (th.secondPool && poolOk([930, 290, 52, 62])) pools.push([930, 290, 52, 62])
  pools.forEach(([cx, cy, rx, ry], i) => {
    const seed = 77 + chapter * 13 + i * 5
    const path = blobPath(cx, cy, rx, ry, seed)
    liquids.push({ path, cx, cy, rx, ry, kind: th.liquid, seed })
    c.fillStyle = 'rgba(0,0,0,0.22)'
    c.fill(blobPath(cx, cy + 3, rx, ry, seed, 1.16))
    c.fillStyle = th.liquidColor[2]
    c.fill(blobPath(cx, cy, rx, ry, seed, 1.12))
    c.fillStyle = darken(th.liquidColor[0], 0.35)
    c.fill(blobPath(cx, cy - 1, rx, ry, seed, 1.03))
    const g = c.createRadialGradient(cx - rx * 0.2, cy - ry * 0.25, 4, cx, cy, Math.max(rx, ry) * 1.1)
    if (th.liquid === 'lava') { g.addColorStop(0, '#ffe98a'); g.addColorStop(0.45, th.liquidColor[1]); g.addColorStop(1, th.liquidColor[0]) }
    else { g.addColorStop(0, th.liquidColor[1]); g.addColorStop(1, th.liquidColor[0]) }
    c.fillStyle = g
    c.fill(blobPath(cx, cy + 2, rx, ry, seed, 0.97))
    c.save()
    c.clip(path)
    if (th.liquid === 'water') {
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.3; c.lineCap = 'round'
      for (let j = 0; j < 9; j++) {
        const x = cx + (rnd() - 0.5) * rx * 1.5, y = cy + (rnd() - 0.5) * ry * 1.5, l = 6 + rnd() * 12
        c.beginPath(); c.moveTo(x - l, y); c.quadraticCurveTo(x, y - 2.4, x + l, y); c.stroke()
      }
      if (chapter === 0 || chapter === 1) {    // 荷葉
        for (let j = 0; j < 5; j++) {
          const x = cx + (rnd() - 0.5) * rx * 1.3, y = cy + (rnd() - 0.5) * ry * 1.2, r = 5 + rnd() * 4
          c.fillStyle = '#2f7a3a'
          c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0, 0.5, Math.PI * 2); c.lineTo(x, y); c.fill()
          if (j % 2 === 0) { c.fillStyle = '#ffc0d8'; c.beginPath(); c.arc(x + 1, y - 1.5, 2, 0, Math.PI * 2); c.fill() }
        }
      }
    } else if (th.liquid === 'lava') {
      for (let j = 0; j < 9; j++) {              // 浮在上面的黑色熔渣
        const x = cx + (rnd() - 0.5) * rx * 1.7, y = cy + (rnd() - 0.5) * ry * 1.7, r = 5 + rnd() * 10
        c.fillStyle = 'rgba(40,14,8,0.75)'
        c.beginPath(); c.ellipse(x, y, r, r * 0.55, rnd() * 3, 0, Math.PI * 2); c.fill()
      }
    } else {
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1
      for (let j = 0; j < 7; j++) {              // 冰面的裂紋
        let x = cx + (rnd() - 0.5) * rx * 1.4, y = cy + (rnd() - 0.5) * ry * 1.4, a = rnd() * 6.28
        c.beginPath(); c.moveTo(x, y)
        for (let s = 0; s < 4; s++) { a += (rnd() - 0.5) * 1.4; x += Math.cos(a) * 12; y += Math.sin(a) * 9; c.lineTo(x, y) }
        c.stroke()
      }
      c.fillStyle = 'rgba(255,255,255,0.32)'
      c.beginPath(); c.moveTo(cx - rx, cy - ry * 0.2); c.lineTo(cx - rx * 0.2, cy - ry); c.lineTo(cx, cy - ry); c.lineTo(cx - rx, cy + ry * 0.1); c.fill()
    }
    c.restore()
  })
  const inPool = (x: number, y: number, pad: number) => pools.some(([cx, cy, rx, ry]) => ((x - cx) / (rx * 1.2 + pad)) ** 2 + ((y - cy) / (ry * 1.2 + pad)) ** 2 < 1)

  // ---- 散在地上的小東西(先畫,路會蓋掉壓到路的)----
  const gx = cfg.goddess[0] ?? 945, gy = (cfg.goddess[1] ?? 450) + 36
  const blocked = (x: number, y: number, road: number) => {
    if (distToPath(cfg, x, y) < road) return true
    if (inPool(x, y, 4)) return true
    if (((x - gx) / 74) ** 2 + ((y - gy) / 42) ** 2 < 1) return true
    return cfg.slots.some((s) => ((x - (s[0] ?? 0)) / 34) ** 2 + ((y - (s[1] ?? 0)) / 18) ** 2 < 1)
  }
  for (const [kind, count] of th.scatter) {
    for (let i = 0; i < count * 1.1; i++) {
      const x = rnd() * W, y = ry()
      if (blocked(x, y, kind === 'crack' || kind === 'slab' ? 40 : 33)) continue
      if (kind === 'grass') grass(c, x, y, 2.6 + rnd() * 2.6, th.tuft[0], th.tuft[1], rnd)
      else if (kind === 'flower') { grass(c, x - 3, y + 1, 2.2, th.tuft[0], th.tuft[1], rnd); flower(c, x, y, th.flowers[Math.floor(rnd() * th.flowers.length)] ?? '#fff', th.tuft[1], rnd) }
      else if (kind === 'pebble') pebble(c, x, y, 2 + rnd() * 3.4, mix(th.road[1], th.ground[2], 0.35 + rnd() * 0.4))
      else if (kind === 'mushroom') mushroom(c, x, y)
      else if (kind === 'shell') shell(c, x, y, rnd() > 0.5 ? '#ffe2d2' : '#ffd0e0')
      else if (kind === 'bone') bone(c, x, y, rnd)
      else if (kind === 'crack') crack(c, x, y, rnd)
      else if (kind === 'drift') drift(c, x, y, 9 + rnd() * 16)
      else if (kind === 'slab') slab(c, x, y, 9 + rnd() * 8, mix(th.ground[1], th.road[0], 0.3 + rnd() * 0.3), rnd)
      else if (kind === 'dune') dune(c, x, y, 16 + rnd() * 26)
    }
  }

  // ---- 路 ----
  strokeRoad(c, cfg, 68, 'rgba(0,0,0,0.2)')
  strokeRoad(c, cfg, 60, darken(th.road[1], 0.25))
  strokeRoad(c, cfg, 56, th.road[1])
  strokeRoad(c, cfg, 48, th.roadStyle === 'cobble' ? darken(th.road[2], 0.3) : th.road[0])
  {
    // 路面的紋理:裁切成路的形狀再畫,超出路的部分不會出現(不用另外一張暫存畫布)
    c.save()
    c.clip(roadShape(cfg, 24))
    const t = c
    if (th.roadStyle === 'cobble') {
      const cw = 15, ch = 11
      for (let row = 0; row * ch < H + ch; row++) {
        for (let col = -1; col * cw < W + cw; col++) {
          const x = col * cw + (row % 2 ? cw / 2 : 0) + (rnd() - 0.5) * 2, y = row * ch + (rnd() - 0.5) * 2   // 路都在 y >= 0,上面多露出來那段不用鋪
          if (distToPath(cfg, x + cw / 2, y + ch / 2) > 34) { rnd(); continue }
          const shade = rnd()
          t.fillStyle = shade > 0.5 ? lighten(th.road[0], (shade - 0.5) * 0.3) : mix(th.road[0], th.road[2], (0.5 - shade) * 1.4)
          t.beginPath(); t.roundRect(x + 0.8, y + 0.8, cw - 1.6, ch - 1.6, 3); t.fill()
          t.fillStyle = 'rgba(255,255,255,0.16)'
          t.beginPath(); t.roundRect(x + 2, y + 1.6, cw - 6, 2, 1); t.fill()
        }
      }
    } else {
      for (let i = 0; i < 2600; i++) {
        const x = rnd() * W, y = rnd() * H
        if (distToPath(cfg, x, y) > 26) continue
        const r = 0.8 + rnd() * 2.6
        t.globalAlpha = 0.1 + rnd() * 0.16
        ellipse(t, x, y, r * 1.6, r, rnd() > 0.45 ? th.road[2] : '#ffffff')
      }
      t.globalAlpha = 1
      // 車轍:兩條淡淡的暗線(寬的暗線上再蓋一條路面色的細線,只剩兩邊)
      strokeRoad(t, cfg, 24, mix(th.road[0], th.road[2], th.roadStyle === 'snow' ? 0.3 : 0.2))
      strokeRoad(t, cfg, 19, th.road[0])
      for (let i = 0; i < 2600; i++) {
        const x = rnd() * W, y = rnd() * H
        if (distToPath(cfg, x, y) > 24) continue
        if (rnd() > 0.1) continue
        pebble(t, x, y, 1.4 + rnd() * 1.8, darken(th.road[0], 0.2 + rnd() * 0.2))
      }
    }
    c.restore()
    world()
  }
  // 路邊長一點草 / 積雪,邊線才不會像尺畫的
  for (let i = 0; i < cfg.path.length - 1; i++) {
    const a = cfg.path[i] as number[], b = cfg.path[i + 1] as number[]
    const [ax, ay] = i === 0 ? entrancePoint(cfg, 40) : [a[0] ?? 0, a[1] ?? 0], bx = b[0] ?? 0, by = b[1] ?? 0
    const len = Math.hypot(bx - ax, by - ay)
    const ux = (bx - ax) / len, uy = (by - ay) / len
    for (let d = 0; d < len; d += 7) {
      for (const side of [-1, 1]) {
        if (rnd() > 0.62) continue
        const off = (25 + rnd() * 6) * side
        const x = ax + ux * d - uy * off, y = ay + uy * d + ux * off
        if (distToPath(cfg, x, y) < 23) continue
        if (th.roadStyle === 'snow') ellipse(c, x, y, 5 + rnd() * 5, 2.4 + rnd() * 2, '#f4f9fc')
        else if (th.liquid === 'lava') pebble(c, x, y, 2 + rnd() * 2.6, darken(th.road[1], rnd() * 0.3))
        else grass(c, x, y + 2, 2.2 + rnd() * 2, th.tuft[0], th.tuft[1], rnd)
      }
    }
  }

  // ---- 女神像的石壇 ----
  {
    const stone = mix(th.road[0], '#ffffff', 0.25)
    ellipse(c, gx, gy + 7, 72, 38, 'rgba(0,0,0,0.3)')
    ellipse(c, gx, gy + 4, 67, 34, darken(stone, 0.45))
    const g = c.createLinearGradient(0, gy - 32, 0, gy + 32)
    g.addColorStop(0, lighten(stone, 0.2)); g.addColorStop(1, darken(stone, 0.18))
    c.fillStyle = g
    c.beginPath(); c.ellipse(gx, gy, 66, 32, 0, 0, Math.PI * 2); c.fill()
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      c.beginPath(); c.moveTo(gx + Math.cos(a) * 50, gy + Math.sin(a) * 24); c.lineTo(gx + Math.cos(a) * 66, gy + Math.sin(a) * 32); c.stroke()
    }
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.2
    c.beginPath(); c.ellipse(gx, gy, 50, 24, 0, 0, Math.PI * 2); c.stroke()
    c.strokeStyle = 'rgba(255,236,170,0.55)'; c.lineWidth = 1.6
    c.beginPath(); c.ellipse(gx, gy, 42, 20, 0, 0, Math.PI * 2); c.stroke()
    c.fillStyle = 'rgba(255,236,170,0.75)'
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, x = gx + Math.cos(a) * 46, y = gy + Math.sin(a) * 22
      c.beginPath(); c.moveTo(x, y - 2.6); c.lineTo(x + 2.2, y); c.lineTo(x, y + 2.6); c.lineTo(x - 2.2, y); c.fill()
    }
  }

  // ---- 塔位底下壓一點影子,石台才像放在地上 ----
  for (const s of cfg.slots) ellipse(c, s[0] ?? 0, (s[1] ?? 0) + 5, 36, 16, 'rgba(0,0,0,0.2)')

  // ---- 擺設 ----
  const props: { x: number; y: number; name: string; h: number; seed: number; flip: boolean }[] = []
  for (const a of ANCHORS) {
    const list = a.size === 'feature' ? [th.feature[0] ?? 'boulder'] : a.size === 'feature2' ? [th.feature[1] ?? 'boulder'] : th[a.size]
    const name = list[Math.floor(rnd() * list.length)] ?? 'boulder'
    let h = (PROP_H[name] ?? SIZE_H[a.size]) * (0.9 + rnd() * 0.2)
    if (a.size === 'small') h = Math.min(h, 48)
    if (a.size === 'feature' && !decor[name]) h = Math.max(h, 86)     // 右邊空地的主景:用畫的那幾種本來都偏小,放大
    if (a.size === 'mid') h = Math.min(h, 78)
    if (a.y > 500) h = Math.min(h, a.y - MAX_TOP)       // 下緣的不能高到蓋住路
    if (a.size === 'feature' && th.secondPool) continue  // 這個場景右邊是水池
    props.push({ x: a.x + (rnd() - 0.5) * 8, y: a.y, name, h, seed: Math.floor(rnd() * 1e9), flip: rnd() > 0.5 })
  }
  props.sort((p, q) => p.y - q.y)
  for (const p of props) {
    const img = decor[p.name]
    const w = img ? (img.width / img.height) * p.h : p.h
    ellipse(c, p.x + 2, p.y - 1, Math.min(46, w * 0.42), Math.min(13, w * 0.14), 'rgba(0,0,0,0.3)')
    c.save()
    c.translate(p.x, p.y)
    if (img) {
      // 圖片底下通常帶一小塊草地或陰影,往下沉一點才像長在地上
      if (p.flip && p.name !== 'house') c.scale(-1, 1)
      c.drawImage(img, -w / 2, -p.h * 0.94, w, p.h)
    } else {
      const r2 = rng(p.seed)
      if (p.flip) c.scale(-1, 1)
      if (p.name === 'palm') palm(c, p.h, r2)
      else if (p.name === 'cactus') cactus(c, p.h)
      else if (p.name === 'pillar') pillar(c, p.h, r2)
      else if (p.name === 'banner') banner(c, p.h)
      else if (p.name === 'lavarock') lavarock(c, p.h, r2)
      else if (p.name === 'icespike') icespike(c, p.h, r2)
      else if (p.name === 'coral') coral(c, p.h, r2)
      else if (p.name === 'bones') bones(c, p.h)
      else if (p.name === 'crate') crate(c, p.h)
      else if (p.name === 'fence') fence(c, p.h)
      else if (p.name === 'crystal') crystal(c, p.h, r2)
      else if (p.name === 'snowman') snowman(c, p.h)
      else boulder(c, p.h, mix(th.road[1], th.ground[2], 0.45), r2)
    }
    c.restore()
    const light = PROP_LIGHT[p.name]
    if (light) lights.push({ x: p.x, y: p.y - p.h * 0.55, r: light[1] * (p.h / (PROP_H[p.name] ?? p.h)), color: light[0] })
  }

  // ---- 入口:畫布邊上的山洞(在路的第一個折點,朝路進來的方向)----
  {
    const p0 = cfg.path[0] as number[]
    const ex = p0[0] ?? 0, ey = p0[1] ?? 90
    const [ox, oy] = entranceDir(cfg)
    const ix = -ox, iy = -oy          // 往地圖裡面
    const px = -iy, py = ix           // 沿著畫布邊
    const eg = c.createRadialGradient(ex, ey, 6, ex, ey, 66)
    eg.addColorStop(0, 'rgba(0,0,0,0.96)'); eg.addColorStop(0.55, 'rgba(0,0,0,0.7)'); eg.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = eg
    c.fillRect(ex - 70, ey - 70, 140, 140)
    const rock = mix(th.road[1], th.ground[0], 0.5)
    // [往裡多少, 沿邊多少, 大小]:左邊入口時就是原本的位置
    const stones: [number, number, number][] = ([[4, -30, 34], [34, -36, 22], [2, 62, 36], [36, 52, 22], [-6, -58, 30], [18, 80, 20]] as [number, number, number][])
      .map(([a, b, h]) => [ex + ix * a + px * b, ey + iy * a + py * b, h] as [number, number, number])
    stones.sort((p, q) => p[1] - q[1])
    for (const [x, y, h] of stones) {
      c.save(); c.translate(x, y)
      boulder(c, h, rock, rng(Math.floor(x * 31 + y * 17) + chapter))
      c.restore()
    }
  }

  // ---- 光影:左上打光、右下暗一點,四周壓暗 ----
  const lg = c.createLinearGradient(0, -TOP, W, H)
  lg.addColorStop(0, 'rgba(255,244,214,0.13)'); lg.addColorStop(0.5, 'rgba(255,244,214,0)'); lg.addColorStop(1, 'rgba(0,10,30,0.2)')
  c.fillStyle = lg
  c.fillRect(0, -TOP, W, VH)
  const mid = (H - TOP) / 2
  const v = c.createRadialGradient(W / 2, mid, VH * 0.5, W / 2, mid, VH * 1.0)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.4)')
  c.fillStyle = v
  c.fillRect(0, -TOP, W, VH)
  return { canvas: cv, liquids, lights, chapter: chapter % THEMES.length }
}

// ===================== 會動的氛圍 =====================

/** 疊在底圖上、人和怪底下:水面反光、岩漿冒泡、火光、入口的魔光。t = 經過幾秒 */
export function drawAmbientUnder(c: C2, tr: Terrain, cfg: TdConfig, t: number) {
  for (const q of tr.liquids) {
    c.save()
    c.clip(q.path)
    const rnd = rng(q.seed + 99)
    if (q.kind === 'water') {
      c.lineCap = 'round'; c.lineWidth = 1.4
      for (let i = 0; i < 9; i++) {
        const bx = q.cx + (rnd() - 0.5) * q.rx * 1.7, by = q.cy + (rnd() - 0.5) * q.ry * 1.7, ph = rnd() * 6.28, l = 6 + rnd() * 10
        const a = 0.5 + 0.5 * Math.sin(t * 1.3 + ph)
        c.strokeStyle = 'rgba(255,255,255,' + (0.12 + 0.4 * a) + ')'
        const x = bx + Math.sin(t * 0.5 + ph) * 5
        c.beginPath(); c.moveTo(x - l, by); c.quadraticCurveTo(x, by - 2.6, x + l, by); c.stroke()
      }
      c.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 6; i++) {
        const x = q.cx + (rnd() - 0.5) * q.rx * 1.6, y = q.cy + (rnd() - 0.5) * q.ry * 1.6, ph = rnd() * 6.28
        glow(c, x, y, 5, '#ffffff', Math.max(0, Math.sin(t * 2.2 + ph)) ** 6 * 0.9)
      }
    } else if (q.kind === 'lava') {
      c.globalCompositeOperation = 'lighter'
      glow(c, q.cx, q.cy, Math.max(q.rx, q.ry) * 1.5, '#ff7a1f', 0.22 + 0.12 * Math.sin(t * 1.4))
      c.globalCompositeOperation = 'source-over'
      for (let i = 0; i < 6; i++) {         // 泡泡:慢慢鼓起來,破掉
        const x = q.cx + (rnd() - 0.5) * q.rx * 1.4, y = q.cy + (rnd() - 0.5) * q.ry * 1.4, ph = rnd(), period = 2.2 + rnd() * 2
        const p = ((t / period + ph) % 1)
        c.globalAlpha = 1
        if (p < 0.8) {
          const r = 1 + 4.5 * (p / 0.8)
          c.fillStyle = '#ffd24d'
          c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill()
          c.fillStyle = '#fff6c8'
          c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); c.fill()
        } else {
          c.globalAlpha = 1 - (p - 0.8) / 0.2
          c.strokeStyle = '#ffe08a'; c.lineWidth = 1.4
          c.beginPath(); c.arc(x, y, 5.5 + (p - 0.8) * 30, 0, Math.PI * 2); c.stroke()
        }
      }
    } else {
      // 冰面:每隔幾秒有一道光掃過去
      const p = (t % 7) / 7
      const x = q.cx - q.rx * 2 + p * q.rx * 5
      c.globalAlpha = 0.5
      c.fillStyle = '#ffffff'
      c.beginPath(); c.moveTo(x, q.cy - q.ry * 1.2); c.lineTo(x + 14, q.cy - q.ry * 1.2); c.lineTo(x - 22, q.cy + q.ry * 1.2); c.lineTo(x - 36, q.cy + q.ry * 1.2); c.fill()
      c.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 5; i++) {
        const gx = q.cx + (rnd() - 0.5) * q.rx * 1.5, gy = q.cy + (rnd() - 0.5) * q.ry * 1.5, ph = rnd() * 6.28
        glow(c, gx, gy, 5, '#ffffff', Math.max(0, Math.sin(t * 1.7 + ph)) ** 8)
      }
    }
    c.restore()
  }
  c.save()
  c.globalCompositeOperation = 'lighter'
  // 入口:洞裡透出來的魔光,怪就是從這裡來的
  const p0 = cfg.path[0] as number[]
  const [ox, oy] = entranceDir(cfg)
  const ex = (p0[0] ?? 0) - ox * 4, ey = (p0[1] ?? 90) - oy * 4
  glow(c, ex, ey, 46 + 6 * Math.sin(t * 1.6), '#7a3dff', 0.4 + 0.12 * Math.sin(t * 2.3))
  for (let i = 0; i < 3; i++) {
    const a = t * 1.1 + (i * Math.PI * 2) / 3
    glow(c, ex - ox * 6 + Math.cos(a) * 14, ey - oy * 6 + Math.sin(a) * 20, 9, '#c99bff', 0.5)
  }
  // 營火、火盆、水晶的光
  for (let i = 0; i < tr.lights.length; i++) {
    const l = tr.lights[i] as Light
    const fire = l.color === '#ff9a3d'
    const f = fire ? 0.75 + 0.15 * Math.sin(t * 9 + i) + 0.1 * Math.sin(t * 23 + i * 3) : 0.7 + 0.3 * Math.sin(t * 1.5 + i)
    glow(c, l.x, l.y, l.r * (0.9 + f * 0.25), l.color, 0.5 * f)
    if (fire) glow(c, l.x, l.y - 3, l.r * 0.3, '#ffe9a0', 0.75 * f)
  }
  c.restore()
}

/** 疊在最上面:雲影,和各場景自己的飄雪 / 落葉 / 風沙 / 火星 / 螢火。用畫面座標畫(左上角是 0,0、高度 VH) */
export function drawAmbientOver(c: C2, tr: Terrain, t: number) {
  const th = THEMES[tr.chapter] as Theme
  const H = VH
  const rnd = rng(555 + tr.chapter * 31)
  c.save()
  // 雲影慢慢飄過去
  for (let i = 0; i < 3; i++) {
    const sp = 7 + rnd() * 6, y = rnd() * H, r = 150 + rnd() * 120
    const x = ((rnd() * (W + 800) + t * sp) % (W + 800)) - 400
    c.globalAlpha = 0.5
    c.drawImage(glowOf(th.cloud), x - r * 1.5, y - r * 0.7, r * 3, r * 1.4)
  }
  c.globalAlpha = 1
  const kind = th.ambient
  if (kind === 'snow') {
    c.fillStyle = '#ffffff'
    for (let i = 0; i < 90; i++) {
      const sx = rnd() * W, sy = rnd() * H, sp = 26 + rnd() * 34, r = 1 + rnd() * 1.8, ph = rnd() * 6.28
      const y = ((sy + t * sp) % (H + 20)) - 10
      const x = (((sx + Math.sin(t * 0.8 + ph) * 14 + t * 9) % W) + W) % W
      c.globalAlpha = 0.55 + 0.4 * rnd()
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill()
    }
  } else if (kind === 'leaves') {
    const cols = ['#e8943a', '#d9662a', '#e9c24a', '#b8472a']
    for (let i = 0; i < 26; i++) {
      const sx = rnd() * (W + 60), sy = rnd() * (H + 40), sp = 18 + rnd() * 20, ph = rnd() * 6.28
      const col = cols[i % cols.length] ?? '#e8943a'
      const y = ((sy + t * sp) % (H + 40)) - 20
      const x = ((sx + t * sp * 1.1 + Math.sin(t * 1.3 + ph) * 22) % (W + 60)) - 30
      c.save()
      c.translate(x, y); c.rotate(t * 1.6 + ph)
      c.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(t * 2.1 + ph)))
      c.globalAlpha = 0.9
      c.fillStyle = col
      c.beginPath(); c.moveTo(-5, 0); c.quadraticCurveTo(0, -4, 5, 0); c.quadraticCurveTo(0, 4, -5, 0); c.fill()
      c.restore()
    }
  } else if (kind === 'sand') {
    c.lineCap = 'round'
    for (let i = 0; i < 34; i++) {
      const sx = rnd() * (W + 300), sy = rnd() * H, sp = 150 + rnd() * 160, len = 24 + rnd() * 50, ph = rnd() * 6.28
      const x = ((sx + t * sp) % (W + 300)) - 150, y = sy + Math.sin(t * 0.9 + ph) * 8
      c.globalAlpha = 0.1 + 0.14 * rnd()
      c.strokeStyle = '#fff0c0'; c.lineWidth = 1 + rnd() * 1.2
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y - 2); c.stroke()
    }
  } else if (kind === 'mist') {
    for (let i = 0; i < 7; i++) {
      const sx = rnd() * (W + 500), sy = rnd() * H, sp = 10 + rnd() * 12, r = 120 + rnd() * 110
      const x = ((sx + t * sp) % (W + 500)) - 250
      c.globalAlpha = 0.1
      c.drawImage(glowOf('#dfe8e4'), x - r * 1.6, sy - r * 0.5, r * 3.2, r)
    }
    c.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 14; i++) {
      const sx = rnd() * W, sy = rnd() * H, ph = rnd() * 6.28
      glow(c, sx + Math.sin(t * 0.5 + ph) * 26, sy + Math.cos(t * 0.37 + ph) * 16, 4, '#d8ffb0', Math.max(0, Math.sin(t * 1.2 + ph)) * 0.8)
    }
  } else if (kind === 'embers') {
    c.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 46; i++) {
      const sx = rnd() * W, sy = rnd() * (H + 40), sp = 22 + rnd() * 36, ph = rnd() * 6.28, r = 2 + rnd() * 2.6
      const y = H + 20 - ((sy + t * sp) % (H + 40))
      const x = sx + Math.sin(t * 1.1 + ph) * 16
      glow(c, x, y, r * 2, i % 3 ? '#ff7a1f' : '#ffd24d', 0.5 + 0.5 * Math.sin(t * 7 + ph))
    }
    c.globalAlpha = 0.06 + 0.03 * Math.sin(t * 1.2)
    c.fillStyle = '#ff4a1f'
    c.fillRect(0, 0, W, H)
  } else if (kind === 'glint') {
    c.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 30; i++) {
      const x = rnd() * W, y = rnd() * H, ph = rnd() * 6.28, sp = 1 + rnd() * 1.6
      const a = Math.max(0, Math.sin(t * sp + ph)) ** 5
      if (a < 0.02) continue
      glow(c, x, y, 5 + a * 4, '#c8fff4', a * 0.9)
      c.globalAlpha = a
      c.fillStyle = '#ffffff'
      c.beginPath(); c.moveTo(x - 6 * a, y); c.lineTo(x, y - 1); c.lineTo(x + 6 * a, y); c.lineTo(x, y + 1); c.fill()
      c.beginPath(); c.moveTo(x, y - 6 * a); c.lineTo(x + 1, y); c.lineTo(x, y + 6 * a); c.lineTo(x - 1, y); c.fill()
    }
  } else {
    // 說話之島:花粉光點和幾隻蝴蝶
    c.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 30; i++) {
      const sx = rnd() * W, sy = rnd() * H, ph = rnd() * 6.28
      const x = (((sx + t * 6 + Math.sin(t * 0.6 + ph) * 24) % W) + W) % W, y = sy + Math.cos(t * 0.45 + ph) * 18
      glow(c, x, y, 3.4, '#f4ffb0', 0.3 + 0.5 * Math.max(0, Math.sin(t * 1.4 + ph)))
    }
    c.globalCompositeOperation = 'source-over'
    const cols = ['#ffffff', '#ffe36a', '#ff9ac0', '#9ad0ff']
    for (let i = 0; i < 5; i++) {
      const ph = rnd() * 6.28, cx = 150 + rnd() * 700, cy = 120 + rnd() * 380
      const x = cx + Math.sin(t * 0.33 + ph) * 120 + Math.sin(t * 1.1 + ph * 2) * 20
      const y = cy + Math.cos(t * 0.27 + ph) * 60 + Math.sin(t * 1.7 + ph) * 10
      const flap = Math.abs(Math.sin(t * 11 + ph))
      c.globalAlpha = 0.95
      c.fillStyle = cols[i % cols.length] ?? '#fff'
      for (const side of [-1, 1]) {
        c.beginPath(); c.ellipse(x + side * 2.6 * flap, y - 1, 3.2 * flap + 0.4, 3.6, side * 0.4, 0, Math.PI * 2); c.fill()
      }
      c.fillStyle = '#2a2018'
      c.fillRect(x - 0.6, y - 3, 1.2, 5)
    }
  }
  c.restore()
}
