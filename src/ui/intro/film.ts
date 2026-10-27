/**
 * The brand film: a deterministic, time-driven canvas animation. Everything on screen is a pure function of the
 * playhead `t` (seconds), so it can be replayed, paused or rendered at any frame, and audio can be synced to the same
 * pulse data. It is an illustration of the idea (500 AI workers, 50 people), not product data.
 *
 *   0-5    nodes activate and exchange tasks
 *   5-10   links multiply, tasks collide, the field turns restless
 *   10-17  everything eases into an ordered organization: hub, teams, owners and their AI workers
 *   17-22  the field recedes, a horizon of light opens, the logo is revealed
 */
export const DURATION = 22
export const VW = 1600
export const VH = 900

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const ease = (x: number) => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
export const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TEAM_COLS = 4
const colX = (team: number) => VW / 2 + ((team % TEAM_COLS) - 1.5) * 360
const rowY = (team: number) => 318 + Math.floor(team / TEAM_COLS) * 290
const BUS_Y = 150

interface FNode {
  human: boolean
  hub: boolean
  cx: number
  cy: number
  ox: number
  oy: number
  ph: number
  amp: number
  delay: number
  act: number
}

interface FLink {
  a: number
  b: number
  birth: number
  level: number
  strong?: boolean
}

export interface FPulse {
  link: number
  t0: number
  dur: number
  collide: boolean
  org: boolean
  verify: boolean
}

export interface Film {
  nodes: FNode[]
  chaos: FLink[]
  org: FLink[]
  pulses: FPulse[]
}

let cached: Film | null = null

export function buildFilm(): Film {
  if (cached) return cached
  const rnd = mulberry32(20261026)
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 0.58

  const nodes: FNode[] = []
  const owners: number[] = [] // for AI nodes: index of the owning person

  // chaotic field: loose, overlapping clusters
  const centers = Array.from({ length: 11 }, () => [rnd() * 1900 - 150, rnd() * 1000 - 50])
  const chaosPoint = () => {
    const c = centers[Math.floor(rnd() * centers.length)]
    return [c[0] + gauss() * 170, c[1] + gauss() * 130]
  }
  const origin = [rnd() * 600 + 500, rnd() * 300 + 300]

  const add = (human: boolean, hub: boolean, ox: number, oy: number) => {
    const [cx, cy] = chaosPoint()
    const d = Math.hypot(cx - origin[0], cy - origin[1])
    nodes.push({ human, hub, cx, cy, ox, oy, ph: rnd() * Math.PI * 2, amp: 3 + rnd() * 5, delay: rnd() * 0.9, act: 0.2 + (d / 1500) * 2.7 + rnd() * 0.3 })
    return nodes.length - 1
  }

  const hub = add(true, true, VW / 2, 96)
  const heads: number[] = []
  for (let team = 0; team < 8; team++) {
    const cx = colX(team)
    const cy = rowY(team)
    const people = team === 0 ? 7 : 6
    const mine: number[] = []
    for (let p = 0; p < people; p++) {
      const ang = -Math.PI / 2 + (p / people) * Math.PI * 2
      mine.push(add(true, false, cx + Math.cos(ang) * 132, cy + Math.sin(ang) * 118))
    }
    heads.push(mine[0])
    const ai = team < 4 ? 63 : 62
    for (let i = 0; i < ai; i++) {
      const r = 12.5 * Math.sqrt(i + 1)
      const a = i * 2.399963
      const id = add(false, false, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9)
      owners[id] = mine[i % people]
    }
  }

  // chaotic links: nearest neighbours (born while the work is activating), then extra and long-range ones
  const chaos: FLink[] = []
  const seen = new Set<number>()
  const key = (a: number, b: number) => (a < b ? a * 1000 + b : b * 1000 + a)
  const near: number[][] = nodes.map((n, i) =>
    nodes
      .map((m, j) => [j, (m.cx - n.cx) ** 2 + (m.cy - n.cy) ** 2] as const)
      .filter(([j]) => j !== i)
      .sort((p, q) => p[1] - q[1])
      .slice(0, 8)
      .map(([j]) => j),
  )
  nodes.forEach((n, i) => {
    near[i].forEach((j, rank) => {
      const k = key(i, j)
      if (seen.has(k)) return
      seen.add(k)
      const level = rank < 3 ? 0 : 1
      const birth = level === 0 ? Math.max(n.act, nodes[j].act) + 0.15 : 5 + rnd() * 4.3
      chaos.push({ a: i, b: j, birth, level })
    })
  })
  for (let i = 0; i < 240; i++) {
    const a = Math.floor(rnd() * nodes.length)
    const b = Math.floor(rnd() * nodes.length)
    if (a === b || seen.has(key(a, b))) continue
    seen.add(key(a, b))
    chaos.push({ a, b, birth: 5.4 + rnd() * 4.2, level: 2 })
  }
  chaos.sort((p, q) => p.birth - q.birth)

  // ordered links: the hub's reporting lines (drawn as elbows) and each person's pod of AI workers
  const org: FLink[] = []
  heads.forEach((h, team) => org.push({ a: hub, b: h, birth: 13.2 + team * 0.1, level: 0, strong: true }))
  nodes.forEach((_, i) => {
    if (owners[i] !== undefined) org.push({ a: owners[i], b: i, birth: 10.9 + (i % 8) * 0.1 + rnd() * 0.6, level: 1 })
  })

  // tasks travelling along links; collisions only while it is still chaos
  const pulses: FPulse[] = []
  for (let i = 0; i < 1100; i++) {
    const t0 = 0.9 + 8.7 * Math.sqrt(rnd())
    let hi = chaos.findIndex((l) => l.birth > t0)
    if (hi < 0) hi = chaos.length
    if (hi < 4) continue
    pulses.push({ link: Math.floor(rnd() * hi), t0, dur: 1.5 - 0.8 * clamp01((t0 - 1) / 8.5) + rnd() * 0.3, collide: t0 > 5.6 && rnd() < 0.34, org: false, verify: false })
  }
  const podLinks = org.map((l, i) => (l.strong ? -1 : i)).filter((i) => i >= 0)
  for (let i = 0; i < 360; i++) {
    const t0 = 12.6 + 4.2 * rnd()
    pulses.push({ link: podLinks[Math.floor(rnd() * podLinks.length)], t0, dur: 1.1 + rnd() * 0.7, collide: false, org: true, verify: rnd() < 0.22 })
  }
  pulses.sort((p, q) => p.t0 - q.t0)

  cached = { nodes, chaos, org, pulses }
  return cached
}

/** Where a node is at time t: chaos while t < 10, then easing into its place in the organization. */
function place(n: FNode, t: number): [number, number] {
  const wob = 1 + 2.4 * smooth((t - 4.5) / 5)
  const m = ease((t - 10 - n.delay) / 2.6)
  const bx = n.cx + Math.sin(t * 0.55 + n.ph) * n.amp * wob
  const by = n.cy + Math.cos(t * 0.47 + n.ph * 1.3) * n.amp * wob
  const breathe = Math.sin(t * 0.8 + n.ph) * 0.5 * m
  return [bx + (n.ox - bx) * m + breathe, by + (n.oy - by) * m + breathe]
}

export interface Sprites {
  lilac: HTMLCanvasElement
  white: HTMLCanvasElement
  coral: HTMLCanvasElement
}

export function makeSprites(): Sprites {
  const make = (rgb: string) => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, `rgba(${rgb},1)`)
      grad.addColorStop(0.18, `rgba(${rgb},0.55)`)
      grad.addColorStop(0.5, `rgba(${rgb},0.12)`)
      grad.addColorStop(1, `rgba(${rgb},0)`)
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
    }
    return c
  }
  return { lilac: make('183,148,244'), white: make('236,226,252'), coral: make('255,140,130') }
}

export function drawFrame(g: CanvasRenderingContext2D, film: Film, t: number, W: number, H: number, sp: Sprites) {
  const { nodes, chaos, org, pulses } = film

  g.globalCompositeOperation = 'source-over'
  g.fillStyle = '#05040a'
  g.fillRect(0, 0, W, H)

  // camera: a slow push in while it is chaos, a restless shake near the peak, then a settled, contained view
  const cover = Math.max(W / VW, H / VH)
  const contain = Math.min(W / VW, H / VH) * 0.98
  const settle = ease((t - 9.8) / 3.5)
  const zoom = 1 + 0.07 * smooth(t / 10) - (t > 17 ? 0.1 * smooth((t - 17) / 4) : 0)
  const s = (cover + (contain - cover) * settle) * zoom
  const shakeAmt = 3.2 * smooth((t - 6) / 3.8) * (1 - smooth((t - 9.9) / 0.4)) + (t > 9.95 && t < 10.5 ? 9 * (1 - (t - 9.95) / 0.55) : 0)
  const sx = Math.sin(t * 41) * shakeAmt
  const sy = Math.cos(t * 37) * shakeAmt
  g.setTransform(s, 0, 0, s, W / 2 - (VW / 2) * s + sx, H / 2 - (VH / 2) * s + sy)

  const dFade = 1 - 0.86 * smooth((t - 17) / 1.7)

  // ambient glow behind the field
  g.globalCompositeOperation = 'lighter'
  g.globalAlpha = (0.05 + 0.12 * smooth((t - 10) / 3)) * dFade
  g.drawImage(sp.lilac, VW / 2 - 900, VH / 2 - 600, 1800, 1200)

  const pos: [number, number][] = nodes.map((n) => place(n, t))

  // chaotic links
  const fadeChaos = 1 - smooth((t - 10) / 1.3)
  if (fadeChaos > 0.002) {
    const crescendo = 1 + 0.9 * smooth((t - 5) / 4)
    const buckets: number[][] = Array.from({ length: 6 }, () => [])
    for (let i = 0; i < chaos.length; i++) {
      const l = chaos[i]
      if (t < l.birth) break
      const a = clamp01((t - l.birth) / 0.7)
      buckets[Math.min(5, Math.floor(a * 5.99))].push(i)
    }
    g.lineWidth = 1.3 / s
    buckets.forEach((ids, b) => {
      if (!ids.length) return
      const level = (b + 1) / 6
      g.strokeStyle = `rgba(183,148,244,${Math.min(0.6, 0.42 * level * crescendo * fadeChaos * dFade)})`
      g.beginPath()
      for (const i of ids) {
        const l = chaos[i]
        g.moveTo(pos[l.a][0], pos[l.a][1])
        g.lineTo(pos[l.b][0], pos[l.b][1])
      }
      g.stroke()
    })
  }

  // ordered structure: team regions, pods (an owner and their AI workers), and the hub's reporting lines
  if (t > 11) {
    const grow = smooth((t - 11) / 1.4)
    const accountability = smooth((t - 14.6) / 1.6)
    g.lineWidth = 1 / s
    g.strokeStyle = `rgba(183,148,244,${0.2 * grow * dFade})`
    for (let team = 0; team < 8; team++) {
      g.beginPath()
      g.arc(colX(team), rowY(team), 158, 0, Math.PI * 2)
      g.stroke()
    }

    g.lineWidth = 0.8 / s
    g.strokeStyle = `rgba(183,148,244,${0.2 * (1 + 0.6 * accountability) * grow * dFade})`
    g.beginPath()
    for (const l of org) {
      if (l.strong || t < l.birth || clamp01((t - l.birth) / 0.9) < 1) continue
      g.moveTo(pos[l.a][0], pos[l.a][1])
      g.lineTo(pos[l.b][0], pos[l.b][1])
    }
    g.stroke()

    // hub: down to a bus, along it, then (for the lower row) down the gap between teams, into each team head
    const hubN = nodes[0]
    g.lineWidth = 1.5 / s
    for (const l of org) {
      if (!l.strong || t < l.birth) continue
      const f = ease((t - l.birth) / 1.2)
      if (f <= 0) continue
      const h = nodes[l.b]
      const gapX = h.ox + (h.ox < VW / 2 ? 180 : -180)
      const pts: [number, number][] =
        h.oy < 260
          ? [[hubN.ox, hubN.oy], [hubN.ox, BUS_Y], [h.ox, BUS_Y], [h.ox, h.oy]]
          : [[hubN.ox, hubN.oy], [hubN.ox, BUS_Y], [gapX, BUS_Y], [gapX, h.oy], [h.ox, h.oy]]
      const total = pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0)
      let left = total * f
      g.strokeStyle = `rgba(215,198,250,${0.5 * (1 + 0.8 * accountability) * dFade})`
      g.beginPath()
      g.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length && left > 0; i++) {
        const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        const k = Math.min(1, left / seg)
        g.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k)
        left -= seg
      }
      g.stroke()
    }
  }

  // tasks in flight and the flashes where they collide
  for (const p of pulses) {
    if (p.t0 > t) break
    const q = (t - p.t0) / p.dur
    if (q > 1.5) continue
    const l = (p.org ? org : chaos)[p.link]
    if (!l) continue
    const a = pos[l.a]
    const b = pos[l.b]
    if (q <= 1) {
      const alpha = Math.sin(Math.PI * Math.min(1, q + 0.1)) * dFade
      for (let k = 0; k < 4; k++) {
        const ee = smooth(Math.max(0, q - k * 0.05))
        g.globalAlpha = alpha * (1 - k * 0.24)
        const px = a[0] + (b[0] - a[0]) * ee
        const py = a[1] + (b[1] - a[1]) * ee
        const size = (k === 0 ? 17 : 11) * (p.org ? 1 : 1 + 0.4 * smooth((t - 5) / 4))
        g.drawImage(p.org ? sp.white : sp.lilac, px - size / 2, py - size / 2, size, size)
      }
    } else if (p.collide || p.verify) {
      const f = (q - 1) / 0.5
      g.globalAlpha = (1 - f) * (p.collide ? 0.85 : 0.5) * dFade
      g.globalCompositeOperation = 'lighter'
      g.strokeStyle = p.collide ? 'rgb(255,150,140)' : 'rgb(220,205,250)'
      g.lineWidth = 1.4 / s
      g.beginPath()
      g.arc(b[0], b[1], 4 + 26 * f, 0, Math.PI * 2)
      g.stroke()
      if (p.collide) {
        g.globalAlpha = (1 - f) * 0.7 * dFade
        g.drawImage(sp.coral, b[0] - 14, b[1] - 14, 28, 28)
      }
    }
  }

  // nodes
  const scanY = 120 + 700 * smooth((t - 13.2) / 2.2)
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    const act = smooth((t - n.act) / 0.9)
    if (act <= 0) continue
    const [x, y] = pos[i]
    const lit = t > 13 && t < 16.2 ? Math.max(0, 1 - Math.abs(y - scanY) / 70) : 0
    const flick = t < 10 ? 0.75 + 0.25 * Math.sin(t * 3 + n.ph * 5) : 1
    g.globalAlpha = Math.min(1, (0.8 + lit * 0.9) * act * flick) * (lit > 0 ? 1 : n.human ? 0.3 + 0.7 * dFade : dFade + 0.1)
    if (n.human) {
      g.globalCompositeOperation = 'source-over'
      g.strokeStyle = n.hub ? 'rgb(245,238,255)' : 'rgb(222,208,248)'
      g.lineWidth = (n.hub ? 2 : 1.3) / s
      g.beginPath()
      g.arc(x, y, n.hub ? 9 : 4.4, 0, Math.PI * 2)
      g.stroke()
      g.globalCompositeOperation = 'lighter'
      g.globalAlpha *= n.hub ? 0.9 : 0.4
      const gs = n.hub ? 46 : 20
      g.drawImage(sp.white, x - gs / 2, y - gs / 2, gs, gs)
    } else {
      g.globalCompositeOperation = 'lighter'
      const size = (t < 5 ? 13 : 9) + lit * 7
      g.drawImage(sp.lilac, x - size / 2, y - size / 2, size, size)
    }
  }
  g.globalCompositeOperation = 'lighter'

  // the scan that makes the organization visible
  if (t > 13 && t < 16.4) {
    g.globalAlpha = Math.sin(Math.PI * clamp01((t - 13.2) / 2.8)) * 0.5
    const grad = g.createLinearGradient(160, 0, VW - 160, 0)
    grad.addColorStop(0, 'rgba(183,148,244,0)')
    grad.addColorStop(0.5, 'rgba(225,210,252,1)')
    grad.addColorStop(1, 'rgba(183,148,244,0)')
    g.fillStyle = grad
    g.fillRect(160, scanY - 0.8, VW - 320, 1.6)
  }

  // the horizon: a line of light opens across the field, then blooms behind the logo
  if (t > 16.6) {
    const open = ease((t - 16.7) / 1.5)
    const bloom = smooth((t - 17.6) / 1.8)
    const hy = VH / 2 + 8
    g.globalAlpha = Math.min(1, open * 1.2)
    const grad = g.createLinearGradient(VW / 2 - 900 * open, 0, VW / 2 + 900 * open, 0)
    grad.addColorStop(0, 'rgba(183,148,244,0)')
    grad.addColorStop(0.5, 'rgba(240,230,255,1)')
    grad.addColorStop(1, 'rgba(183,148,244,0)')
    g.fillStyle = grad
    g.fillRect(VW / 2 - 900 * open, hy - 1.2, 1800 * open, 2.4)
    g.globalAlpha = 0.55 * bloom
    g.drawImage(sp.lilac, VW / 2 - 640, hy - 230, 1280, 460)
    g.globalAlpha = 0.22 * bloom
    g.drawImage(sp.white, VW / 2 - 300, hy - 90, 600, 180)
  }

  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'
  g.setTransform(1, 0, 0, 1, 0, 0)
}

/** Opacity curve for a text cue with a fade in and a fade out. */
export function cue(t: number, from: number, to: number, fadeIn = 0.9, fadeOut = 0.7) {
  return smooth((t - from) / fadeIn) * (1 - smooth((t - (to - fadeOut)) / fadeOut))
}
