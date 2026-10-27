import { useCallback, useEffect, useRef, useState } from 'react'
import { SITE_CREDIT, SITE_NAME } from '../../config/site'
import { DEMO_HASH, HOME_HASH, SYSTEM_HASH } from '../../state/route'
import { DURATION, buildFilm, cue, drawFrame, makeSprites, smooth, type Sprites } from './film'
import { createScore, type Score } from './score'
import './intro.css'

const LOGO = '/wand-horizon-logo.png'
const TAGLINE = 'Command the intelligence workforce.'

function setStyle(el: HTMLElement | null, o: number, rise = 14, blur = 9, extra = '') {
  if (!el) return
  el.style.opacity = String(o)
  el.style.transform = `translateY(${(1 - o) * rise}px) ${extra}`
  el.style.filter = o >= 0.999 ? 'none' : `blur(${(1 - o) * blur}px)`
}

/** A self-playing brand film, drawn on a canvas as a pure function of time, with replay and sound controls. */
export function Intro() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const line1 = useRef<HTMLParagraphElement>(null)
  const line2 = useRef<HTMLParagraphElement>(null)
  const words = useRef<(HTMLSpanElement | null)[]>([])
  const logo = useRef<HTMLDivElement>(null)
  const tag = useRef<HTMLParagraphElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const startAt = useRef(0)
  const raf = useRef(0)
  const sprites = useRef<Sprites | null>(null)
  const score = useRef<Score | null>(null)
  const scoreRunning = useRef(false)
  const lastT = useRef(0)
  const soundOn = useRef(false)

  const [ended, setEnded] = useState(false)
  const [sound, setSound] = useState(false)
  const [reduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const render = useCallback((t: number) => {
    lastT.current = t
    const cv = canvas.current
    if (cv && sprites.current) {
      const g = cv.getContext('2d')
      if (g) drawFrame(g, buildFilm(), t, cv.width, cv.height, sprites.current)
    }
    setStyle(line1.current, cue(t, 0.9, 4.7, 1, 0.8), 18, 10)
    // the second line trembles as the field becomes restless
    const tremble = smooth((t - 6) / 3) * (1 - smooth((t - 9.7) / 0.3))
    setStyle(line2.current, cue(t, 5.4, 9.8, 0.7, 0.4), 12, 8, `translateX(${Math.sin(t * 53) * 2.2 * tremble}px)`)
    ;[11.6, 13.1, 14.6].forEach((from, i) => setStyle(words.current[i], cue(t, from, 99, 0.9, 0.001) * (1 - smooth((t - 16.6) / 0.7)), 10, 6))
    const logoO = smooth((t - 17.9) / 1.4)
    if (logo.current) {
      logo.current.style.opacity = String(logoO)
      logo.current.style.transform = `scale(${0.94 + 0.06 * logoO})`
      logo.current.style.filter = logoO >= 0.999 ? 'none' : `blur(${(1 - logoO) * 14}px)`
    }
    const tagO = smooth((t - 19.3) / 1.2)
    if (tag.current) {
      tag.current.style.opacity = String(tagO)
      tag.current.style.letterSpacing = `${0.34 - 0.26 * tagO}em`
      tag.current.style.transform = `translateY(${(1 - tagO) * 8}px)`
    }
    if (endRef.current) endRef.current.style.opacity = String(smooth((t - (DURATION + 0.2)) / 0.8))
  }, [])

  const resize = useCallback(() => {
    const cv = canvas.current
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.max(1, Math.floor(cv.clientWidth * dpr))
    cv.height = Math.max(1, Math.floor(cv.clientHeight * dpr))
    render(lastT.current)
  }, [render])

  const loop = useCallback(
    (now: number) => {
      const t = (now - startAt.current) / 1000
      if (t >= DURATION + 1) {
        render(DURATION + 1)
        setEnded(true)
        return
      }
      render(t)
      raf.current = requestAnimationFrame(loop)
    },
    [render],
  )

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current)
    setEnded(false)
    startAt.current = performance.now()
    scoreRunning.current = false
    if (soundOn.current) {
      score.current?.start(0)
      scoreRunning.current = true
    }
    raf.current = requestAnimationFrame(loop)
  }, [loop])

  useEffect(() => {
    sprites.current = makeSprites()
    buildFilm()
    resize()
    window.addEventListener('resize', resize)
    // ?t=12 freezes the film on that second (stills and review); reduced motion shows the final frame
    const frozen = Number(new URLSearchParams(window.location.search).get('t'))
    if (frozen > 0) {
      render(frozen)
    } else if (reduced) {
      render(DURATION + 1)
      setEnded(true)
    } else {
      play()
    }
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf.current)
      score.current?.stop()
    }
  }, [play, render, reduced, resize])

  const toggleSound = () => {
    if (!score.current) score.current = createScore()
    const next = !soundOn.current
    soundOn.current = next
    setSound(next)
    score.current.setMuted(!next)
    if (next && !scoreRunning.current && !ended) {
      score.current.start(Math.max(0, lastT.current))
      scoreRunning.current = true
    }
  }

  return (
    <div className="intro">
      <h1 className="sr-only">{SITE_NAME}. {TAGLINE}</h1>
      <canvas ref={canvas} className="intro__canvas" aria-hidden="true" />
      <div className="intro__vignette" aria-hidden="true" />
      <div className="intro__bar intro__bar--top" aria-hidden="true" />
      <div className="intro__bar intro__bar--bottom" aria-hidden="true" />
      <div className="intro__grain" aria-hidden="true" />

      <div className="intro__stage" aria-live="off">
        <p ref={line1} className="intro__line" style={{ opacity: 0 }}>
          The workforce is <em>changing.</em>
        </p>
        <p ref={line2} className="intro__line" style={{ opacity: 0 }}>
          Who’s in <em>control?</em>
        </p>
        <div className="intro__words" aria-hidden="true">
          {['Visibility', 'Governance', 'Accountability'].map((w, i) => (
            <span key={w} ref={(el) => void (words.current[i] = el)} style={{ opacity: 0 }}>
              {w}
            </span>
          ))}
        </div>
        <div ref={logo} className="intro__logo" style={{ opacity: 0 }}>
          <img src={LOGO} alt="" width="865" height="314" />
        </div>
        <p ref={tag} className="intro__tag" style={{ opacity: 0 }}>
          {TAGLINE}
        </p>
      </div>

      <div className="intro__top">
        <a href={HOME_HASH} className="intro__back">
          ← {SITE_NAME}
        </a>
        <div className="intro__controls">
          <button className={`intro__ctl${!sound ? ' is-pulsing' : ''}`} onClick={toggleSound} aria-pressed={sound}>
            {sound ? 'Sound on' : 'Turn sound on'}
          </button>
          <button className="intro__ctl" onClick={play}>
            Replay
          </button>
        </div>
      </div>

      <div ref={endRef} className="intro__end" style={{ opacity: 0, pointerEvents: ended ? 'auto' : 'none' }}>
        <a className="intro__cta intro__cta--primary" href={SYSTEM_HASH} tabIndex={ended ? 0 : -1}>
          Explore the System
        </a>
        <a className="intro__cta" href={DEMO_HASH} tabIndex={ended ? 0 : -1}>
          Watch the product demo
        </a>
        <button className="intro__cta" onClick={play} tabIndex={ended ? 0 : -1}>
          Replay the film
        </button>
        <p className="intro__credit">{SITE_CREDIT}</p>
      </div>
    </div>
  )
}
