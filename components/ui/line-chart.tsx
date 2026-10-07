"use client"

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

/** The original's CSS module, as Tailwind strings. Hover and state rules use group variants on the toggle and the chart. */
const styles = {
  figure: "grid min-w-0 gap-4 m-0 text-foreground font-sans tracking-body",
  legend: "flex flex-wrap gap-x-1 gap-y-[2px] min-w-0 -mx-2",
  toggle:
    "group/toggle inline-flex min-h-8 items-center gap-2 rounded-pill border-0 bg-transparent py-0 pr-[10px] pl-2 font-[inherit] text-[length:var(--text-sm)] leading-[var(--leading-body)] text-text-secondary cursor-pointer [-webkit-tap-highlight-color:transparent] [transition:color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)] active:[transform:scale(.97)] aria-[pressed=false]:text-text-muted motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
  toggleLabel:
    "whitespace-nowrap [transition:opacity_var(--duration-fast)_var(--ease-standard)] group-aria-[pressed=false]/toggle:line-through group-aria-[pressed=false]/toggle:opacity-[.72] group-aria-[pressed=false]/toggle:[text-decoration-color:color-mix(in_oklab,currentColor_55%,transparent)]",
  swatch:
    "relative h-[10px] w-[14px] flex-none before:absolute before:top-1/2 before:left-0 before:h-[2.5px] before:w-full before:rounded-[2px] before:bg-[var(--series)] before:content-[''] before:[transform:translateY(-50%)_scaleX(1)] before:origin-left before:[transition:transform_var(--duration-standard)_var(--ease-spring),opacity_var(--duration-fast)_var(--ease-standard)] data-[dashed]:before:bg-[repeating-linear-gradient(to_right,var(--series)_0_4px,transparent_4px_7px)] group-aria-[pressed=false]/toggle:before:opacity-[.45] group-aria-[pressed=false]/toggle:before:[transform:translateY(-50%)_scaleX(.35)] motion-reduce:before:transition-none",
  chart:
    "group/chart relative grid min-w-0 grid-cols-[minmax(0,1fr)_48px] grid-rows-[auto_26px]",
  plot: "relative [grid-area:1/1] min-w-0 outline-none touch-pan-y select-none [-webkit-user-select:none] [-webkit-tap-highlight-color:transparent]",
  svg: "block overflow-visible",
  grid: "stroke-border [stroke-width:1] [shape-rendering:crispEdges]",
  baseline:
    "stroke-border-strong [stroke-width:1] [shape-rendering:crispEdges]",
  crosshair:
    "stroke-border-strong [stroke-width:1] [shape-rendering:crispEdges] opacity-0 [transition:opacity_var(--duration-instant)_var(--ease-standard)] group-data-[scrubbing]/chart:opacity-100 motion-reduce:transition-none",
  series: "",
  line: "[fill:none] stroke-[var(--series)] [stroke-width:2] [stroke-linecap:round] [stroke-linejoin:round] [transition:stroke_var(--duration-standard)_var(--ease-standard)] data-[dashed]:[stroke-dasharray:4_5] data-[dashed]:[stroke-width:1.75] motion-reduce:transition-none",
  area: "[fill:color-mix(in_oklab,var(--series)_9%,transparent)] [stroke:none]",
  dot: "fill-[var(--series)] stroke-surface [stroke-width:2] opacity-0 [transition:opacity_var(--duration-instant)_var(--ease-standard)] group-data-[scrubbing]/chart:not-data-[hidden]:opacity-100 motion-reduce:transition-none",
  tooltip:
    "absolute top-0 left-0 z-[1] grid min-w-[140px] max-w-[min(220px,100%)] gap-1 rounded-[14px] border border-border bg-surface-raised px-3 py-[10px] shadow-floating opacity-0 pointer-events-none scale-[.96] [transition:opacity_var(--duration-fast)_var(--ease-standard),scale_var(--duration-fast)_var(--ease-standard)] group-data-[scrubbing]/chart:opacity-100 group-data-[scrubbing]/chart:scale-100 motion-reduce:transition-none",
  tipTitle:
    "mt-0 mr-0 ml-0 mb-[2px] text-[length:var(--text-xs)] leading-[var(--leading-body)] text-text-secondary whitespace-nowrap tabular-nums",
  tipRow:
    "m-0 flex min-w-0 items-center gap-2 text-[length:var(--text-sm)] leading-[var(--leading-body)]",
  tipSwatch:
    "h-[2.5px] w-[10px] flex-none rounded-[2px] bg-[var(--series)] data-[dashed]:bg-[repeating-linear-gradient(to_right,var(--series)_0_3px,transparent_3px_5px)]",
  tipName:
    "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-text-secondary",
  tipValue:
    "ml-2 flex-none whitespace-nowrap font-medium text-foreground tabular-nums",
  message:
    "absolute inset-0 m-0 grid place-items-center text-[length:var(--text-sm)] text-text-muted pointer-events-none",
  skeleton:
    "absolute inset-x-0 top-[30%] bottom-[25%] rounded-[12px] bg-gradient-to-b from-transparent to-[color-mix(in_oklab,var(--foreground)_5%,transparent)]",
  gutter: "relative [grid-area:1/2] min-w-0",
  tick: "absolute top-0 left-[10px] block h-0 whitespace-nowrap pointer-events-none",
  tickText:
    "block -translate-y-1/2 text-[length:var(--text-xs)] leading-none text-text-muted tabular-nums",
  axis: "relative [grid-area:2/1] min-w-0",
  axisLabel:
    "absolute top-2 whitespace-nowrap text-[length:var(--text-xs)] leading-none text-text-muted tabular-nums",
  srOnly:
    "absolute h-px w-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]",
}

export interface LineChartSeries {
  /** Stable identity. A series keeps its line across data changes, so switching ranges morphs the path instead of redrawing it. */
  key: string
  /** Name in the legend, the tooltip, and the data table. */
  label: string
  /** Any CSS color. Defaults to the accent for the first series, then quieter neutral steps. */
  color?: string
  /** Draws a dashed stroke, useful for a previous period or a target. */
  dashed?: boolean
  /** Fills the area under the line with a faint tint of its color. Defaults to true for the first series. */
  area?: boolean
}

export interface LineChartDatum {
  /** Stable identity, such as an ISO date. */
  key: string
  /** Full label for the tooltip and screen readers, such as "Tue, Sep 15". */
  label: string
  /** Short label on the x axis, such as "Sep 15". Leave it out to keep the axis quiet at that point. */
  axisLabel?: string
  /** One value per series key. A missing value counts as zero. */
  values: Record<string, number | undefined>
}

/** Use a line chart for one or more measures over time, when the shape of the trend matters more than any single value. */
export interface LineChartProps {
  data: LineChartDatum[]
  series: LineChartSeries[]
  /** What is measured, such as "Signups". Names the chart for assistive technology. */
  label: string
  /** Unit after each value in the tooltip, such as "ms". */
  unit?: string
  /** Plot height in pixels. The width follows the container. */
  height?: number
  /** Formats values in the tooltip and data table. */
  formatValue?: (value: number, series: LineChartSeries) => string
  /** Formats the value axis. Defaults to a compact number, such as 1.2K. */
  formatTick?: (value: number) => string
  /** Controlled hidden series keys. */
  hiddenSeries?: string[]
  defaultHiddenSeries?: string[]
  onHiddenSeriesChange?: (hidden: string[]) => void
  /** Called as the crosshair moves, and with null when it leaves. Use it to drive a headline readout. */
  onActiveChange?: (index: number | null, datum: LineChartDatum | null) => void
  /** Keeps the current lines on screen, dimmed, while the next range loads. */
  loading?: boolean
  /** Shown when there are no points. */
  emptyLabel?: string
  /** Series toggles above the plot. Shown by default when there is more than one series. */
  legend?: boolean
  /** Header of the first column in the data table read by screen readers. */
  categoryLabel?: string
  /** Smooth monotone curves that never swing past the data, or straight segments. */
  curve?: "smooth" | "linear"
  ref?: Ref<HTMLElement>
  className?: string
}

type Point = [x: number, value: number]
type Track = {
  shape: Point[]
  presence: number
  fade: { stop: () => void } | null
}

const { spring, duration, ease } = motionTokens
/** Motion drops inherited velocity on time-defined springs, so values that retarget mid-flight run the same springs written as stiffness and damping. */
const physical = (
  { visualDuration, bounce }: { visualDuration: number; bounce: number },
  restDelta = 0.001
) => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return {
    type: "spring" as const,
    stiffness: root * root,
    damping: 2 * (1 - bounce) * root,
    restDelta,
    restSpeed: restDelta * 2,
  }
}
const settle = physical(spring.smooth)
const glide = physical(spring.snappy, 0.0001)
const follow = {
  stiffness: glide.stiffness,
  damping: glide.damping,
  restDelta: 0.01,
}
const draw = {
  duration: duration.considered * 1.75,
  ease: [...ease.inOut],
} as const
/** The breathing loop the CSS module ran as a keyframe animation: 1.4s, alternating. */
const breathe = {
  duration: 1.4,
  ease: [...ease.inOut],
  repeat: Infinity,
  repeatType: "reverse",
} as const
const fadeFast = {
  duration: duration.instant,
  ease: [...ease.standard],
} as const

/** Room above the top gridline, and the gap between the crosshair and its tooltip. */
const TOP = 12,
  GAP = 14
const PALETTE = [
  "var(--accent)",
  "color-mix(in oklab, var(--foreground) 46%, var(--surface))",
  "color-mix(in oklab, var(--foreground) 26%, var(--surface))",
]
const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))
const colorOf = (series: LineChartSeries, index: number) =>
  series.color ?? PALETTE[Math.min(index, PALETTE.length - 1)]
const clean = (value: number) => Number(value.toPrecision(12))

/** Clean gridlines: the smallest step of 1, 2, 2.5, or 5 that covers the data in four rows or fewer, from zero unless the data dips below it. */
function niceScale(low: number, high: number) {
  const lo = Math.min(0, low),
    hi = Math.max(high, lo + 1)
  const span = hi - lo,
    magnitude = 10 ** Math.floor(Math.log10(span / 4))
  for (const factor of [1, 2, 2.5, 5, 10]) {
    const step = factor * magnitude,
      bottom = Math.floor(lo / step) * step,
      top = Math.ceil(hi / step) * step
    if ((top - bottom) / step <= 4 + 1e-9) {
      const ticks: number[] = []
      for (let value = bottom; value <= top + step / 2; value += step)
        ticks.push(clean(value))
      return { min: clean(bottom), max: clean(top), ticks }
    }
  }
  return { min: lo, max: hi, ticks: [lo, hi] }
}

/** The line through every value, sampled densely on x from 0 to 1 in data units. Monotone cubic tangents keep a smooth curve from swinging past the data. */
function curveFor(values: number[], smooth: boolean): Point[] {
  if (values.length === 0) return []
  if (values.length === 1)
    return [
      [0, values[0]],
      [1, values[0]],
    ]
  const last = values.length - 1,
    step = 1 / last
  if (!smooth) return values.map((value, index) => [index * step, value])
  const slopes = values
    .slice(1)
    .map((value, index) => (value - values[index]) / step)
  const tangents = values.map((_, index) =>
    index === 0 || index === last
      ? 0
      : (Math.sign(slopes[index - 1]) + Math.sign(slopes[index])) *
          Math.min(
            Math.abs(slopes[index - 1]),
            Math.abs(slopes[index]),
            Math.abs(slopes[index - 1] + slopes[index]) / 4
          ) || 0
  )
  if (last > 1) {
    tangents[0] = (3 * slopes[0] - tangents[1]) / 2
    tangents[last] = (3 * slopes[last - 1] - tangents[last - 1]) / 2
  } else {
    tangents[0] = slopes[0]
    tangents[1] = slopes[0]
  }
  const samples = Math.max(1, Math.min(16, Math.round(192 / last)))
  const points: Point[] = []
  for (let index = 0; index < last; index++) {
    const low = Math.min(values[index], values[index + 1]),
      high = Math.max(values[index], values[index + 1])
    for (let sample = 0; sample < samples; sample++) {
      const t = sample / samples,
        t2 = t * t,
        t3 = t2 * t
      const value =
        (2 * t3 - 3 * t2 + 1) * values[index] +
        (t3 - 2 * t2 + t) * step * tangents[index] +
        (3 * t2 - 2 * t3) * values[index + 1] +
        (t3 - t2) * step * tangents[index + 1]
      points.push([(index + t) * step, clamp(value, low, high)])
    }
  }
  points.push([1, values[last]])
  return points
}

/** Value of a sampled line at x, straight between samples. */
function valueAt(shape: Point[], x: number) {
  if (!shape.length) return 0
  let low = 0,
    high = shape.length - 1
  if (x <= shape[low][0]) return shape[low][1]
  if (x >= shape[high][0]) return shape[high][1]
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (shape[middle][0] < x) low = middle
    else high = middle
  }
  const [x0, y0] = shape[low],
    [x1, y1] = shape[high]
  return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}

/** Tracks are mutable animation state read by the painter, never by render. */
const update = (track: Track, patch: Partial<Track>) =>
  Object.assign(track, patch)

const grid = Array.from({ length: 241 }, (_, index) => index / 240)

const subscribeNothing = () => () => {}
/** Reduced motion is only known in the browser, so the first client render matches the server before it takes effect. */
function useReducedMotionSafe() {
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  )
  return !!useReducedMotion() && hydrated
}

type Scale = { min: MotionValue<number>; max: MotionValue<number> }
function useRowY(value: number, scale: Scale, height: number) {
  return useTransform(() => {
    const span = scale.max.get() - scale.min.get() || 1
    return (
      Math.round(
        TOP + (1 - (value - scale.min.get()) / span) * (height - TOP)
      ) + 0.5
    )
  })
}

/** A gridline rides the scale, so a taller range slides it down while new rows fade in above. */
function Gridline({
  value,
  scale,
  height,
}: {
  value: number
  scale: Scale
  height: number
}) {
  const y = useRowY(value, scale, height)
  return (
    <motion.line
      className={styles.grid}
      x1={0}
      x2="100%"
      y1={y}
      y2={y}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: fadeFast }}
      transition={{ duration: duration.standard, ease: [...ease.standard] }}
    />
  )
}

function TickLabel({
  value,
  scale,
  height,
  format,
}: {
  value: number
  scale: Scale
  height: number
  format: (value: number) => string
}) {
  const y = useRowY(value, scale, height)
  return (
    <motion.span
      className={styles.tick}
      style={{ y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: fadeFast }}
      transition={{ duration: duration.standard, ease: [...ease.standard] }}
    >
      <span className={styles.tickText}>{format(value)}</span>
    </motion.span>
  )
}

/** Axis labels that fit: at most one per 76 pixels, counted back from the latest so the newest date always shows. */
function axisPicks(data: LineChartDatum[], width: number) {
  const labeled = data.flatMap((item, index) => (item.axisLabel ? [index] : []))
  if (!width || !labeled.length) return []
  const room = Math.max(2, Math.floor(width / 76))
  const stride = Math.ceil(labeled.length / room)
  return labeled
    .reverse()
    .filter((_, rank) => rank % stride === 0)
    .reverse()
}

export function LineChart({
  data,
  series,
  label,
  unit = "",
  height = 220,
  formatValue,
  formatTick = (value) => compact.format(value),
  hiddenSeries,
  defaultHiddenSeries,
  onHiddenSeriesChange,
  onActiveChange,
  loading = false,
  emptyLabel = "No data for this range",
  legend,
  categoryLabel = "Date",
  curve = "smooth",
  ref,
  className,
}: LineChartProps) {
  const reduced = useReducedMotionSafe()
  const figure = useRef<HTMLElement>(null)
  const plot = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const clip = useRef<SVGRectElement>(null)
  const crosshair = useRef<SVGLineElement>(null)
  const lines = useRef(new Map<string, SVGPathElement>())
  const areas = useRef(new Map<string, SVGPathElement>())
  const dots = useRef(new Map<string, SVGCircleElement>())
  const groups = useRef(new Map<string, SVGGElement>())
  useImperativeHandle(ref, () => figure.current as HTMLElement)
  const inView = useInView(figure, { once: true, amount: 0.3 })
  const uid = `line${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const last = data.length - 1
  const empty = data.length === 0

  // Hidden series, controlled or not.
  const [ownHidden, setOwnHidden] = useState<string[]>(
    defaultHiddenSeries ?? []
  )
  const hidden = hiddenSeries ?? ownHidden
  const toggle = (key: string) => {
    const next = hidden.includes(key)
      ? hidden.filter((item) => item !== key)
      : [...hidden, key]
    if (hiddenSeries === undefined) setOwnHidden(next)
    onHiddenSeriesChange?.(next)
  }
  const visible = series.filter((item) => !hidden.includes(item.key))
  const showLegend = legend ?? series.length > 1

  // Each series becomes a dense curve in data units; the scale fits only the series on show.
  const signature = `${curve}|${series.map((item) => item.key).join(",")}|${data.map((item) => `${item.key}:${series.map((line) => item.values[line.key] ?? 0).join(",")}`).join(";")}`
  const targets = useMemo(
    () =>
      new Map(
        series.map((line) => [
          line.key,
          curveFor(
            data.map((item) => item.values[line.key] ?? 0),
            curve === "smooth"
          ),
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
  )
  let low = Infinity,
    high = -Infinity
  for (const line of visible)
    for (const item of data) {
      const value = item.values[line.key] ?? 0
      low = Math.min(low, value)
      high = Math.max(high, value)
    }
  const range = Number.isFinite(low) ? niceScale(low, high) : null
  const [steady, setSteady] = useState(() => range ?? niceScale(0, 100))
  if (range && (range.min !== steady.min || range.max !== steady.max))
    setSteady(range)
  const scale = {
    min: useMotionValue(steady.min),
    max: useMotionValue(steady.max),
  }

  // Scrubbing: a new range lets go of the crosshair.
  const [active, setActive] = useState<number | null>(null)
  const [seenSignature, setSeenSignature] = useState(signature)
  if (seenSignature !== signature) {
    setSeenSignature(signature)
    setActive(null)
  }
  const index = active === null || empty ? null : Math.min(active, last)
  const scrubbing = index !== null

  const width = useRef(0)
  const [plotWidth, setPlotWidth] = useState(0)
  const tipSize = useRef({ w: 0, h: 0 })
  const tracks = useRef(new Map<string, Track>())
  const drawn = useMotionValue(0)
  const cursor = useMotionValue(1)
  const tipTargetX = useMotionValue(0),
    tipTargetY = useMotionValue(0)
  const tipSpringX = useSpring(tipTargetX, follow),
    tipSpringY = useSpring(tipTargetY, follow)
  const live = useRef({ series, hidden })
  useLayoutEffect(() => {
    live.current = { series, hidden }
  })

  // One writer for every drawn attribute: morphs, toggles, the scale, the crosshair, and the measured size all repaint through here.
  const paint = useCallback(() => {
    const w = width.current
    if (!w) return
    const lo = scale.min.get(),
      span = scale.max.get() - lo || 1
    const toY = (value: number) =>
      TOP + (1 - (value - lo) / span) * (height - TOP)
    const at = cursor.get()
    const dotYs: number[] = []
    for (const line of live.current.series) {
      const track = tracks.current.get(line.key)
      if (!track) continue
      const p = track.presence
      const y = (value: number) => toY(lo + (value - lo) * p)
      const path = track.shape.length
        ? `M${track.shape.map(([x, value]) => `${(x * w).toFixed(1)},${y(value).toFixed(1)}`).join("L")}`
        : ""
      lines.current.get(line.key)?.setAttribute("d", path)
      areas.current
        .get(line.key)
        ?.setAttribute("d", path ? `${path}L${w},${height}L0,${height}Z` : "")
      const group = groups.current.get(line.key)
      if (group) group.style.opacity = String(p)
      const dot = dots.current.get(line.key)
      if (dot && track.shape.length) {
        const cy = y(valueAt(track.shape, at))
        dot.setAttribute("cx", (at * w).toFixed(1))
        dot.setAttribute("cy", cy.toFixed(1))
        if (p > 0.5) dotYs.push(cy)
      }
    }
    clip.current?.setAttribute("width", String(drawn.get() * (w + 16)))
    const cx = Math.round(at * w) + 0.5
    crosshair.current?.setAttribute("x1", String(cx))
    crosshair.current?.setAttribute("x2", String(cx))
    // The tooltip sits beside the crosshair, flips sides before it would leave the plot, and centres on the points it describes.
    const { w: tw, h: th } = tipSize.current
    let x = cx + GAP
    if (x + tw > w) x = cx - GAP - tw
    tipTargetX.set(clamp(x, 0, Math.max(0, w - tw)))
    const middle = dotYs.length
      ? dotYs.reduce((sum, value) => sum + value, 0) / dotYs.length
      : height / 2
    tipTargetY.set(clamp(middle - th / 2, 0, Math.max(0, height - th)))
  }, [cursor, drawn, height, scale.max, scale.min, tipTargetX, tipTargetY])
  useMotionValueEvent(cursor, "change", paint)
  useMotionValueEvent(drawn, "change", paint)
  useMotionValueEvent(scale.min, "change", paint)
  useMotionValueEvent(scale.max, "change", paint)
  useLayoutEffect(paint)

  // The plot draws in its own pixels: measure the width, follow resizes, and size the tooltip for its flip.
  useLayoutEffect(() => {
    const node = plot.current,
      bubble = tip.current
    if (!node) return
    const read = () => {
      width.current = node.clientWidth
      setPlotWidth(node.clientWidth)
      if (bubble)
        tipSize.current = { w: bubble.offsetWidth, h: bubble.offsetHeight }
      paint()
    }
    read()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(read)
    observer.observe(node)
    if (bubble) observer.observe(bubble)
    return () => observer.disconnect()
  }, [paint])

  // New data morphs every line from the shape on screen, sampled on shared x positions so a range that gains or loses points still flows.
  const morph = useRef<{ stop: () => void } | null>(null)
  useEffect(() => {
    const moves: {
      track: Track
      xs: number[]
      from: number[]
      to: number[]
      target: Point[]
    }[] = []
    for (const [key, target] of targets) {
      const track = tracks.current.get(key)
      if (!track) {
        tracks.current.set(key, {
          shape: target,
          presence: live.current.hidden.includes(key) ? 0 : 1,
          fade: null,
        })
        continue
      }
      if (!track.shape.length || !target.length || reduced) {
        update(track, { shape: target })
        continue
      }
      const xs = [...new Set([...grid, ...target.map(([x]) => x)])].sort(
        (a, b) => a - b
      )
      moves.push({
        track,
        xs,
        from: xs.map((x) => valueAt(track.shape, x)),
        to: xs.map((x) => valueAt(target, x)),
        target,
      })
    }
    morph.current?.stop()
    if (!moves.length) {
      paint()
      return
    }
    morph.current = animate(0, 1, {
      ...settle,
      restDelta: 0.0005,
      onUpdate: (progress) => {
        for (const move of moves)
          update(move.track, {
            shape: move.xs.map((x, at): Point => [
              x,
              move.from[at] + (move.to[at] - move.from[at]) * progress,
            ]),
          })
        paint()
      },
      onComplete: () => {
        for (const move of moves) update(move.track, { shape: move.target })
        paint()
      },
    })
    return () => morph.current?.stop()
  }, [paint, reduced, targets])

  // A hidden series flattens into the baseline as it fades; the ones that stay rescale around it.
  const hiddenKey = hidden.join("|")
  useEffect(() => {
    for (const [key, track] of tracks.current) {
      const to = hidden.includes(key) ? 0 : 1
      if (track.presence === to) continue
      track.fade?.stop()
      if (reduced) {
        update(track, { presence: to })
        continue
      }
      update(track, {
        fade: animate(track.presence, to, {
          ...settle,
          onUpdate: (value) => {
            update(track, { presence: value })
            paint()
          },
        }),
      })
    }
    paint()
  }, [hiddenKey, paint, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reduced) {
      scale.min.jump(steady.min)
      scale.max.jump(steady.max)
      return
    }
    const controls = [
      animate(scale.min, steady.min, settle),
      animate(scale.max, steady.max, settle),
    ]
    return () => controls.forEach((control) => control.stop())
  }, [reduced, scale.max, scale.min, steady])

  // The lines draw left to right the first time the chart is seen with data.
  useEffect(() => {
    if (empty) return
    if (reduced) {
      drawn.jump(1)
      return
    }
    if (!inView || drawn.get() >= 1) return
    const controls = animate(drawn, 1, draw)
    return () => controls.stop()
  }, [drawn, empty, inView, reduced])

  // The crosshair appears on the first scrubbed point and glides between the ones after it; the tooltip follows on its own spring.
  const wasScrubbing = useRef(false)
  useEffect(() => {
    if (index === null) {
      wasScrubbing.current = false
      return
    }
    const to = last > 0 ? index / last : 0.5
    if (reduced || !wasScrubbing.current) {
      cursor.jump(to)
      tipSpringX.jump(tipTargetX.get())
      tipSpringY.jump(tipTargetY.get())
    }
    wasScrubbing.current = true
    if (reduced) return
    const controls = animate(cursor, to, glide)
    return () => controls.stop()
  }, [
    cursor,
    index,
    last,
    reduced,
    tipSpringX,
    tipSpringY,
    tipTargetX,
    tipTargetY,
  ])

  const onActive = useRef(onActiveChange)
  useLayoutEffect(() => {
    onActive.current = onActiveChange
  })
  useEffect(() => {
    onActive.current?.(index, index === null ? null : (data[index] ?? null))
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  const pointAt = (clientX: number) => {
    const rect = plot.current?.getBoundingClientRect()
    if (!rect?.width || last < 1) return Math.max(0, last)
    return clamp(
      Math.round(((clientX - rect.left) / rect.width) * last),
      0,
      last
    )
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && scrubbing) {
      event.preventDefault()
      setActive(null)
      return
    }
    const from = index ?? last + 1,
      page = Math.max(1, Math.round(data.length / 6))
    const next = (
      {
        ArrowLeft: from - 1,
        ArrowDown: from - 1,
        ArrowRight: index === null ? last : from + 1,
        ArrowUp: index === null ? last : from + 1,
        PageDown: from - page,
        PageUp: from + page,
        Home: 0,
        End: last,
      } as Record<string, number>
    )[event.key]
    if (next === undefined || empty) return
    event.preventDefault()
    setActive(clamp(next, 0, last))
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (empty) return
    if (event.pointerType !== "mouse")
      event.currentTarget.setPointerCapture?.(event.pointerId)
    setActive(pointAt(event.clientX))
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!empty && (event.pointerType === "mouse" || event.buttons))
      setActive(pointAt(event.clientX))
  }

  const format = (value: number, line: LineChartSeries) =>
    `${formatValue ? formatValue(value, line) : grouped.format(value)}${unit ? ` ${unit}` : ""}`
  const reading = index === null ? null : data[index]
  const valueText = reading
    ? `${reading.label}: ${visible.map((line) => `${line.label} ${format(reading.values[line.key] ?? 0, line)}`).join(", ")}`
    : empty
      ? emptyLabel
      : `${visible.length} of ${series.length} series shown`
  const summary = empty
    ? `${label}. ${emptyLabel}.`
    : `${label}, ${data[0].label} to ${data[last].label}. ${visible.map((line) => `${line.label}, latest ${format(data[last].values[line.key] ?? 0, line)}`).join(". ")}.`
  const picks = axisPicks(data, plotWidth)
  const allHidden = !empty && visible.length === 0
  const tipX = reduced ? tipTargetX : tipSpringX,
    tipY = reduced ? tipTargetY : tipSpringY

  return (
    <figure
      ref={figure}
      className={cn(styles.figure, className)}
      aria-label={label}
      aria-busy={loading || undefined}
    >
      {showLegend && (
        <div
          className={styles.legend}
          role="group"
          aria-label={`${label} series`}
        >
          {series.map((line, at) => (
            <button
              key={line.key}
              type="button"
              className={styles.toggle}
              aria-pressed={!hidden.includes(line.key)}
              onClick={() => toggle(line.key)}
              style={{ "--series": colorOf(line, at) } as CSSProperties}
            >
              <span
                className={styles.swatch}
                data-dashed={line.dashed || undefined}
                aria-hidden="true"
              />
              <span className={styles.toggleLabel}>{line.label}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className={styles.chart}
        data-scrubbing={scrubbing || undefined}
        data-loading={loading || undefined}
      >
        <div
          ref={plot}
          className={styles.plot}
          style={{ height }}
          role="slider"
          tabIndex={empty ? -1 : 0}
          aria-label={`${label}, explore by ${categoryLabel.toLowerCase()}`}
          aria-orientation="horizontal"
          aria-valuemin={1}
          aria-valuemax={Math.max(1, data.length)}
          aria-valuenow={(index ?? last) + 1}
          aria-valuetext={valueText}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => {
            if (event.pointerType !== "mouse") setActive(null)
          }}
          onPointerCancel={() => setActive(null)}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setActive(null)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible") && !empty)
              setActive((current) => current ?? last)
          }}
        >
          <svg
            className={styles.svg}
            width="100%"
            height={height}
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <clipPath id={`${uid}-draw`} clipPathUnits="userSpaceOnUse">
                <rect
                  ref={clip}
                  x={-8}
                  y={-16}
                  width={0}
                  height={height + 32}
                />
              </clipPath>
            </defs>
            <AnimatePresence initial={false}>
              {steady.ticks.slice(1).map((value) => (
                <Gridline
                  key={value}
                  value={value}
                  scale={scale}
                  height={height}
                />
              ))}
            </AnimatePresence>
            <line
              className={styles.baseline}
              x1={0}
              x2="100%"
              y1={height - 0.5}
              y2={height - 0.5}
            />
            <line
              ref={crosshair}
              className={styles.crosshair}
              y1={TOP - 4}
              y2={height}
            />
            <motion.g
              className={styles.series}
              clipPath={`url(#${uid}-draw)`}
              initial={false}
              animate={{
                opacity: loading ? (reduced ? 0.32 : [0.22, 0.45]) : 1,
              }}
              transition={
                loading && !reduced
                  ? breathe
                  : {
                      duration: reduced ? 0 : duration.standard,
                      ease: [...ease.standard],
                    }
              }
            >
              {series.map((line, at) => (
                <g
                  key={line.key}
                  ref={(node) => {
                    if (node) groups.current.set(line.key, node)
                    else groups.current.delete(line.key)
                  }}
                  style={{ "--series": colorOf(line, at) } as CSSProperties}
                >
                  {(line.area ?? at === 0) && (
                    <path
                      ref={(node) => {
                        if (node) areas.current.set(line.key, node)
                        else areas.current.delete(line.key)
                      }}
                      className={styles.area}
                    />
                  )}
                  <path
                    ref={(node) => {
                      if (node) lines.current.set(line.key, node)
                      else lines.current.delete(line.key)
                    }}
                    className={styles.line}
                    data-dashed={line.dashed || undefined}
                  />
                </g>
              ))}
            </motion.g>
            {series.map((line, at) => (
              <circle
                key={line.key}
                ref={(node) => {
                  if (node) dots.current.set(line.key, node)
                  else dots.current.delete(line.key)
                }}
                className={styles.dot}
                r={4}
                data-hidden={hidden.includes(line.key) || undefined}
                style={{ "--series": colorOf(line, at) } as CSSProperties}
              />
            ))}
          </svg>
          <motion.div
            ref={tip}
            className={styles.tooltip}
            style={{ x: tipX, y: tipY }}
            aria-hidden="true"
          >
            <p className={styles.tipTitle}>
              {(reading ?? data[last])?.label ?? ""}
            </p>
            {visible.map((line) => (
              <p
                key={line.key}
                className={styles.tipRow}
                style={
                  {
                    "--series": colorOf(line, series.indexOf(line)),
                  } as CSSProperties
                }
              >
                <span
                  className={styles.tipSwatch}
                  data-dashed={line.dashed || undefined}
                />
                <span className={styles.tipName}>{line.label}</span>
                <span className={styles.tipValue}>
                  {format((reading ?? data[last])?.values[line.key] ?? 0, line)}
                </span>
              </p>
            ))}
          </motion.div>
          <AnimatePresence initial={false}>
            {(empty || allHidden) && !loading && (
              <motion.p
                key={empty ? "empty" : "hidden"}
                className={styles.message}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: fadeFast }}
              >
                {empty ? emptyLabel : "Choose a series to show"}
              </motion.p>
            )}
            {loading && empty && (
              <motion.span
                key="skeleton"
                className={styles.skeleton}
                initial={{ opacity: 0 }}
                animate={{ opacity: reduced ? 1 : [0.22, 0.45] }}
                transition={reduced ? undefined : breathe}
                exit={{ opacity: 0, transition: fadeFast }}
                aria-hidden="true"
              />
            )}
          </AnimatePresence>
        </div>
        <div className={styles.gutter} aria-hidden="true">
          <AnimatePresence initial={false}>
            {steady.ticks.map((value) => (
              <TickLabel
                key={value}
                value={value}
                scale={scale}
                height={height}
                format={formatTick}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className={styles.axis} aria-hidden="true">
          <AnimatePresence initial={false}>
            {picks.map((at) => {
              const share = last > 0 ? at / last : 0.5
              return (
                <motion.span
                  key={`${data[at].key}:${data[at].axisLabel}`}
                  className={styles.axisLabel}
                  style={{
                    left: `${share * 100}%`,
                    translateX: `${-share * 100}%`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: fadeFast }}
                  transition={{
                    duration: duration.standard,
                    ease: [...ease.standard],
                  }}
                >
                  {data[at].axisLabel}
                </motion.span>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
      <p className={styles.srOnly}>{summary}</p>
      {!empty && (
        <table className={styles.srOnly}>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">{categoryLabel}</th>
              {series.map((line) => (
                <th key={line.key} scope="col">
                  {line.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.key}>
                <th scope="row">{item.label}</th>
                {series.map((line) => (
                  <td key={line.key}>
                    {format(item.values[line.key] ?? 0, line)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {loading ? "Loading" : ""}
      </p>
    </figure>
  )
}

export default LineChart
