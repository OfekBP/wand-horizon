/**
 * Quiet ambient music, generated in the browser with the Web Audio API: slow sine and triangle chords through a low-pass
 * filter. There is no audio file. It only starts from a click on Play, and can be muted.
 */
const CHORDS = [
  [130.81, 196.0, 246.94, 329.63], // Cmaj7
  [110.0, 164.81, 220.0, 261.63], // Am7
  [87.31, 130.81, 220.0, 261.63], // Fmaj7
  [98.0, 146.83, 246.94, 293.66], // G6
]
const CHORD_SECONDS = 8
const LEVEL = 0.06

export interface Music {
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  setMuted: (m: boolean) => void
}

export function createMusic(): Music {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let timer: number | undefined
  let chord = 0
  let muted = false
  let running = false

  const level = () => (muted || !running ? 0 : LEVEL)
  const ramp = (to: number, s = 0.8) => {
    if (!ctx || !master) return
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(to, ctx.currentTime, s / 3)
  }

  const play = () => {
    if (!ctx || !master) return
    const notes = CHORDS[chord % CHORDS.length]
    chord += 1
    const now = ctx.currentTime
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    filter.connect(master)
    notes.forEach((f, i) => {
      for (const [type, detune, vol] of [['sine', 0, 0.5], ['triangle', 6, 0.18]] as const) {
        const osc = ctx!.createOscillator()
        const g = ctx!.createGain()
        osc.type = type
        osc.frequency.value = f * (i === 3 ? 2 : 1)
        osc.detune.value = detune
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(vol / notes.length, now + 2.6)
        g.gain.linearRampToValueAtTime(0, now + CHORD_SECONDS + 2.4)
        osc.connect(g)
        g.connect(filter)
        osc.start(now)
        osc.stop(now + CHORD_SECONDS + 2.6)
      }
    })
  }

  return {
    start() {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      if (!ctx) {
        ctx = new Ctor()
        master = ctx.createGain()
        master.gain.value = 0
        master.connect(ctx.destination)
      }
      void ctx.resume()
      running = true
      chord = 0
      play()
      window.clearInterval(timer)
      timer = window.setInterval(play, CHORD_SECONDS * 1000)
      ramp(level())
    },
    pause() {
      running = false
      window.clearInterval(timer)
      ramp(0, 0.5)
      window.setTimeout(() => void ctx?.suspend(), 700)
    },
    resume() {
      if (!ctx) return this.start()
      void ctx.resume()
      running = true
      play()
      window.clearInterval(timer)
      timer = window.setInterval(play, CHORD_SECONDS * 1000)
      ramp(level())
    },
    stop() {
      running = false
      window.clearInterval(timer)
      ramp(0, 0.6)
      const c = ctx
      ctx = null
      master = null
      if (c) window.setTimeout(() => void c.close(), 900)
    },
    setMuted(m) {
      muted = m
      ramp(level(), 0.3)
    },
  }
}
