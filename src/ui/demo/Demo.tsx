import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GITHUB_REPO_URL, SITE_CREDIT, SITE_NAME } from '../../config/site'
import { SYSTEM_HASH } from '../../state/route'
import '../landing/landing.css'
import './demo.css'
import { createMusic, type Music } from './music'
import { SCENES, SCENE_STARTS, TOTAL_SECONDS, type Caption, type CardText, type Ctx } from './script'

const LOGO = '/wand-horizon-logo.png'
const FRAME_W = 1440
const FRAME_H = 810

class Cancelled extends Error {}

type Status = 'idle' | 'playing' | 'paused' | 'ended'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

function frameSrc(run: number) {
  return `${window.location.pathname}?embed=1&run=${run}#/overview`
}

export function Demo() {
  const frame = useRef<HTMLIFrameElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const token = useRef(0)
  const paused = useRef(false)
  const scaleRef = useRef(0.8)
  const music = useRef<Music | null>(null)

  const [status, setStatus] = useState<Status>('idle')
  const [sceneIdx, setSceneIdx] = useState(0)
  const [ms, setMs] = useState(0)
  const [caption, setCaption] = useState<Caption | null>(null)
  const [card, setCard] = useState<CardText | null>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false, clicking: false })
  const [muted, setMuted] = useState(false)
  const [scale, setScale] = useState(0.8)
  const [initialSrc] = useState(() => frameSrc(0))

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const apply = () => {
      const s = el.clientWidth / FRAME_W
      scaleRef.current = s
      setScale(s)
    }
    apply()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(
    () => () => {
      token.current += 1
      music.current?.stop()
    },
    [],
  )

  const reload = useCallback(async (run: number) => {
    const f = frame.current
    if (!f) return
    await new Promise<void>((resolve) => {
      f.addEventListener('load', () => resolve(), { once: true })
      f.src = frameSrc(run)
    })
  }, [])

  const play = useCallback(
    async (from: number) => {
      const mine = ++token.current
      paused.current = false
      setStatus('playing')
      setCaption(null)
      setCard(null)
      setCursor((c) => ({ ...c, visible: false, clicking: false }))
      setSceneIdx(from)
      setMs(SCENE_STARTS[from] * 1000)
      const check = () => {
        if (token.current !== mine) throw new Cancelled()
      }

      try {
        await reload(mine)
        check()
        if (!music.current) music.current = createMusic()
        music.current.setMuted(mutedRef.current)
        music.current.start()

        for (let i = from; i < SCENES.length; i++) {
          const scene = SCENES[i]
          setSceneIdx(i)
          const st = { t: 0 }
          const wait = async (len: number) => {
            let left = len
            while (left > 0) {
              await sleep(50)
              check()
              if (paused.current) continue
              left -= 50
              st.t += 50
              setMs(SCENE_STARTS[i] * 1000 + Math.min(st.t, scene.seconds * 1000))
            }
          }
          const doc = () => frame.current?.contentDocument ?? null
          const ctx: Ctx = {
            wait,
            go: (hash) => {
              const w = frame.current?.contentWindow
              if (w) w.location.hash = hash
            },
            hash: () => frame.current?.contentWindow?.location.hash ?? '',
            find: async (look, timeoutMs = 3500) => {
              const end = Date.now() + timeoutMs
              while (Date.now() < end) {
                check()
                const d = doc()
                const found = d ? look(d) : null
                if (found) return found
                await sleep(80)
              }
              return null
            },
            point: async (el, fx = 0.5, fy = 0.5) => {
              if (!el) return
              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
              await wait(500)
              const r = el.getBoundingClientRect()
              const s = scaleRef.current
              setCursor((c) => ({ ...c, visible: true, x: (r.left + r.width * fx) * s, y: (r.top + r.height * fy) * s }))
              await wait(1000)
            },
            click: async (el) => {
              if (!el) return
              await ctx.point(el)
              setCursor((c) => ({ ...c, clicking: true }))
              await wait(260)
              el.click()
              setCursor((c) => ({ ...c, clicking: false }))
              await wait(450)
            },
            caption: setCaption,
            card: setCard,
            showCursor: (visible) => setCursor((c) => ({ ...c, visible })),
          }
          try {
            await scene.run(ctx)
          } catch (e) {
            if (e instanceof Cancelled) throw e
            // a missing element must never stop the walkthrough
          }
          await wait(Math.max(0, scene.seconds * 1000 - st.t))
        }
        setMs(TOTAL_SECONDS * 1000)
        setStatus('ended')
        music.current?.pause()
      } catch (e) {
        if (!(e instanceof Cancelled)) throw e
      }
    },
    [reload],
  )

  const mutedRef = useRef(false)

  const togglePause = () => {
    if (status === 'playing') {
      paused.current = true
      setStatus('paused')
      music.current?.pause()
    } else if (status === 'paused') {
      paused.current = false
      setStatus('playing')
      music.current?.resume()
    }
  }

  const toggleMute = () => {
    mutedRef.current = !muted
    setMuted(!muted)
    music.current?.setMuted(!muted)
  }

  const seconds = ms / 1000
  const idle = status === 'idle' || status === 'ended'
  const chapters = useMemo(() => SCENES.map((s, i) => ({ ...s, start: SCENE_STARTS[i] })), [])

  return (
    <div className="landing demo">
      <header className="lnav">
        <div className="lnav__inner">
          <a className="lnav__brand" href="#/" aria-label={`${SITE_NAME} home`}>
            <img src={LOGO} alt={SITE_NAME} width="865" height="314" />
          </a>
          <nav className="lnav__links" aria-label="Site">
            <a href="#/">Introduction</a>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
              GitHub
            </a>
          </nav>
          <a className="lbtn lbtn--primary lbtn--sm" href={SYSTEM_HASH}>
            Explore the System
          </a>
        </div>
      </header>

      <main className="wrap demo__main">
        <p className="eyebrow">Product demo</p>
        <h1 className="demo__title">
          Wand Horizon in about <span className="accent">{Math.round(TOTAL_SECONDS / 10) * 10} seconds</span>
        </h1>
        <p className="lede">
          A guided walk through the real application: the executive overview, a conflict and a blocked decision on the workforce map, and the reconstruction of a historical AI authorization.
        </p>

        <section className="player" aria-label="Product demo player">
          <div className="player__stage" ref={stage}>
            <iframe
              ref={frame}
              className="player__frame"
              title="Wand Horizon System, driven by the demo"
              src={initialSrc}
              tabIndex={-1}
              style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})` }}
            />
            <div className={`player__veil${card || idle ? ' is-on' : ''}`} aria-hidden="true" />

            <div className="demo__cursor" aria-hidden="true" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, opacity: cursor.visible ? 1 : 0 }}>
              <span className={`demo__ripple${cursor.clicking ? ' is-on' : ''}`} />
              <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
                <path d="M2 1.5v19l5.3-4.9 3.4 7.6 3-1.3-3.3-7.4h7.3L2 1.5Z" fill="#fff" stroke="#14091f" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>

            {card && !idle && (
              <div className="player__card" key={card.title} role="status">
                {card.eyebrow && <p className="eyebrow">{card.eyebrow}</p>}
                <p className="player__cardtitle">{card.title}</p>
                {card.body && <p className="player__cardbody">{card.body}</p>}
              </div>
            )}

            {status === 'idle' && (
              <div className="player__poster">
                <button className="player__big" onClick={() => void play(0)} aria-label="Play the demo">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
                  </svg>
                </button>
                <p className="player__posterlabel">Play the demo · {fmt(TOTAL_SECONDS)}</p>
                <p className="player__postersub">Real application, synthetic data. Sound is optional and can be muted.</p>
              </div>
            )}

            {status === 'ended' && (
              <div className="player__poster player__poster--end">
                <p className="eyebrow">Wand Horizon</p>
                <p className="player__cardtitle">One workforce. Full accountability.</p>
                <p className="player__cardbody">Everything you just saw ran in the real app on synthetic data.</p>
                <div className="actions actions--center">
                  <a className="lbtn lbtn--primary" href={SYSTEM_HASH}>
                    Explore the System
                  </a>
                  <button className="lbtn lbtn--ghost" onClick={() => void play(0)}>
                    Watch again
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="player__capstrip" aria-live="polite">
            {caption && status !== 'ended' && status !== 'idle' ? (
              <div className="player__caption" key={caption.title}>
                <span className="player__step">{caption.step}</span>
                <p className="player__captiontitle">{caption.title}</p>
                <p className="player__captionbody">{caption.body}</p>
              </div>
            ) : (
              <p className="player__captionbody player__captionbody--idle">Captions appear here while the demo plays.</p>
            )}
          </div>

          <div className="player__bar">
            <button className="player__btn" onClick={idle ? () => void play(0) : togglePause} aria-label={idle ? 'Play' : status === 'paused' ? 'Resume' : 'Pause'}>
              {status === 'playing' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
                </svg>
              )}
            </button>
            <span className="player__time">
              {fmt(seconds)} / {fmt(TOTAL_SECONDS)}
            </span>
            <div className="player__track" role="group" aria-label="Chapters">
              {chapters.map((c, i) => {
                const fill = Math.min(1, Math.max(0, (seconds - c.start) / c.seconds))
                return (
                  <button key={c.id} className="player__seg" style={{ flexGrow: c.seconds }} onClick={() => void play(i)} aria-label={`${c.label}, ${fmt(c.start)}`} title={c.label} aria-current={status !== 'idle' && sceneIdx === i}>
                    <span className="player__fill" style={{ transform: `scaleX(${idle && status === 'idle' ? 0 : fill})` }} />
                  </button>
                )
              })}
            </div>
            <button className="player__btn" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Unmute music' : 'Mute music'}>
              {muted ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                  <path d="m16 9 5 6M21 9l-5 6" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              )}
            </button>
          </div>
        </section>

        <ol className="chapters" aria-label="Chapters">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button className="chapter" onClick={() => void play(i)}>
                <span className="chapter__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="chapter__t">{c.label}</span>
                <span className="chapter__s">{c.summary}</span>
                <span className="chapter__time">{fmt(c.start)}</span>
              </button>
            </li>
          ))}
        </ol>

        <p className="demo__note">
          This is a scripted walkthrough, not a rendered video file. It drives the real application, running on synthetic data, live in your browser, so the numbers, findings and audit events are the product's own. The background music is generated in the browser.
        </p>
      </main>

      <footer className="lfoot">
        <div className="wrap lfoot__inner">
          <img src={LOGO} alt={SITE_NAME} width="865" height="314" />
          <p>A browser prototype on synthetic data. Not production-grade security.</p>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
        </div>
        <p className="lfoot__credit">{SITE_CREDIT}</p>
      </footer>
    </div>
  )
}
