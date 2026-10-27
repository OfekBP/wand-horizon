/**
 * Sound design for the brand film, synthesized live with the Web Audio API (no audio files). It is scheduled against the
 * same timeline as the visuals, and the activation pings use the film's own task pulses, so sound and picture agree.
 *
 *   0-5    a low drone and sparse, consonant pings as nodes wake up
 *   5-10   a rising tension bed, accelerating sub pulses, dissonant pings and collision ticks
 *   10     an impact, a beat of silence, then a resolved shimmering pad
 *   17-22  a rising sweep into the logo hit and a long bell tail
 */
import { buildFilm } from './film'

export interface Score {
  /** Plays the score from `offset` seconds. Safe to call again for a restart. */
  start: (offset: number) => void
  stop: () => void
  setMuted: (m: boolean) => void
}

const PENTA = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 739.99]
const TENSE = [311.13, 329.63, 349.23, 415.3, 440, 466.16, 622.25]

export function createScore(): Score {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let live: AudioScheduledSourceNode[] = []
  let muted = true

  const ensure = () => {
    if (ctx) return ctx
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.9
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    master.connect(comp)
    comp.connect(ctx.destination)
    return ctx
  }

  const noiseBuffer = (c: AudioContext, seconds: number) => {
    const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate)
    const d = b.getChannelData(0)
    let seed = 7
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647
      d[i] = (seed / 2147483647) * 2 - 1
    }
    return b
  }

  const reverbIR = (c: AudioContext) => {
    const len = Math.floor(c.sampleRate * 3.2)
    const b = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch)
      let seed = 11 + ch * 5
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647
        d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 2.6)
      }
    }
    return b
  }

  const stopAll = () => {
    for (const n of live) {
      try {
        n.stop()
      } catch {
        // already stopped
      }
    }
    live = []
  }

  const start = (offset: number) => {
    const c = ensure()
    if (!c || !master) return
    stopAll()
    void c.resume()
    const t0 = c.currentTime - offset + 0.05
    const T = (t: number) => t0 + t
    const dry = master
    const verb = c.createConvolver()
    verb.buffer = reverbIR(c)
    const wet = c.createGain()
    wet.gain.value = 0.55
    verb.connect(wet)
    wet.connect(dry)

    const track = <N extends AudioScheduledSourceNode>(n: N) => {
      live.push(n)
      return n
    }

    /** A gain that follows keypoints [time, value], starting from the right place when joining late. */
    const envelope = (g: GainNode, points: [number, number][], sendVerb = 0) => {
      const valueAt = (t: number) => {
        if (t <= points[0][0]) return points[0][1]
        for (let i = 1; i < points.length; i++) {
          if (t <= points[i][0]) {
            const [ta, va] = points[i - 1]
            const [tb, vb] = points[i]
            return va + ((vb - va) * (t - ta)) / (tb - ta)
          }
        }
        return points[points.length - 1][1]
      }
      g.gain.setValueAtTime(valueAt(offset), c.currentTime)
      for (const [t, v] of points) if (t > offset) g.gain.linearRampToValueAtTime(v, T(t))
      g.connect(dry)
      if (sendVerb > 0) {
        const s = c.createGain()
        s.gain.value = sendVerb
        g.connect(s)
        s.connect(verb)
      }
    }

    const tone = (type: OscillatorType, f: number, from: number, to: number, points: [number, number][], opts: { lp?: number; verb?: number; detune?: number } = {}) => {
      if (to <= offset) return
      const o = track(c.createOscillator())
      o.type = type
      o.frequency.value = f
      if (opts.detune) o.detune.value = opts.detune
      const g = c.createGain()
      o.connect(g)
      if (opts.lp) {
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = opts.lp
        g.disconnect()
        o.disconnect()
        o.connect(lp)
        lp.connect(g)
      }
      envelope(g, points, opts.verb ?? 0)
      o.start(Math.max(c.currentTime, T(Math.max(from, offset))))
      o.stop(T(to))
    }

    /** A short note that decays: used for pings, bells and thumps. */
    const hit = (type: OscillatorType, f: number, at: number, level: number, decay: number, opts: { toF?: number; verb?: number; pan?: number } = {}) => {
      if (at < offset) return
      const o = track(c.createOscillator())
      o.type = type
      o.frequency.setValueAtTime(f, T(at))
      if (opts.toF) o.frequency.exponentialRampToValueAtTime(opts.toF, T(at + decay))
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, T(at))
      g.gain.exponentialRampToValueAtTime(level, T(at + 0.012))
      g.gain.exponentialRampToValueAtTime(0.0001, T(at + decay))
      o.connect(g)
      let out: AudioNode = g
      if (opts.pan !== undefined && c.createStereoPanner) {
        const p = c.createStereoPanner()
        p.pan.value = opts.pan
        g.connect(p)
        out = p
      }
      out.connect(dry)
      if (opts.verb) {
        const s = c.createGain()
        s.gain.value = opts.verb
        out.connect(s)
        s.connect(verb)
      }
      o.start(T(at))
      o.stop(T(at + decay + 0.05))
    }

    const noise = (from: number, to: number, kind: BiquadFilterType, f0: number, f1: number, points: [number, number][], verbSend = 0) => {
      if (to <= offset) return
      const src = track(c.createBufferSource())
      src.buffer = noiseBuffer(c, Math.max(0.3, to - from + 0.2))
      const f = c.createBiquadFilter()
      f.type = kind
      f.Q.value = kind === 'bandpass' ? 1.4 : 0.7
      const startAt = Math.max(from, offset)
      const frac = (startAt - from) / (to - from)
      f.frequency.setValueAtTime(f0 * Math.pow(f1 / f0, frac), c.currentTime)
      f.frequency.exponentialRampToValueAtTime(f1, T(to))
      const g = c.createGain()
      src.connect(f)
      f.connect(g)
      envelope(g, points, verbSend)
      src.start(Math.max(c.currentTime, T(startAt)))
      src.stop(T(to + 0.1))
    }

    // 0-10: the drone that carries the first two acts
    tone('sine', 55, 0, 10.05, [[0, 0], [1.6, 0.16], [9.8, 0.26], [10.0, 0.02]])
    tone('sawtooth', 55.4, 0, 10.05, [[0, 0], [2, 0.05], [9.8, 0.1], [10.0, 0]], { lp: 260 })
    tone('sawtooth', 82.4, 3, 10.05, [[3, 0], [8, 0.05], [9.9, 0.08], [10.0, 0]], { lp: 420 })
    // 5-10: a tritone beneath, a riser, accelerating sub pulses
    tone('sawtooth', 110, 5, 10.05, [[5, 0], [9.8, 0.05], [10.0, 0]], { lp: 600 })
    tone('sawtooth', 155.6, 5, 10.05, [[5, 0], [9.8, 0.045], [10.0, 0]], { lp: 700, detune: 8 })
    noise(5, 9.98, 'bandpass', 300, 7000, [[5, 0], [8, 0.07], [9.9, 0.22], [9.99, 0]], 0.2)
    let beat = 5.2
    let gap = 0.95
    while (beat < 9.9) {
      hit('sine', 75, beat, 0.4, 0.22, { toF: 42 })
      beat += gap
      gap = Math.max(0.3, gap * 0.9)
    }

    // pings that come from the film's own task pulses
    const pulses = buildFilm().pulses.filter((p) => !p.org)
    pulses.forEach((p, i) => {
      if (i % 3 !== 0) return
      const end = p.t0 + p.dur
      if (end > 9.85 || end < 0.9) return
      const tense = end > 5.5
      const scale = tense ? TENSE : PENTA
      const f = scale[(i * 7) % scale.length] * (i % 5 === 0 ? 2 : 1)
      const lvl = 0.03 + 0.03 * Math.min(1, end / 8)
      hit('sine', f, end, lvl, tense ? 0.22 : 0.45, { verb: 0.5, pan: ((i * 37) % 100) / 50 - 1 })
      if (p.collide && i % 2 === 0) noise(end, end + 0.06, 'bandpass', 2400, 1800, [[end - 0.01, 0], [end, 0.05], [end + 0.06, 0]])
    })

    // 10: impact, a breath, resolution
    hit('sine', 120, 10, 0.7, 1.4, { toF: 32, verb: 0.3 })
    noise(10, 10.7, 'lowpass', 3500, 200, [[9.995, 0], [10.01, 0.4], [10.7, 0]], 0.6)
    const chord = [146.83, 220, 329.63, 369.99, 440]
    chord.forEach((f, i) => {
      tone('sine', f, 10.3, 17.6, [[10.3, 0], [12.2, 0.07 - i * 0.006], [16.8, 0.07 - i * 0.006], [17.6, 0]], { verb: 0.5 })
      tone('triangle', f * 2, 10.6, 17.6, [[10.6, 0], [12.8, 0.014], [16.8, 0.014], [17.6, 0]], { verb: 0.6, detune: 5 })
    })
    const bells = [587.33, 739.99, 880, 659.25]
    for (let i = 0; i < 9; i++) hit('sine', bells[i % bells.length], 11.1 + i * 0.72, 0.045, 1.6, { verb: 0.7, pan: i % 2 ? 0.5 : -0.5 })

    // 17-22: the sweep, the logo hit and its tail
    noise(16.9, 17.95, 'bandpass', 400, 4200, [[16.9, 0], [17.85, 0.13], [17.95, 0]], 0.4)
    hit('sine', 55, 17.95, 0.75, 3.4, { toF: 36, verb: 0.3 })
    for (const [f, d] of [[587.33, 0], [880, 0.08], [1174.66, 0.16], [1479.98, 0.26]] as const) hit('sine', f, 17.95 + d, 0.06, 3.2, { verb: 0.9 })
    hit('triangle', 293.66, 17.95, 0.05, 3.6, { verb: 0.8 })
    // everything is gone by the end
    master.gain.cancelScheduledValues(c.currentTime)
    master.gain.setValueAtTime(muted ? 0 : 0.9, c.currentTime)
    master.gain.setTargetAtTime(0, T(22.4), 0.5)
  }

  return {
    start,
    stop() {
      stopAll()
      if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
    },
    setMuted(m) {
      muted = m
      if (ctx && master) {
        master.gain.cancelScheduledValues(ctx.currentTime)
        master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.12)
      }
    },
  }
}
