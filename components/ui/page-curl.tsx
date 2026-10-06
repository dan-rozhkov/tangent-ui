"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import type { AnimationPlaybackControls, Transition } from "motion/react"
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface PageCurlProps {
  /** Page contents in reading order. Page one is the cover and sits alone on the right. */
  pages: ReactNode[]
  /** Controlled spread. 0 shows the cover; spread n shows pages 2n and 2n + 1 (one-based). */
  spread?: number
  /** Initial spread when uncontrolled. */
  defaultSpread?: number
  /** Called when a page finishes turning. */
  onSpreadChange?: (spread: number) => void
  /** Page width divided by height. */
  pageAspect?: number
  /** Accessible name of the book. */
  label?: string
  /** Curls the cover corner once when the book first comes into view, and a little on hover until the first turn. */
  tease?: boolean
  /** Hint under the lower outer corner, shown until the first interaction. Pass null to hide it. */
  hint?: ReactNode | null
  /** Shows the page count with previous and next buttons under the book. */
  controls?: boolean
  /** Extra class on the root. Its width holds two pages side by side. */
  className?: string
  style?: CSSProperties
}

/* ------------------------------------------------------------------------------------------------
 * Geometry
 *
 * Everything is solved in "sheet" space: the turning sheet lies on x in [0, pw], y in [0, ph] with the
 * spine at x = 0, whichever side it sits on. Screen space has its origin at the top of the spine; the
 * left sheet maps to it through a mirror. Each page face has its own content space (its slot's local box),
 * so the CSS for a layer is one affine matrix and one clip polygon in that layer's own coordinates.
 * --------------------------------------------------------------------------------------------- */

type Point = { x: number; y: number }
/** CSS matrix order: x' = a x + c y + e, y' = b x + d y + f. */
type Affine = readonly [number, number, number, number, number, number]

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0]
const MIRROR: Affine = [-1, 0, 0, 1, 0, 0]

function compose(m: Affine, n: Affine): Affine {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

const apply = (m: Affine, p: Point): Point => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })
const css = (m: Affine) => `matrix(${m.map(value => +value.toFixed(4)).join(",")})`
const polygon = (points: Point[]) =>
  points.length < 3 ? "polygon(0 0, 0 0, 0 0)" : `polygon(${points.map(p => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(", ")})`
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y

/** Keeps the part of a convex polygon where `side` is zero or more (one Sutherland–Hodgman pass). */
function clipHalf(points: Point[], side: (p: Point) => number): Point[] {
  const out: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const cur = points[i]
    const prev = points[(i + points.length - 1) % points.length]
    const fc = side(cur)
    const fp = side(prev)
    if ((fc >= 0) !== (fp >= 0)) {
      const t = fp / (fp - fc)
      out.push({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t })
    }
    if (fc >= 0) out.push(cur)
  }
  return out
}

/** Reflection across the line through `m` with unit normal `n`. */
function reflection(m: Point, n: Point): Affine {
  const k = 2 * dot(m, n)
  return [1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.y, 1 - 2 * n.y * n.y, k * n.x, k * n.y]
}

/**
 * A shade box whose local x runs along the fold normal `n` (from `start` px past the fold at `m`) and whose local y runs
 * along the fold, centred on `m`. Its gradients run along local x, so they always fall off perpendicular to the crease.
 */
function shadeBox(m: Point, n: Point, start: number, span: number): Affine {
  const t = { x: -n.y, y: n.x }
  return [n.x, n.y, t.x, t.y, m.x + start * n.x - (span / 2) * t.x, m.y + start * n.y - (span / 2) * t.y]
}

/** Shade strength from how far the corner is lifted: a faint floor at rest, near linear at first, easing into a cap. */
const shadeFor = (lift: number) => 0.14 + 0.75 * Math.sin((Math.PI / 2) * Math.min(1, lift / 200))

/**
 * Paper bound on one side: no point of the spine may get farther from the grabbed point than it is on the
 * flat sheet. The two spine ends are the binding limits, so the point is pulled into both discs.
 */
function bind(p: Point, anchor: Point, ph: number): Point {
  const ends = [
    { x: 0, y: 0 },
    { x: 0, y: ph },
  ]
  let q = p
  for (let pass = 0; pass < 4; pass++) {
    for (const end of ends) {
      const limit = Math.hypot(anchor.x - end.x, anchor.y - end.y)
      const dx = q.x - end.x
      const dy = q.y - end.y
      const distance = Math.hypot(dx, dy)
      if (distance > limit && distance > 0) q = { x: end.x + (dx / distance) * limit, y: end.y + (dy / distance) * limit }
    }
  }
  return q
}

type Direction = 1 | -1
type Mode = "lift" | "drag" | "turn"

/** Sheet to screen. The right sheet is already in screen space; the left one is mirrored across the spine. */
const sheetToScreen = (dir: Direction): Affine => (dir === 1 ? IDENTITY : MIRROR)
/** Content to sheet for the face that rests on the sheet's own side, and for its back. */
function faces(dir: Direction, pw: number) {
  const flip: Affine = [-1, 0, 0, 1, pw, 0]
  return dir === 1 ? { front: IDENTITY, back: flip } : { front: flip, back: IDENTITY }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Buttons, keys and taps turn on a soft spring after a short beat, so the page visibly gathers before it travels.
 * It would overshoot a little; the turn ends the moment the page lands instead.
 */
const TURN: Transition = { type: "spring", stiffness: 64, damping: 12.8, delay: 0.07 }
/** A released drag keeps its momentum on a critically damped spring. */
const RELEASE: Transition = { type: "spring", stiffness: 196, damping: 28 }
const SETTLE: Transition = motionTokens.spring.smooth
/** The tease rises a little slower than it settles, so the corner reads as being lifted, not flicked. */
const TEASE_RISE: Transition = { type: "spring", stiffness: 121, damping: 21 }
const TEASE_FALL: Transition = RELEASE
/** The tease waits for the reader to look at the book, and holds the corner up for a beat before laying it down. */
const TEASE_DELAY = 780
const TEASE_HOLD = 815
const TEASE_GAP = 2500
/** Tease lift, as a fraction of the page: about a quarter of the page height along the diagonal. */
const TEASE_LIFT = { x: -0.2626, y: -0.1313 }
/** Hovering a corner lifts it by a fixed amount, wherever in the corner the pointer is. */
const HOVER_LIFT = { x: -0.1478, y: -0.0815 }
/** The corner hot zone, as a fraction of the page width. */
const HOVER_ZONE = 0.13
/** How long the page waits after the pointer leaves a lifted corner before laying it down, in seconds. */
const HOVER_LEAVE = 0.058
const leave: Transition = { ...motionTokens.spring.smooth, delay: HOVER_LEAVE }
/** Peak lift of the curve a programmatic turn follows, as a fraction of the page height. */
const TURN_RISE = 0.16
/** A release turns the page when the corner, carried this many seconds further by its velocity, is past this share of the page. */
const PROJECT = 0.1
const COMMIT = 0.6
/** A drag of this many px decides between a tap and a drag. */
const TAP_SLOP = 5

/* ------------------------------------------------------------------------------------------------ */

/** Pages are square at the spine and softly rounded on their outer edge. */
const pageShape = (rests: "left" | "right") => (rests === "right" ? "rounded-[2px_6px_6px_2px]" : "rounded-[6px_2px_2px_6px]")
/** A hairline ring and the raised shadow, so a page reads as paper lying on the surface. */
const pageShadow = "shadow-[0_0_0_1px_var(--border),var(--shadow-raised)]"

function Face({ children, rests }: { children: ReactNode; rests: "left" | "right" }) {
  return <div className={cn("relative size-full overflow-hidden bg-surface-raised", pageShape(rests))}>{children}</div>
}

/** The three crease shades. Each is a large box turned to the fold; only its gradient near the crease ever shows. */
const SHADE = {
  /** On the flat sheet, darkening into the crease. */
  front: "linear-gradient(270deg, oklch(0% 0 0 / .12), transparent 22px)",
  /** Cast on the page below, just past the crease. */
  under: "linear-gradient(90deg, oklch(0% 0 0 / .26), oklch(0% 0 0 / .08) 18px, transparent 48px)",
  /** The lit curl on the back of the lifted part: a dark crease, a highlight where the bent paper catches the light, then flat. */
  flap: "linear-gradient(90deg, oklch(0% 0 0 / .14), oklch(100% 0 0 / .2) 7px, oklch(100% 0 0 / 0) 26px, oklch(0% 0 0 / .03) 70%)",
}

const controlClass =
  "grid size-control-sm flex-none cursor-pointer place-items-center rounded-pill border-0 bg-transparent p-0 text-foreground [-webkit-tap-highlight-color:transparent] [transition:background-color_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)] pointer-fine:hover:not-disabled:bg-surface-muted active:not-disabled:[transform:scale(.97)] disabled:cursor-default disabled:opacity-30 motion-reduce:transition-none!"

/**
 * A small book or magazine that opens on its cover. Drag a page and it folds along the perpendicular bisector of
 * the grabbed point and the pointer, showing its back with a lit curl and a shadow on the page below. Tap a page,
 * use the arrow keys, or the buttons to turn along a lifted curve.
 */
export function PageCurl({
  pages,
  spread: controlled,
  defaultSpread = 0,
  onSpreadChange,
  pageAspect = 0.72,
  label = "Book",
  tease = true,
  hint = "Drag the corner",
  controls = true,
  className,
  style,
}: PageCurlProps) {
  const reduce = useReducedMotion() ?? false
  const total = pages.length
  const last = Math.max(0, Math.floor(total / 2))
  const [inner, setInner] = useState(() => Math.min(Math.max(0, defaultSpread), last))
  const shown = Math.min(Math.max(0, controlled ?? inner), last)
  const [turning, setTurning] = useState<{ dir: Direction; mode: Mode } | null>(null)
  const [size, setSize] = useState({ pw: 0, ph: 0 })
  const [interacted, setInteracted] = useState(false)
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null)

  const book = useRef<HTMLDivElement>(null)
  const shift = useRef<HTMLDivElement>(null)
  const leftSlot = useRef<HTMLDivElement>(null)
  const rightSlot = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLDivElement>(null)
  const curl = useRef<HTMLDivElement>(null)
  const under = useRef<HTMLDivElement>(null)
  const frontShade = useRef<HTMLDivElement>(null)

  const px = useMotionValue(0)
  const py = useMotionValue(0)
  /** The book's horizontal shift: a closed book centres on its lone cover. */
  const slide = useMotionValue(0)
  const slideRun = useRef<{ to: number; controls: AnimationPlaybackControls } | undefined>(undefined)
  /** While a page is dragged the book follows the fold; otherwise it slides on its own spring. */
  const slideFollows = useRef(false)
  const anchor = useRef<Point>({ x: 0, y: 0 })
  const dirRef = useRef<Direction | 0>(0)
  const shownRef = useRef(shown)
  const sizeRef = useRef(size)
  const run = useRef<AnimationPlaybackControls | undefined>(undefined)
  const busy = useRef(false)
  const turnedOnce = useRef(false)
  const lastTease = useRef(0)
  const holdTimer = useRef<number | undefined>(undefined)
  /** The run that is laying a lifted corner back down, so pointer moves do not restart it every frame. */
  const lowering = useRef<AnimationPlaybackControls | undefined>(undefined)
  const press = useRef<{
    id: number
    dir: Direction
    start: Point
    offset: Point
    dragging: boolean
    samples: { t: number; x: number; y: number }[]
  } | null>(null)

  useLayoutEffect(() => {
    shownRef.current = shown
  }, [shown])

  // Page size derives from the root width.
  useLayoutEffect(() => {
    const node = book.current
    if (!node) return
    const measure = () => {
      const width = node.clientWidth
      const next = { pw: width / 2, ph: width / 2 / pageAspect }
      sizeRef.current = next
      setSize(prev => (prev.pw === next.pw && prev.ph === next.ph ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [pageAspect])

  const hasPage = useCallback((index: number) => index >= 0 && index < total, [total])
  /** The closed book centres on its cover and on a back cover that sits alone on the left. */
  const offsetFor = useCallback(
    (spread: number, pw: number) => {
      if (total < 2) return 0
      if (spread === 0) return -pw / 2
      if (spread === last && !hasPage(2 * spread)) return pw / 2
      return 0
    },
    [hasPage, last, total],
  )
  const canTurn = useCallback((dir: Direction) => (dir === 1 ? shownRef.current < last : shownRef.current > 0), [last])

  /** Slides the book to where `spread` rests, on the smooth spring, or at once. */
  const slideTo = useCallback(
    (spread: number, instant: boolean) => {
      const to = offsetFor(spread, sizeRef.current.pw)
      if (slideRun.current?.to === to) return
      slideRun.current?.controls.stop()
      slideRun.current = undefined
      if (instant || Math.abs(slide.get() - to) < 0.5) {
        slide.jump(to)
        return
      }
      const controls = animate(slide, to, {
        ...SETTLE,
        onComplete: () => {
          if (slideRun.current?.controls === controls) slideRun.current = undefined
        },
      })
      slideRun.current = { to, controls }
    },
    [offsetFor, slide],
  )

  /** Writes the fold for the current corner position straight to the DOM; no React render per frame. */
  const draw = useCallback(() => {
    const dir = dirRef.current
    const { pw, ph } = sizeRef.current
    if (!dir || !pw) return
    const a = anchor.current
    const p = bind({ x: px.get(), y: py.get() }, a, ph)
    if (slideFollows.current) {
      const progress = clamp01((a.x - p.x) / (2 * pw))
      slide.set(lerp(offsetFor(shownRef.current, pw), offsetFor(shownRef.current + dir, pw), progress * progress * (3 - 2 * progress)))
    }

    const slot = (dir === 1 ? rightSlot : leftSlot).current
    const backNode = back.current
    const dx = a.x - p.x
    const dy = a.y - p.y
    const length = Math.hypot(dx, dy)
    if (length < 0.5) {
      if (slot) slot.style.clipPath = ""
      if (backNode) backNode.style.visibility = "hidden"
      for (const node of [under.current, frontShade.current]) if (node) node.style.opacity = "0"
      return
    }
    // The fold is the perpendicular bisector of the grabbed corner and where it has been lifted to; n points from the
    // lifted corner back toward the grabbed one, so the part of the sheet past the fold is the part that lifts.
    const n = { x: dx / length, y: dy / length }
    const mid = { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 }
    const sheet = [
      { x: 0, y: 0 },
      { x: pw, y: 0 },
      { x: pw, y: ph },
      { x: 0, y: ph },
    ]
    const side = (q: Point) => (q.x - mid.x) * n.x + (q.y - mid.y) * n.y
    // The flat part stays where it is; the part beyond the fold lifts and is mirrored across it.
    const flat = clipHalf(sheet, q => -side(q))
    const folded = clipHalf(sheet, side)
    const map = faces(dir, pw)
    const screen = sheetToScreen(dir)
    // Both content maps are their own inverses (identity or a mirror), so they also take sheet points back to content space.
    if (slot) slot.style.clipPath = polygon(flat.map(q => apply(map.front, q)))
    if (backNode) {
      backNode.style.visibility = "visible"
      backNode.style.transform = css(compose(screen, compose(reflection(mid, n), map.back)))
      backNode.style.clipPath = polygon(folded.map(q => apply(map.back, q)))
    }
    // The shades are boxes about twice the page diagonal, so their ends never show inside the page.
    const diagonal = Math.hypot(pw, ph)
    const depth = 2 * diagonal
    const span = 2.2 * diagonal
    const strength = String(shadeFor(length))
    const place = (node: HTMLDivElement | null, content: Affine, start: number, opacity: string) => {
      if (!node) return
      node.style.width = `${depth}px`
      node.style.height = `${span}px`
      node.style.opacity = opacity
      node.style.transform = css(compose(content, shadeBox(mid, n, start, span)))
    }
    // The flat sheet darkens into the crease, from the flat side.
    place(frontShade.current, map.front, -depth, strength)
    // The page below takes the sheet's shadow just past the crease.
    place(under.current, map.front, 0, strength)
    // The back of the lifted part, before it is mirrored across the fold, lies past the crease too.
    place(curl.current, map.back, 0, "1")
  }, [offsetFor, px, py, slide])

  useEffect(() => {
    const offX = px.on("change", draw)
    const offY = py.on("change", draw)
    return () => {
      offX()
      offY()
    }
  }, [draw, px, py])

  // Layers mount with the turning state, so draw once before they paint; at rest, clear the clips and settle the book.
  useLayoutEffect(() => {
    if (!turning) {
      dirRef.current = 0
      slideFollows.current = false
      for (const slot of [leftSlot.current, rightSlot.current]) if (slot) slot.style.clipPath = ""
      // A slide already heading here keeps going; anything else (first paint, a resize, a controlled jump) lands at once.
      if (slideRun.current?.to !== offsetFor(shown, size.pw)) slideTo(shown, true)
    }
    draw()
  }, [turning, shown, size, draw, offsetFor, slideTo])

  const stopAll = () => {
    run.current?.stop()
    run.current = undefined
    window.clearTimeout(holdTimer.current)
    holdTimer.current = undefined
  }

  /**
   * Moves the lifted corner along `path` (0 to 1) on a spring, with an optional starting velocity along it. The path is
   * never followed past its end: a spring that would overshoot finishes as it lands.
   */
  const travel = (path: (k: number) => Point, transition: Transition, onDone?: () => void, velocity = 0) => {
    run.current?.stop()
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      run.current?.stop()
      run.current = undefined
      const p = path(1)
      px.set(p.x)
      py.set(p.y)
      onDone?.()
    }
    const end = path(1)
    run.current = animate(0, 1, {
      ...transition,
      velocity,
      onUpdate: k => {
        if (finished) return
        const p = path(Math.min(k, 1))
        px.set(p.x)
        py.set(p.y)
        // A critically damped spring spends its last few hundred ms inside a pixel of the target; hand over once it is there.
        if (k >= 1 || (k > 0.9 && Math.hypot(p.x - end.x, p.y - end.y) < 0.75)) queueMicrotask(finish)
      },
      onComplete: finish,
    })
  }

  const begin = (dir: Direction, a: Point, mode: Mode) => {
    dirRef.current = dir
    anchor.current = a
    px.jump(a.x)
    py.jump(a.y)
    setTurning({ dir, mode })
  }

  const rest = () => {
    busy.current = false
    dirRef.current = 0
    setTurning(null)
  }

  const commit = (dir: Direction) => {
    const next = shownRef.current + dir
    turnedOnce.current = true
    busy.current = false
    dirRef.current = 0
    shownRef.current = next
    setTurning(null)
    if (controlled === undefined) setInner(next)
    onSpreadChange?.(next)
  }

  /** Taps, keys and buttons all turn along one lifted curve from the lower outer corner, whatever triggered them. */
  const turn = (dir: Direction) => {
    if (busy.current || !canTurn(dir)) return
    setInteracted(true)
    const { pw, ph } = sizeRef.current
    if (reduce || !pw) {
      stopAll()
      rest()
      commit(dir)
      return
    }
    stopAll()
    busy.current = true
    const a = { x: pw, y: ph }
    // A corner already lifted by hover carries on from where it is.
    const continuing = dirRef.current === dir && anchor.current.x === a.x && anchor.current.y === a.y
    const from = continuing ? { x: px.get() - a.x, y: py.get() - a.y } : { x: 0, y: 0 }
    if (continuing) setTurning({ dir, mode: "turn" })
    else begin(dir, a, "turn")
    slideFollows.current = false
    slideTo(shownRef.current + dir, false)
    const rise = ph * TURN_RISE
    travel(
      k => ({ x: a.x - 2 * pw * k + from.x * (1 - k), y: a.y - rise * Math.sin(Math.PI * k) + from.y * (1 - k) }),
      TURN,
      () => commit(dir),
    )
  }

  /** Lifts a corner to `to` on `transition`, and lays it back down `hold` ms after it started, if asked. */
  const lift = (dir: Direction, a: Point, to: Point, transition: Transition, hold?: number) => {
    window.clearTimeout(holdTimer.current)
    holdTimer.current = undefined
    if (dirRef.current !== dir || anchor.current.x !== a.x || anchor.current.y !== a.y) begin(dir, a, "lift")
    const from = { x: px.get(), y: py.get() }
    travel(k => ({ x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) }), transition)
    if (hold !== undefined)
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = undefined
        lower(TEASE_FALL)
      }, hold)
  }

  const isLowering = () => run.current !== undefined && run.current === lowering.current

  const lower = (transition: Transition = SETTLE, onDone?: () => void) => {
    if (!dirRef.current) return
    const a = anchor.current
    const from = { x: px.get(), y: py.get() }
    travel(
      k => ({ x: lerp(from.x, a.x, k), y: lerp(from.y, a.y, k) }),
      transition,
      () => {
        rest()
        onDone?.()
      },
    )
    lowering.current = run.current
  }

  const teaseCover = (scale: number) => {
    const { pw, ph } = sizeRef.current
    if (!tease || reduce || !pw || turnedOnce.current || busy.current || press.current || shownRef.current !== 0 || total < 2) return
    lastTease.current = performance.now()
    const a = { x: pw, y: ph }
    lift(1, a, { x: a.x + TEASE_LIFT.x * pw * scale, y: a.y + TEASE_LIFT.y * ph * scale }, TEASE_RISE, TEASE_HOLD)
  }

  // The first time the book is mostly in view, the cover corner lifts about a quarter of the page height and lays back down.
  useEffect(() => {
    const node = book.current
    if (!node || !tease || reduce || typeof IntersectionObserver === "undefined") return
    let done = false
    let timer: number | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (done || !entry.isIntersecting) return
        done = true
        observer.disconnect()
        timer = window.setTimeout(() => teaseCover(1), TEASE_DELAY)
      },
      { threshold: 0.6 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount
  }, [tease, reduce])

  useEffect(
    () => () => {
      stopAll()
      slideRun.current?.controls.stop()
    },
    [],
  )

  /* ---------------------------------------------- pointer --------------------------------------------- */

  /** Pointer position in sheet space for a direction: origin at the top of the spine, outer edge at x = pw. */
  const toSheet = (event: { clientX: number; clientY: number }, dir: Direction): Point => {
    const rect = shift.current!.getBoundingClientRect()
    const { pw } = sizeRef.current
    const x = event.clientX - rect.left - pw
    return { x: dir === 1 ? x : -x, y: event.clientY - rect.top }
  }

  const cornerAt = (g: Point): Point | null => {
    const { pw, ph } = sizeRef.current
    const zone = pw * HOVER_ZONE
    if (g.x < pw - zone || g.x > pw) return null
    if (g.y > ph - zone) return { x: pw, y: ph }
    if (g.y < zone) return { x: pw, y: 0 }
    return null
  }

  /** Which page is under the pointer. Hit testing is by position, since a lifted corner is clipped out of its own page. */
  const sideOf = (event: { clientX: number }): "left" | "right" | null => {
    const node = shift.current
    if (!node) return null
    const rect = node.getBoundingClientRect()
    const x = event.clientX - rect.left - sizeRef.current.pw
    const side = x >= 0 ? "right" : "left"
    return hasPage(side === "right" ? 2 * shownRef.current : 2 * shownRef.current - 1) ? side : null
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const side = sideOf(event)
    if (!side || event.button !== 0 || busy.current) return
    const dir: Direction = side === "right" ? 1 : -1
    if (!canTurn(dir)) return
    window.clearTimeout(holdTimer.current)
    holdTimer.current = undefined
    const g = toSheet(event, dir)
    const { pw, ph } = sizeRef.current
    // Grabs near a corner take the corner; elsewhere the outer edge at the grab height folds, so the page follows the finger from where it was grabbed.
    const edge = Math.min(ph * 0.18, pw * 0.3)
    const a = { x: pw, y: g.y > ph - edge ? ph : g.y < edge ? 0 : Math.min(Math.max(g.y, 0), ph) }
    const lifted = dirRef.current === dir && anchor.current.x === a.x && anchor.current.y === a.y
    const current = lifted ? { x: px.get(), y: py.get() } : a
    press.current = {
      id: event.pointerId,
      dir,
      start: g,
      offset: { x: current.x - g.x, y: current.y - g.y },
      dragging: false,
      samples: [{ t: event.timeStamp, x: g.x, y: g.y }],
    }
    anchor.current = a
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = press.current
    if (!state || state.id !== event.pointerId) {
      if (event.pointerType !== "mouse" || busy.current) return
      const side = sideOf(event)
      if (!side) {
        setHoverSide(null)
        if (dirRef.current && turning?.mode === "lift" && !holdTimer.current) lower(leave)
        return
      }
      const dir: Direction = side === "right" ? 1 : -1
      const available = canTurn(dir) && hasPage(side === "right" ? 2 * shownRef.current : 2 * shownRef.current - 1)
      setHoverSide(available ? side : null)
      if (reduce || !available) return
      // After the first turn, hovering a corner lifts it a fixed little way; before it, the tease does the inviting.
      if (!turnedOnce.current) return
      const g = toSheet(event, dir)
      const corner = cornerAt(g)
      const { pw, ph } = sizeRef.current
      const lifted = dirRef.current === dir && turning?.mode === "lift" && anchor.current.y === corner?.y && !isLowering()
      if (corner && !lifted) {
        const to = { x: corner.x + HOVER_LIFT.x * pw, y: corner.y === 0 ? -HOVER_LIFT.y * ph : corner.y + HOVER_LIFT.y * ph }
        lift(dir, corner, to, SETTLE)
      } else if (!corner && dirRef.current && turning?.mode === "lift" && !holdTimer.current && !isLowering()) {
        lower(leave)
      }
      return
    }
    const g = toSheet(event, state.dir)
    state.samples.push({ t: event.timeStamp, x: g.x, y: g.y })
    while (state.samples.length > 2 && event.timeStamp - state.samples[0].t > 100) state.samples.shift()
    if (!state.dragging) {
      if (Math.hypot(g.x - state.start.x, g.y - state.start.y) < TAP_SLOP) return
      state.dragging = true
      stopAll()
      slideRun.current?.controls.stop()
      slideRun.current = undefined
      slideFollows.current = true
      busy.current = true
      setInteracted(true)
      setHoverSide(null)
      if (reduce) return
      const a = anchor.current
      dirRef.current = state.dir
      setTurning({ dir: state.dir, mode: "drag" })
      // Keep the anchor the press chose; begin() would reset the pointer to it.
      anchor.current = a
    }
    if (reduce) return
    const { ph } = sizeRef.current
    const p = bind({ x: g.x + state.offset.x, y: g.y + state.offset.y }, anchor.current, ph)
    px.set(p.x)
    py.set(p.y)
  }

  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = press.current
    if (!state || state.id !== event.pointerId) return
    press.current = null
    if (!state.dragging) {
      if (!cancelled) turn(state.dir)
      return
    }
    // Velocity over the last 100ms before release, so a page held still and then let go has none.
    const up = toSheet(event, state.dir)
    const recent = [...state.samples, { t: event.timeStamp, x: up.x, y: up.y }].filter(sample => event.timeStamp - sample.t <= 100)
    const first = recent[0]
    const lastSample = recent[recent.length - 1]
    const dt = (lastSample.t - first.t) / 1000
    const velocity = dt > 0.008 ? { x: (lastSample.x - first.x) / dt, y: (lastSample.y - first.y) / dt } : { x: 0, y: 0 }
    const { pw, ph } = sizeRef.current
    if (reduce) {
      busy.current = false
      const corner = lastSample.x + state.offset.x
      if (!cancelled && corner + velocity.x * PROJECT < pw * COMMIT) turn(state.dir)
      return
    }
    const a = anchor.current
    const p = bind({ x: px.get(), y: py.get() }, a, ph)
    // Carry the corner a tenth of a second further on its release velocity: past about 60% of the page turns it,
    // so a short flick turns as surely as a long slow drag; otherwise the page lays back down.
    const projected = p.x + velocity.x * PROJECT
    const turns = !cancelled && projected < pw * COMMIT
    const target = turns ? { x: -a.x, y: a.y } : a
    const span = Math.hypot(target.x - p.x, target.y - p.y)
    const along = span > 1 ? (velocity.x * (target.x - p.x) + velocity.y * (target.y - p.y)) / span / span : 0
    px.jump(p.x)
    py.jump(p.y)
    travel(
      k => ({ x: lerp(p.x, target.x, k), y: lerp(p.y, target.y, k) }),
      turns ? RELEASE : SETTLE,
      turns ? () => commit(state.dir) : rest,
      Math.max(0, along),
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault()
      turn(1)
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault()
      turn(-1)
    }
  }

  const onPointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Until the first turn, entering with a mouse repeats the tease at half size, at most every 2.5 seconds.
    if (event.pointerType !== "mouse" || performance.now() - lastTease.current < TEASE_GAP) return
    teaseCover(0.5)
  }

  const onPointerLeave = () => {
    setHoverSide(null)
    if (!press.current && turning?.mode === "lift" && !holdTimer.current && !isLowering()) lower(leave)
  }

  /* ---------------------------------------------- render ---------------------------------------------- */

  const leftIndex = 2 * shown - 1
  const rightIndex = 2 * shown
  const dir = turning?.dir ?? 0
  const backIndex = dir === 1 ? rightIndex + 1 : dir === -1 ? leftIndex - 1 : -1
  const underIndex = dir === 1 ? rightIndex + 2 : dir === -1 ? leftIndex - 2 : -1
  const { pw, ph } = size

  const status =
    hasPage(leftIndex) && hasPage(rightIndex)
      ? `Page ${leftIndex + 1} and ${rightIndex + 1} of ${total}`
      : `Page ${(hasPage(rightIndex) ? rightIndex : leftIndex) + 1} of ${total}`
  const count = shown === 0 ? "Cover" : hasPage(leftIndex) && hasPage(rightIndex) ? `${leftIndex + 1}–${rightIndex + 1}` : `${(hasPage(rightIndex) ? rightIndex : leftIndex) + 1}`

  const slot = (side: "left" | "right", index: number) =>
    hasPage(index) ? (
      <div
        key={side}
        ref={side === "left" ? leftSlot : rightSlot}
        className={cn(
          "absolute top-0 h-full w-1/2 select-none",
          pageShape(side),
          pageShadow,
          side === "left" ? "left-0" : "left-1/2",
          (side === "right" ? shown < last : shown > 0) && "cursor-pointer",
        )}
        style={{ zIndex: 1 }}
      >
        <Face rests={side}>{pages[index]}</Face>
        {dir === (side === "right" ? 1 : -1) && (
          <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", pageShape(side))}>
            <div ref={frontShade} className="absolute top-0 left-0 origin-top-left" style={{ background: SHADE.front, opacity: 0 }} />
          </div>
        )}
        {/* The cue on the outer edge: hidden at rest, it settles in when the pointer is over the page. */}
        <motion.span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 -mt-3.5 grid size-7 place-items-center rounded-pill bg-surface/88 text-foreground shadow-[0_0_0_1px_var(--border),var(--shadow-resting)]",
            side === "right" ? "right-2" : "left-2",
          )}
          initial={false}
          animate={hoverSide === side && !turning ? { opacity: 1, scale: 1, x: 0 } : { opacity: 0, scale: 0.92, x: side === "right" ? -4 : 4 }}
          transition={{ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}
        >
          {side === "right" ? <ChevronRight size={16} strokeWidth={1.75} /> : <ChevronLeft size={16} strokeWidth={1.75} />}
        </motion.span>
      </div>
    ) : null

  return (
    <div className={cn("flex w-full flex-col items-center gap-3", className)} style={style}>
      <div
        ref={book}
        role="group"
        aria-roledescription="book"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={event => finish(event, false)}
        onPointerCancel={event => finish(event, true)}
        onDragStart={event => event.preventDefault()}
        className="relative w-full touch-pan-y outline-none select-none [-webkit-tap-highlight-color:transparent]"
        style={{ aspectRatio: `${2 * pageAspect}` }}
      >
        <motion.div ref={shift} className="absolute inset-0 will-change-transform" style={{ x: slide }}>
          {/* Turning copies: the page revealed below, and the back of the lifting sheet. */}
          {dir !== 0 && hasPage(underIndex) && (
            <div
              aria-hidden="true"
              inert
              className={cn(
                "absolute top-0 h-full w-1/2",
                pageShape(dir === 1 ? "right" : "left"),
                pageShadow,
                dir === 1 ? "left-1/2" : "left-0",
              )}
              style={{ zIndex: 0 }}
            >
              <Face rests={dir === 1 ? "right" : "left"}>{pages[underIndex]}</Face>
              <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", pageShape(dir === 1 ? "right" : "left"))}>
                <div ref={under} className="absolute top-0 left-0 origin-top-left" style={{ background: SHADE.under, opacity: 0 }} />
              </div>
            </div>
          )}
          {slot("left", leftIndex)}
          {slot("right", rightIndex)}
          {dir !== 0 && hasPage(backIndex) && (
            <div
              aria-hidden="true"
              inert
              className="pointer-events-none absolute inset-0"
              style={{ zIndex: 2, filter: "drop-shadow(0 2px 8px oklch(0% 0 0 / .16)) drop-shadow(0 0 1px oklch(0% 0 0 / .14))" }}
            >
              <div ref={back} className="absolute top-0 origin-top-left" style={{ left: pw, width: pw, height: ph, visibility: "hidden" }}>
                <Face rests={dir === 1 ? "left" : "right"}>{pages[backIndex]}</Face>
                <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", pageShape(dir === 1 ? "left" : "right"))}>
                  <div ref={curl} className="absolute top-0 left-0 origin-top-left" style={{ background: SHADE.flap }} />
                </div>
              </div>
            </div>
          )}
          {hint !== null && (
            <AnimatePresence>
              {!interacted && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-full right-0 mt-2.5 inline-flex items-center gap-1 text-xs leading-3 whitespace-nowrap text-text-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
                  transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] }}
                >
                  {hint}
                  <ArrowUpRight size={12} strokeWidth={1.75} />
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </motion.div>
        <span role="status" aria-live="polite" className="absolute -m-px size-px overflow-hidden border-0 p-0 whitespace-nowrap [clip-path:inset(50%)]">
          {status}
        </span>
      </div>
      {controls && (
        <div className={cn("flex items-center gap-3", hint !== null && "mt-8")}>
          <button type="button" className={controlClass} aria-label="Previous page" disabled={shown === 0} onClick={() => turn(-1)}>
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <span aria-hidden="true" className="min-w-[148px] text-center text-sm text-foreground tabular-nums">
            {count} <span className="text-text-muted">{total} pages</span>
          </span>
          <button type="button" className={controlClass} aria-label="Next page" disabled={shown === last} onClick={() => turn(1)}>
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

export default PageCurl
