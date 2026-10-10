// 骨骼動畫(2026-10-10):角色切成零件(頭、身、腿、弓…),手臂用程式畫,關節旋轉 + 手調關鍵格,弓弦與箭即時畫。
// 跟 Spine 同一套原理,差在零件是我們自己切、動作是程式裡的關鍵格。rig.json 由 Tools/SDGen/rig_cut.py 產生。
//
// 座標:rig 空間 = 原圖像素(例如妖精 230×260),feet 是腳底;畫的時候整體縮到顯示高度、腳底對齊塔位。

export interface RigPart { file: string; x: number; y: number; w: number; h: number; pivot: [number, number]; parent: string; z: number; img: HTMLImageElement }
export interface RigArm { shoulder: [number, number]; len: number; z: number; sleeve: string; skin: string }
export interface RigData {
  size: [number, number]; feet: [number, number]; weapon: string
  /** 原圖面向左(rig_cut.py 寫入;沒寫視為左) */
  left?: boolean
  parts: Record<string, RigPart>
  arms: Record<string, RigArm>
  /** 弓整把程式畫(原圖的弓只有半截):長度、木色、描邊色、疊放順序 */
  bow?: { len: number; z: number; color: string; edge: string }
}
export interface Rig {
  key: string; data: RigData
  /** 這套動作「命中」在第幾毫秒(放箭那一刻),出手起手要提前這麼多 */
  hit: number
  /** 一次攻擊動作總長(毫秒) */
  total: number
  /** 原圖面向左 */
  left: boolean
}

const ASSET = '/aegis/td/rig/'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('圖片載入失敗:' + src))
    img.src = src
  })
}

/** 讀一個單位的骨骼;沒有就回 null(那個單位走舊的畫法) */
export async function loadRig(key: string): Promise<Rig | null> {
  try {
    const res = await fetch(`${ASSET}${key}/rig.json`, { cache: 'no-cache' })
    if (!res.ok) return null
    const data = (await res.json()) as RigData
    await Promise.all(Object.values(data.parts).map(async (p) => { p.img = await loadImage(`${ASSET}${key}/${p.file}`) }))
    const timing = TIMING[data.weapon] ?? TIMING.bow!
    return { key, data, hit: timing.hit, total: timing.total, left: data.left ?? true }
  } catch {
    return null
  }
}

/** 各武器一次攻擊的時間軸(毫秒) */
const TIMING: Record<string, { hit: number; total: number }> = {
  bow: { hit: 480, total: 760 },
}

// ===================== 動作 =====================

/** 一格的姿勢:每個零件繞自己的樞紐轉幾度、位移;手要放在 rig 空間的哪裡;弦拉到哪;箭要不要畫 */
export interface Pose {
  parts: Record<string, { rot: number; dx: number; dy: number; sx: number; sy: number }>
  /** 整個人(root)的傾斜與位移 */
  root: { rot: number; dx: number; dy: number; sx: number; sy: number }
  /** 程式手臂:手的位置(rig 空間、身體未傾斜前) */
  hands: Record<string, [number, number]>
  /** 指定手肘位置的手臂(拉弓那隻:肘要往正後方抬高,IK 算不出來,直接給) */
  elbows: Record<string, [number, number]>
  /** 弓:繞握把轉幾度(弧度,0 = 直立、弓背朝前);拉弦的手的位置(有就畫被拉開的弦);箭:0 不畫,1 搭在弦上 */
  bowRot: number
  stringHand: [number, number] | null
  arrow: number
  /** 弓回彈時的壓扁比例(1 = 正常) */
  bowSquash: number
}

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
const easeOut = (k: number) => 1 - (1 - k) * (1 - k)
const easeOutBack = (k: number) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)   // 過衝一點再回來
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerp2 = (a: [number, number], b: [number, number], k: number): [number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]

function zeroPose(rig: Rig): Pose {
  const parts: Pose['parts'] = {}
  for (const n of Object.keys(rig.data.parts)) parts[n] = { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }
  return { parts, root: { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }, hands: {}, elbows: {}, bowRot: 0, stringHand: null, arrow: 0, bowSquash: 1 }
}

/**
 * 弓手的姿勢。clock = 秒(待機呼吸用);atk = 出手後幾毫秒(< 0 = 沒在出手);phase = 這座塔的相位(每座錯開)
 * 動作:舉弓(0~150ms)→ 搭箭拉弦到臉旁(150~420)→ 停住瞄(420~480)→ 放(480,手往前甩、弓回彈、身體後坐)→ 放下(560~760)
 */
export function bowPose(rig: Rig, clock: number, atk: number, phase: number): Pose {
  const p = zeroPose(rig)
  const d = rig.data
  // rig 空間裡「前方」= 原圖面向的那邊 = +x(原圖朝左的角色由 rig_cut 的 left 標記、drawRig 鏡射處理)
  const shB = d.arms.armBow!.shoulder, shD = d.arms.armDraw!.shoulder
  const fwd = rig.left ? -1 : 1
  // 休息:弓垂在前側身旁、微斜;拉弦手(後手)垂在身側
  // 休息:兩手自然垂下(手離肩膀接近手長,手臂才不會折成銳角),弓直直立在前側身旁、下端快碰地
  const restBow: [number, number] = [shB[0] + fwd * 8, shB[1] + 50]
  const restDraw: [number, number] = [shD[0] - fwd * 6, shD[1] + 50]
  // 瞄準:前手往前伸直把弓立起來(弓在臉前方);後手先搭到弦上(握把後面一點),再一路拉到耳後
  const aimBow: [number, number] = [shB[0] + fwd * 52, shB[1] + 6]
  const nock: [number, number] = [aimBow[0] - fwd * 14, aimBow[1] + 2]
  // 拉弦手停在下巴旁(前肩那一側的臉頰下),肘往正後方抬到肩高、前臂跟箭平行——真正拉弓的樣子
  const cheek: [number, number] = [shD[0] + fwd * 8, shD[1] + 7]
  const elbowNock: [number, number] = [shD[0] - fwd * 18, shD[1] + 18]
  const elbowFull: [number, number] = [shD[0] - fwd * 44, shD[1] + 1]
  const elbowFlung: [number, number] = [shD[0] - fwd * 48, shD[1] - 8]
  // 弓:0 = 直立(弓背朝前);瞄準時弓頂往目標那邊傾(天堂妖精那種弓斜舉在胸前的樣子);休息時弓頂往後靠著
  const uprightRot = fwd * 0.35
  const restRot = -fwd * 0.18

  // 呼吸(待機,每座塔錯相)
  const br = Math.sin(clock * 2.2 + phase)
  p.parts.torso!.sy = 1 + 0.018 * br
  p.parts.head!.rot = 0.02 * Math.sin(clock * 1.3 + phase)
  p.parts.head!.dy = -1.5 * br

  if (atk < 0 || atk >= rig.total) {
    const sway = Math.sin(clock * 0.9 + phase)          // 重心慢慢左右換
    p.root.dx = 1.5 * sway
    p.root.rot = 0.012 * sway
    p.hands.armBow = [restBow[0] + 1.2 * sway, restBow[1] + 1.5 * br]
    p.hands.armDraw = [restDraw[0] + fwd * 2 * br - 1.2 * sway, restDraw[1] + 1.5 * br]
    p.bowRot = restRot + 0.03 * br + 0.02 * sway
    p.arrow = 0
    return p
  }
  // 一次出手的節奏(毫秒):預備微蹲 0~60 → 舉弓(帶一點過衝)60~190 → 拉弦到耳後 190~420 → 停住瞄 420~480 → 放箭 480(彈震)→ 放下 580~760
  const front = fwd < 0 ? 'legL' : 'legR', back = fwd < 0 ? 'legR' : 'legL'
  let bowK = 0, drawK = 0, lean = 0, recoil = 0, lower = 0, prep = 0, settle = 0
  if (atk < 60) {                        // 預備:整個人先往下壓一下、弓手先往後帶(拉弓前的蓄力)
    prep = Math.sin((atk / 60) * Math.PI)
  } else if (atk < 190) {                // 舉弓:帶過衝,手舉過頭再落回瞄準位
    bowK = easeOutBack((atk - 60) / 130)
  } else if (atk < 420) {                // 拉弦:慢起快到,身體跟著坐進去
    bowK = 1; drawK = ease((atk - 190) / 230); lean = drawK
  } else if (atk < 480) {                // 停住瞄準:全身微微發抖(不是只有弦)
    bowK = 1; drawK = 1; lean = 1; settle = 1
  } else if (atk < 580) {                // 放箭:後座 + 阻尼彈震
    bowK = 1; drawK = 0; lean = 1 - (atk - 480) / 100; recoil = 1 - (atk - 480) / 100
  } else {                               // 放下:慢慢鬆開,弓晃回休息位
    lower = ease((atk - 580) / 180); bowK = 1 - lower; drawK = 0
  }
  const tremor = settle ? Math.sin(atk * 0.75) * 0.6 : 0
  const snap = recoil > 0 ? Math.exp(-(atk - 480) / 45) * Math.sin((atk - 480) * 0.25) : 0   // 放箭後 ~100ms 的衰減震盪
  // 弓手:預備時往後帶一點;舉弓後固定;放箭瞬間往前踢一下再彈回
  const bowHand = lerp2(restBow, aimBow, bowK)
  bowHand[0] += -fwd * 4 * prep + fwd * 5 * snap + tremor * 0.5
  bowHand[1] += 2 * prep - 2 * snap
  p.hands.armBow = bowHand
  p.bowRot = lerp(restRot, uprightRot, bowK) + fwd * 0.18 * snap - fwd * 0.05 * prep
  // 拉弦手:舉弓時從身側到弦上,拉弦時從弦上拉到耳後,放箭後往後上方甩開(肘帶著走),再慢慢放下
  const flung: [number, number] = [cheek[0] - fwd * 22, cheek[1] - 8]
  let drawHand: [number, number]
  if (atk < 60) drawHand = [restDraw[0] - fwd * 2 * prep, restDraw[1] + 2 * prep]
  else if (atk < 190) drawHand = lerp2(restDraw, nock, easeOut((atk - 60) / 130))
  else if (atk < 480) {
    drawHand = lerp2(nock, cheek, drawK); drawHand[0] += tremor; drawHand[1] += tremor * 0.4
    const e = lerp2(elbowNock, elbowFull, drawK); e[1] += tremor * 0.5
    p.elbows.armDraw = e
  } else if (atk < 580) {
    const k = easeOut((atk - 480) / 60)
    drawHand = lerp2(cheek, flung, k)
    p.elbows.armDraw = lerp2(elbowFull, elbowFlung, k)
  } else {
    drawHand = lerp2(flung, restDraw, lower)
    if (lower < 0.5) p.elbows.armDraw = lerp2(elbowFlung, [shD[0] - fwd * 26, shD[1] + 20], lower * 2)
  }
  p.hands.armDraw = drawHand
  // 弦:拉弦期間弦掛在拉弦手上
  p.stringHand = atk >= 190 && atk < 480 ? [drawHand[0], drawHand[1]] : null
  p.arrow = atk >= 230 && atk < 480 ? 1 : 0
  // 身體:預備微蹲;拉弦時重心坐後、肩膀沉;放箭瞬間後坐再彈震回來
  p.root.rot = fwd * (-0.05 * lean - 0.06 * recoil - 0.03 * snap)
  p.root.dx = -fwd * (4 * lean + 4 * recoil) + fwd * 2 * snap
  p.root.sx = 1 + 0.04 * recoil + 0.03 * prep
  p.root.sy = 1 - 0.035 * recoil - 0.04 * prep
  p.root.dy = 2 * lean + 2 * recoil + 3 * prep
  // 身體跟頭:拉弦時身體往弓那邊轉一點、頭盯著目標微傾;放箭瞬間頭往後頓一下
  p.parts.torso!.rot = fwd * (-0.03 * lean)
  p.parts.head!.rot += fwd * (0.05 * lean + 0.04 * snap)
  p.parts.head!.dx = -fwd * (3 * lean + 2 * recoil) + fwd * 1.5 * snap
  p.parts.head!.dy += 1.5 * lean + tremor * 0.3
  // 腳步:預備時後腳先蹬、拉弦時前腳跨出、後腳撐住;放箭時前腳再踩一下
  p.parts[front]!.dx = fwd * (6 * lean + 3 * recoil)
  p.parts[front]!.rot = -fwd * 0.12 * lean
  p.parts[back]!.dx = -fwd * (3 * lean + 2 * prep)
  // 弓回彈:放箭瞬間弓壓扁再彈開
  p.bowSquash = 1 - 0.1 * recoil + 0.04 * snap
  return p
}

// ===================== 畫 =====================

/** 沿著一條線畫圓頭粗線(描邊 + 填色) */
function limb(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, fill: string) {
  c.lineCap = 'round'; c.lineJoin = 'round'
  c.strokeStyle = 'rgba(40,30,20,0.9)'; c.lineWidth = w + 2.6
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke()
  c.strokeStyle = fill; c.lineWidth = w
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke()
}

/** 兩段式手臂:肩 → 肘 → 手;肘往 bendSign 那邊彎 */
function drawArm(c: CanvasRenderingContext2D, arm: RigArm, hand: [number, number], bendSign: number, elbow?: [number, number]) {
  const [sx, sy] = arm.shoulder, [hx, hy] = hand
  if (elbow) {   // 肘已指定:肩→肘→手直接畫(不管手長)
    limb(c, sx, sy, elbow[0], elbow[1], 11, arm.sleeve)
    limb(c, elbow[0], elbow[1], hx, hy, 9, arm.skin)
    c.fillStyle = arm.skin; c.strokeStyle = 'rgba(40,30,20,0.9)'; c.lineWidth = 2
    c.beginPath(); c.arc(hx, hy, 6, 0, Math.PI * 2); c.fill(); c.stroke()
    return hand
  }
  const half = arm.len / 2
  const dx = hx - sx, dy = hy - sy
  const dist = Math.hypot(dx, dy)
  const reach = Math.min(dist, arm.len - 0.5)
  // 手搆不到就拉到最遠
  const ux = dist > 0.01 ? dx / dist : 1, uy = dist > 0.01 ? dy / dist : 0
  const tx = sx + ux * reach, ty = sy + uy * reach
  // 肘:在肩手連線中點,往法線方向偏
  const h = Math.sqrt(Math.max(0, half * half - (reach / 2) * (reach / 2)))
  const nx = -uy * bendSign, ny = ux * bendSign
  const ex = (sx + tx) / 2 + nx * h, ey = (sy + ty) / 2 + ny * h
  limb(c, sx, sy, ex, ey, 11, arm.sleeve)   // 上臂:袖子
  limb(c, ex, ey, tx, ty, 9, arm.skin)      // 前臂:皮膚
  c.fillStyle = arm.skin; c.strokeStyle = 'rgba(40,30,20,0.9)'; c.lineWidth = 2
  c.beginPath(); c.arc(tx, ty, 6, 0, Math.PI * 2); c.fill(); c.stroke()
  return [tx, ty] as [number, number]
}

/**
 * 把一個單位畫在 (x, y)(腳底),顯示高度 h,面向 faceLeft。
 * ctx 已經 save 好;這裡自己 translate / scale。
 */
export function drawRig(c: CanvasRenderingContext2D, rig: Rig, pose: Pose, x: number, y: number, h: number, faceLeft: boolean, alpha = 1) {
  const d = rig.data
  const s = h / d.size[1]
  const flip = faceLeft !== rig.left
  c.save()
  c.globalAlpha *= alpha
  c.translate(x, y)
  c.scale(flip ? -s : s, s)
  c.translate(-d.feet[0], -d.feet[1])
  // 整個人的傾斜(繞腳底)
  c.translate(d.feet[0] + pose.root.dx, d.feet[1] + pose.root.dy)
  c.rotate(pose.root.rot)
  c.scale(pose.root.sx, pose.root.sy)
  c.translate(-d.feet[0], -d.feet[1])

  const order = Object.entries(d.parts).map(([n, p]) => ({ n, p, z: p.z }))
  const arms = Object.entries(d.arms).map(([n, a]) => ({ n, a, z: a.z }))
  const items: { z: number; draw: () => void }[] = []
  const fwd = rig.left ? -1 : 1
  // 手的實際位置(手臂畫完才知道搆不搆得到)
  const handAt: Record<string, [number, number]> = {}

  for (const { n, p, z } of order) {
    items.push({ z, draw: () => {
      const t = pose.parts[n] ?? { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }
      c.save()
      // 父零件的傾斜:頭跟著身體
      if (p.parent === 'torso' && pose.parts.torso) {
        const tt = pose.parts.torso, tp = d.parts.torso!.pivot
        c.translate(tp[0] + tt.dx, tp[1] + tt.dy); c.rotate(tt.rot); c.scale(tt.sx, tt.sy); c.translate(-tp[0], -tp[1])
      }
      c.translate(p.pivot[0] + t.dx, p.pivot[1] + t.dy)
      c.rotate(t.rot)
      c.scale(t.sx, t.sy)
      c.translate(-p.pivot[0], -p.pivot[1])
      c.drawImage(p.img, p.x, p.y, p.w, p.h)
      c.restore()
    } })
  }
  for (const { n, a, z } of arms) {
    items.push({ z, draw: () => {
      const hand = pose.hands[n]
      if (!hand) return
      // 肩膀跟著身體傾斜
      let sh: [number, number] = a.shoulder
      if (pose.parts.torso) {
        const tt = pose.parts.torso, tp = d.parts.torso!.pivot
        const cx = a.shoulder[0] - tp[0], cy = a.shoulder[1] - tp[1]
        sh = [tp[0] + tt.dx + (cx * Math.cos(tt.rot) - cy * Math.sin(tt.rot)) * tt.sx, tp[1] + tt.dy + (cx * Math.sin(tt.rot) + cy * Math.cos(tt.rot)) * tt.sy]
      }
      // 肘往哪邊彎(rig 空間):前手肘微微朝下、後手(拉弦)肘往後上方翹
      handAt[n] = drawArm(c, { ...a, shoulder: sh }, hand, rig.left ? -1 : 1, pose.elbows[n])
    } })
  }
  // 弓(程式畫)、弦與箭:弓跟著弓手,繞握把轉;弦在弓之上、拉弦手之下
  if (d.bow) {
    const bow = d.bow
    items.push({ z: bow.z, draw: () => {
      const g = handAt.armBow
      if (!g) return
      const half = bow.len / 2 * pose.bowSquash, bulge = fwd * bow.len * 0.24
      c.save()
      c.translate(g[0], g[1]); c.rotate(pose.bowRot)
      c.lineCap = 'round'; c.lineJoin = 'round'
      c.beginPath(); c.moveTo(0, -half); c.quadraticCurveTo(bulge, 0, 0, half)
      c.strokeStyle = bow.edge; c.lineWidth = 9; c.stroke()
      c.strokeStyle = bow.color; c.lineWidth = 6; c.stroke()
      // 握把纏布 + 弓背亮邊
      c.strokeStyle = bow.edge; c.lineWidth = 8; c.beginPath(); c.moveTo(bulge * 0.5, -9); c.lineTo(bulge * 0.5, 9); c.stroke()
      c.strokeStyle = 'rgba(255,240,220,0.35)'; c.lineWidth = 1.5
      c.beginPath(); c.moveTo(fwd * 1.5, -half + 10); c.quadraticCurveTo(bulge + fwd * 1.5, 0, fwd * 1.5, half - 10); c.stroke()
      c.restore()
    } })
    items.push({ z: bow.z + 0.5, draw: () => {
      const g = handAt.armBow
      if (!g) return
      const half = bow.len / 2 * pose.bowSquash
      const tip = (y: number): [number, number] => [g[0] - y * Math.sin(pose.bowRot), g[1] + y * Math.cos(pose.bowRot)]
      const a = tip(-half), b = tip(half)
      c.strokeStyle = 'rgba(245,240,225,0.95)'; c.lineWidth = 1.6; c.lineCap = 'round'
      c.beginPath(); c.moveTo(a[0], a[1])
      if (pose.stringHand) c.lineTo(pose.stringHand[0], pose.stringHand[1])
      c.lineTo(b[0], b[1]); c.stroke()
      if (pose.arrow === 1 && pose.stringHand) {   // 箭:從拉弦手指向弓的握把再往前一點
        const hx = pose.stringHand[0], hy = pose.stringHand[1]
        const dx = g[0] - hx, dy = g[1] - hy, L = Math.hypot(dx, dy) || 1
        const ux = dx / L, uy = dy / L
        const ex = g[0] + ux * 26, ey = g[1] + uy * 26
        c.strokeStyle = '#6b4a2b'; c.lineWidth = 2.2
        c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke()
        c.fillStyle = '#d8e4ea'; c.beginPath(); c.moveTo(ex + ux * 7, ey + uy * 7); c.lineTo(ex - uy * 3, ey + ux * 3); c.lineTo(ex + uy * 3, ey - ux * 3); c.fill()
        c.fillStyle = '#8fd36a'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + ux * 9 - uy * 4, hy + uy * 9 + ux * 4); c.lineTo(hx + ux * 9 + uy * 4, hy + uy * 9 - ux * 4); c.fill()
      }
    } })
  }
  items.sort((p, q) => p.z - q.z)
  for (const it of items) it.draw()
  c.restore()
}
