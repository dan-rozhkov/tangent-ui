"use client"

import { forwardRef, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties } from "react"
import { animate, useInView } from "motion/react"

import SegmentedControl from "@/components/ui/segmented-control"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

/**
 * A small visual that proves the number beside it. Every kind is optional; a stat without one is just the number.
 * - `trend`: a sparkline of a series, oldest first, such as twelve monthly totals.
 * - `uptime`: one bar per day as a percentage. Full days are full height; a day with downtime is visibly shorter.
 * - `distribution`: a histogram of equal width bins across `0..max`, with the bars below `marker` (the median) inked.
 * - `map`: a dotted world with a dot lit for each [longitude, latitude] point.
 */
export type StatVisual =
  | { kind: "trend"; values: number[] }
  | { kind: "uptime"; days: number[] }
  | { kind: "distribution"; bins: number[]; max: number; marker: number }
  | { kind: "map"; points: [number, number][] };

export interface Stat {
  /** The final number. The band counts up to it. */
  value: number;
  /** Text before the number, such as "$". */
  prefix?: string;
  /** Text after the number, such as "%", "ms", or "+". */
  suffix?: string;
  /** Digits after the decimal point. Defaults to 0. */
  decimals?: number;
  /** `compact` shortens large numbers to 2.3M or 12K. The unit renders like a suffix. Defaults to `standard`. */
  notation?: "standard" | "compact";
  label: string;
  /** One short supporting line under the number. */
  detail?: string;
  /** One line of context that replaces the detail while the stat is hovered or focused, such as "Up from 41% last year". */
  context?: string;
  /** A tiny chart that draws in after the number lands. */
  visual?: StatVisual;
}

/** 90 days of uptime, oldest first: two short incidents, 11 minutes on day 52 and 1 minute on day 24. */
const uptimeDays = Array.from({ length: 90 }, (_, day) => day === 51 ? 99.24 : day === 23 ? 99.93 : 100);

/** 35 edge regions as [longitude, latitude]. */
const regions: [number, number][] = [
  [-122.4, 37.8], [-118.2, 34], [-96.8, 32.8], [-87.6, 41.9], [-77.5, 39], [-74, 40.7], [-79.4, 43.7], [-99.1, 19.4],
  [-74.1, 4.7], [-77, -12], [-46.6, -23.5], [-70.7, -33.4], [-58.4, -34.6],
  [-0.1, 51.5], [-6.3, 53.3], [2.35, 48.9], [4.9, 52.4], [8.7, 50.1], [18, 59.3], [-3.7, 40.4], [9.2, 45.5], [21, 52.2],
  [3.4, 6.5], [28, -26.2], [36.8, -1.3], [55.3, 25.3], [34.8, 32.1],
  [72.9, 19.1], [103.8, 1.35], [114.2, 22.3], [139.7, 35.7], [127, 37.6], [106.8, -6.2], [151.2, -33.9], [174.8, -36.8],
];

const exampleStats: Stat[] = [
  {
    value: 2_334_000, notation: "compact", decimals: 1, label: "Deploys in the last 12 months",
    detail: "Across 12,400 teams", context: "Up from 1.4M the year before",
    visual: { kind: "trend", values: [141, 148, 139, 162, 171, 184, 196, 203, 221, 238, 257, 274] },
  },
  {
    value: 99.99, decimals: 2, suffix: "%", label: "API uptime over 90 days",
    detail: "Measured every 30 seconds", context: "12 minutes down, 11 of them on July 14",
    visual: { kind: "uptime", days: uptimeDays },
  },
  {
    value: 38, suffix: "ms", label: "Median response time",
    detail: "At the edge, worldwide", context: "p95 is 96 ms, down from 141 ms",
    visual: { kind: "distribution", bins: [2, 8, 18, 26, 15, 10, 7, 5, 3, 2, 1.5, 1, .8, .7, .5, .3], max: 160, marker: 38 },
  },
  {
    value: 35, label: "Edge regions on six continents",
    detail: "Most people are under 20 ms away", context: "Eight added this year, including Lagos",
    visual: { kind: "map", points: regions },
  },
];

/**
 * A coarse dotted world for the map visual: 80 columns by 30 rows, from 168° W to 192° E and 76° N to 56° S
 * (Antarctica left out). Each row is hex, four columns per digit, most significant bit first.
 */
const ROWS = [
  "001f007f800020fc0000", "7fc0cc7f00781ffffff8", "7ffffe38c0dffffffff8", "7fff0e1003bfffffff60", "40ffcf0009bffffff0c0",
  "007fff801ffffffff880", "003fff0007fffffff000", "003ffc001c737fffec00", "003ff800181f7fff4800", "001ff0000f07ffff3000",
  "000f80001fff7fff0000", "000f00003ffb9fff0000", "000340003fffc7b80000", "0001c0003ffd82380000", "000020003ffe021c0000",
  "00001f001fff00100000", "00000fc001ff00010000", "00000fe001fe00028000", "00001ff800fc00080c00", "00000ff800fc00000200",
  "000007f800fc00003000", "000003f800fd0000fc00", "000003f000790001fe00", "000007e000780001fe00", "000007c000700001de00",
  "00000780000000000e00", "00000600000000000008", "00000600000000000020", "00000400000000000000", "00000400000000000000",
];

const WORLD = { columns: 80, rows: 30, west: -168, east: 192, north: 76, south: -56 } as const;

/** Land cells as a flat row-major array of booleans. */
const worldLand: boolean[] = ROWS.flatMap(row => [...row].flatMap(digit => {
  const bits = parseInt(digit, 16);
  return [8, 4, 2, 1].map(bit => (bits & bit) !== 0);
}));


export type StatsBandLayout = "plain" | "divided"

export interface StatsBandProps {
  /** Three or four stats read best. */
  stats?: Stat[]
  /** `plain` lets the stats float on whitespace; `divided` sets them in a hairline grid ruled above and below. */
  layout?: StatsBandLayout
  title?: string
  description?: string
  /** Seconds each number takes to count up. Defaults to 1.6. */
  duration?: number
  /** Number formatting locale. Fixed by default so server and client agree. */
  locale?: string
  className?: string
}

type Bezier = [number, number, number, number]
const enter = [...motionTokens.ease.enter] as Bezier
const STAGGER = 0.09

const REDUCE = "(prefers-reduced-motion: reduce)"
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCE)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
/** Reduced motion, read after hydration so the server and first client render agree. CSS covers the first paint. */
function useReducedMotionSafe() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCE).matches, () => false)
}

/**
 * Formats a stat's number, split from its compact unit so the unit can sit beside the digits like a suffix. A compact
 * stat counts inside its final unit (0.0M to 2.3M) instead of jumping from K to M halfway through.
 */
function useFormat(stat: Stat, locale: string) {
  return useMemo(() => {
    const decimals = stat.decimals ?? 0
    const digits = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, numberingSystem: "latn" })
    if (stat.notation !== "compact") return { unit: "", format: (value: number) => digits.format(value) }
    const size = Math.abs(stat.value)
    const scale = size >= 1e12 ? 1e12 : size >= 1e9 ? 1e9 : size >= 1e6 ? 1e6 : size >= 1e3 ? 1e3 : 1
    const unit = scale === 1 ? "" : new Intl.NumberFormat(locale, { notation: "compact" }).formatToParts(scale).find(part => part.type === "compact")?.value ?? ""
    return { unit, format: (value: number) => digits.format(value / scale) }
  }, [stat.decimals, stat.notation, stat.value, locale])
}

/** Visually hidden text for screen readers. */
const srOnly = "absolute m-[-1px] size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]"

/**
 * One number that counts from zero to its value the first time the band is in view. The final value reserves the
 * width underneath, so the layout never moves while digits change. Screen readers only get the final value.
 */
function CountUp({ stat, run, delay, duration, reduced, locale }: { stat: Stat; run: boolean; delay: number; duration: number; reduced: boolean; locale: string }) {
  const live = useRef<HTMLSpanElement>(null)
  const done = useRef(false)
  const { unit, format } = useFormat(stat, locale)
  const final = format(stat.value)
  const suffix = `${unit}${stat.suffix ?? ""}`

  useLayoutEffect(() => {
    if (reduced || done.current || !live.current) return
    live.current.textContent = format(0)
  }, [format, reduced])

  useEffect(() => {
    const node = live.current
    if (!node) return
    if (reduced) {
      node.textContent = final
      done.current = true
      return
    }
    if (!run || done.current) return
    const controls = animate(0, stat.value, {
      duration,
      delay,
      ease: enter,
      onUpdate: latest => {
        node.textContent = format(latest)
      },
      onComplete: () => {
        node.textContent = final
        done.current = true
      },
    })
    return () => controls.stop()
  }, [run, reduced, stat.value, delay, duration, format, final])

  return (
    <>
      <span className={srOnly}>
        {stat.prefix}
        {final}
        {suffix}
      </span>
      <span
        className="inline-flex items-baseline font-display text-[length:clamp(2.5rem,1.4rem_+_3cqi,var(--text-4xl))] leading-none font-medium tracking-display whitespace-nowrap tabular-nums"
        aria-hidden="true"
      >
        {stat.prefix && <span className="mr-[.08em] text-[.5em] tracking-[-.01em] text-text-muted">{stat.prefix}</span>}
        <span className="inline-grid justify-items-start">
          <span className="invisible [grid-area:1/1]">{final}</span>
          <span ref={live} className="[grid-area:1/1]">
            {final}
          </span>
        </span>
        {suffix && <span className="ml-[.1em] text-[.5em] tracking-[-.01em] text-text-muted">{suffix}</span>}
      </span>
    </>
  )
}

/* Visuals. Each one is drawn at rest; the band hides it until it is in view, then draws it in. */

/** Line and area reveal left to right once the band is in view. */
const draw =
  "block size-full overflow-visible [clip-path:inset(0_100%_0_0)] [transition:clip-path_1100ms_var(--ease-in-out)_var(--start)] group-data-[in-view]/band:[clip-path:inset(0_-4px_0_0)] motion-reduce:[clip-path:inset(0_-4px_0_0)]! motion-reduce:[transition:none]!"

function Trend({ values }: { values: number[] }) {
  const min = Math.min(...values),
    max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((value, index) => [values.length > 1 ? (index / (values.length - 1)) * 100 : 100, 36 - ((value - min) / span) * 32] as const)
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")
  const [endX, endY] = points[points.length - 1]
  return (
    <div className="mr-[3px]">
      <svg className={draw} viewBox="0 0 100 40" preserveAspectRatio="none">
        <path className="fill-(--soft) opacity-[.22] [transition:fill_var(--duration-standard)_var(--ease-standard)]" d={`${line} L100 40 L0 40 Z`} />
        <path className="fill-none stroke-(--ink) stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round] [transition:stroke_var(--duration-standard)_var(--ease-standard)]" d={line} vectorEffect="non-scaling-stroke" />
      </svg>
      <span
        className={cn(
          "absolute mt-[-3.5px] ml-[-3.5px] size-[7px] rounded-full bg-(--ink) shadow-[0_0_0_2px_var(--background)]",
          "opacity-0 [transform:scale(.3)]",
          "[transition:background-color_var(--duration-standard)_var(--ease-standard),opacity_320ms_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
          "group-data-[in-view]/band:opacity-100 group-data-[in-view]/band:[transform:none]",
          "group-data-[in-view]/band:[transition-delay:0ms,calc(var(--start)+1000ms),calc(var(--start)+1000ms)]",
          "motion-reduce:opacity-100! motion-reduce:[transform:none]! motion-reduce:[transition:none]!",
        )}
        style={{ left: `${endX}%`, top: `${(endY / 40) * 100}%` }}
      />
    </div>
  )
}

/** A bar grows from the baseline once the band is in view, each one a beat after the last. */
const bar =
  "h-full flex-[1_1_0] bg-(--soft) data-[ink]:bg-(--ink) [transform-origin:bottom] [transform:scaleY(0)] [transition:background-color_var(--duration-standard)_var(--ease-standard),transform_560ms_var(--ease-enter)] group-data-[in-view]/band:[transform:scaleY(var(--h))] group-data-[in-view]/band:[transition-delay:0ms,calc(var(--start)+var(--j)*420ms)] motion-reduce:[transform:scaleY(var(--h))]! motion-reduce:[transition:none]!"

function Uptime({ days }: { days: number[] }) {
  // 90 days never fit 90 fixed gaps in a narrow column, so dense bars carve their gap out of their own slot.
  return (
    <div className="flex h-[56%]! items-end gap-0" data-dense="">
      {days.map((uptime, index) => (
        <span
          key={index}
          className={cn(bar, "rounded-none [clip-path:inset(0_22%_0_22%)]")}
          data-ink={uptime < 100 ? "" : undefined}
          style={{ "--j": index / days.length, "--h": Math.min(1, Math.max(0.3, 1 - (100 - uptime) * 0.7)) } as CSSProperties}
        />
      ))}
    </div>
  )
}

function Distribution({ bins, max, marker }: { bins: number[]; max: number; marker: number }) {
  const peak = Math.max(...bins) || 1
  const width = max / bins.length
  return (
    <div className="flex items-end gap-[3px]">
      {bins.map((count, index) => (
        <span
          key={index}
          className={cn(bar, "rounded-[1px]")}
          data-ink={index * width < marker ? "" : undefined}
          style={{ "--j": index / bins.length, "--h": Math.max(0.04, count / peak) } as CSSProperties}
        />
      ))}
    </div>
  )
}

const cellOf = (lon: number, lat: number) => {
  const x = Math.floor((((((lon - WORLD.west) % 360) + 360) % 360) / (WORLD.east - WORLD.west)) * WORLD.columns)
  const y = Math.floor(((WORLD.north - lat) / (WORLD.north - WORLD.south)) * WORLD.rows)
  return [Math.min(WORLD.columns - 1, Math.max(0, x)), Math.min(WORLD.rows - 1, Math.max(0, y))] as const
}

/** Snaps a point to the nearest land dot, so a coastal city never lights a dot in the sea. */
function nearestLand(lon: number, lat: number) {
  const [x, y] = cellOf(lon, lat)
  let best = y * WORLD.columns + x,
    distance = Infinity
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const cx = x + dx,
        cy = y + dy
      if (cx < 0 || cy < 0 || cx >= WORLD.columns || cy >= WORLD.rows || !worldLand[cy * WORLD.columns + cx]) continue
      const d = dx * dx + dy * dy
      if (d < distance) {
        distance = d
        best = cy * WORLD.columns + cx
      }
    }
  return best
}

function WorldMap({ points }: { points: [number, number][] }) {
  const lit = useMemo(() => new Set(points.map(([lon, lat]) => nearestLand(lon, lat))), [points])
  return (
    <div className="flex @max-[520px]/stats:justify-end">
      <svg className={cn(draw, "w-auto aspect-[80/30]")} viewBox={`0 0 ${WORLD.columns} ${WORLD.rows}`}>
        {worldLand.map(
          (land, index) =>
            land &&
            !lit.has(index) && (
              <circle key={index} className="fill-(--soft) [transition:fill_var(--duration-standard)_var(--ease-standard)]" cx={(index % WORLD.columns) + 0.5} cy={Math.floor(index / WORLD.columns) + 0.5} r={0.3} />
            ),
        )}
        {[...lit].map(index => (
          <circle key={index} className="fill-(--ink) [transition:fill_var(--duration-standard)_var(--ease-standard)]" cx={(index % WORLD.columns) + 0.5} cy={Math.floor(index / WORLD.columns) + 0.5} r={0.5} />
        ))}
      </svg>
    </div>
  )
}

function Visual({ visual }: { visual: StatVisual }) {
  switch (visual.kind) {
    case "trend":
      return <Trend values={visual.values} />
    case "uptime":
      return <Uptime days={visual.days} />
    case "distribution":
      return <Distribution bins={visual.bins} max={visual.max} marker={visual.marker} />
    case "map":
      return <WorldMap points={visual.points} />
  }
}

/* The divided grid: a hairline between stats. Rules draw across the band, then the hairlines grow between stats. */
const dividedStats = cn(
  "gap-0!",
  "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border before:content-[''] before:origin-left before:[transform:scaleX(0)] before:[transition:transform_900ms_var(--ease-in-out)]",
  "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border after:content-[''] after:origin-left after:[transform:scaleX(0)] after:[transition:transform_900ms_var(--ease-in-out)] after:[transition-delay:120ms]",
  "group-data-[in-view]/band:before:[transform:scaleX(1)] group-data-[in-view]/band:after:[transform:scaleX(1)]",
  "motion-reduce:before:[transition:none]! motion-reduce:after:[transition:none]!",
)
const dividedStat = cn(
  "px-8 pt-10 pb-8 first:pl-0 last:pr-0",
  "not-first:before:absolute not-first:before:inset-y-0 not-first:before:left-0 not-first:before:w-px not-first:before:bg-border not-first:before:content-[''] not-first:before:origin-top",
  "not-first:before:[transform:scaleY(0)] not-first:before:[transition:transform_700ms_var(--ease-enter)] not-first:before:[transition-delay:calc(var(--i)*90ms+240ms)]",
  "group-data-[in-view]/band:not-first:before:[transform:scaleY(1)] motion-reduce:not-first:before:[transition:none]!",
  // Tablet: two by two.
  "@max-[800px]/stats:p-8 @max-[800px]/stats:nth-[2n+1]:pl-0 @max-[800px]/stats:nth-[2n]:pr-0 @max-[800px]/stats:nth-[2n+1]:before:hidden",
  "after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-border @max-[800px]/stats:nth-[n+3]:after:content-['']",
  // Phone: one stat per row.
  "@max-[520px]/stats:py-8! @max-[520px]/stats:px-0! @max-[520px]/stats:before:hidden! @max-[520px]/stats:nth-[n+2]:after:content-['']",
)
/* Three stacked stats in the divided grid: no column padding or vertical hairlines, a rule between each row instead. */
const dividedStatOfThree = cn(
  dividedStat,
  "@max-[800px]/stats:px-0! @max-[800px]/stats:before:hidden! @max-[800px]/stats:nth-[n+2]:after:content-['']",
)

/**
 * A band of three or four headline numbers, each with an optional tiny visual that proves it: a trend, an uptime strip,
 * a latency histogram, or a dotted world. The numbers count up in a staggered sequence the first time the band is in
 * view, then the visuals draw in. Hovering or focusing a stat swaps its detail line for one line of context and gives
 * its visual the accent. Numbers use tabular figures and reserve their final width; screen readers get final values.
 */
export const StatsBand = forwardRef<HTMLElement, StatsBandProps>(function StatsBand(
  { stats = exampleStats, layout = "plain", title, description, duration = 1.6, locale = "en-US", className },
  ref,
) {
  const id = useId()
  const list = useRef<HTMLDListElement>(null)
  const inView = useInView(list, { once: true, amount: 0.4 })
  const reduced = useReducedMotionSafe()
  const withVisuals = stats.some(stat => stat.visual)
  const count = Math.min(stats.length, 4)
  const divided = layout === "divided"
  return (
    <section
      ref={ref}
      className={cn("group/band @container/stats bg-background font-sans tracking-body text-foreground", className)}
      data-layout={layout}
      data-in-view={inView || reduced ? "" : undefined}
      aria-labelledby={title ? `${id}-title` : undefined}
      aria-label={title ? undefined : "Key numbers"}
    >
      <div className="mx-auto max-w-[1120px] px-8 py-24 @max-[800px]/stats:py-20 @max-[520px]/stats:px-4 @max-[520px]/stats:py-16">
        {(title || description) && (
          <header
            className={cn(
              "mb-16 grid items-baseline-last gap-x-12 gap-y-4 @max-[800px]/stats:mb-12 @max-[520px]/stats:mb-10",
              title ? "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] @max-[800px]/stats:grid-cols-[minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)]",
            )}
          >
            {title && (
              <h2
                id={`${id}-title`}
                className="m-0 max-w-[16ch] font-display text-[length:clamp(1.875rem,1rem_+_2.6cqi,var(--text-4xl))] leading-display font-medium tracking-display text-balance"
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                className={cn(
                  "m-0 max-w-[34ch] text-base leading-[1.5] text-text-secondary text-pretty",
                  title ? "justify-self-end @max-[800px]/stats:justify-self-start" : "justify-self-start",
                )}
              >
                {description}
              </p>
            )}
          </header>
        )}
        <dl
          ref={list}
          className={cn(
            "relative m-0 grid grid-cols-[repeat(var(--count),minmax(0,1fr))] gap-x-10 gap-y-16",
            "@max-[800px]/stats:grid-cols-2 @max-[800px]/stats:gap-x-8 @max-[800px]/stats:gap-y-12",
            count === 3 && "@max-[800px]/stats:grid-cols-[minmax(0,1fr)]",
            "@max-[520px]/stats:grid-cols-[minmax(0,1fr)] @max-[520px]/stats:gap-y-10",
            divided && dividedStats,
          )}
          data-count={count}
          data-visuals={withVisuals ? "" : undefined}
          style={{ "--count": count, "--draw": `${Math.round(duration * 420)}ms` } as CSSProperties}
        >
          {stats.map((stat, index) => (
            <div
              key={`${stat.label}-${index}`}
              className={cn(
                "group/stat relative flex min-w-0 cursor-default flex-col [-webkit-tap-highlight-color:transparent] outline-none",
                "[--start:calc(var(--i)*90ms+var(--draw))] [--ink:var(--text-secondary)] [--soft:var(--border-strong)]",
                // Entry: stats rise in sequence while the numbers count.
                "translate-y-2 opacity-0 [transition:opacity_480ms_var(--ease-enter)_calc(var(--i)*90ms),translate_640ms_var(--ease-enter)_calc(var(--i)*90ms)]",
                "group-data-[in-view]/band:translate-y-0 group-data-[in-view]/band:opacity-100",
                "motion-reduce:translate-y-0! motion-reduce:opacity-100! motion-reduce:[transition:none]!",
                // Hover or focus: the visual takes the accent. The other stats stay neutral.
                "focus-visible:[--ink:var(--accent)] focus-visible:[--soft:color-mix(in_oklab,var(--accent)_42%,var(--background))]",
                "[@media(hover:none)]:focus:[--ink:var(--accent)] [@media(hover:none)]:focus:[--soft:color-mix(in_oklab,var(--accent)_42%,var(--background))]",
                "hover:[--ink:var(--accent)] hover:[--soft:color-mix(in_oklab,var(--accent)_42%,var(--background))]",
                // Phone: the visual beside the number so nothing is cramped.
                "@max-[520px]/stats:grid @max-[520px]/stats:grid-cols-[minmax(0,1fr)_minmax(0,40%)] @max-[520px]/stats:gap-x-6 @max-[520px]/stats:[grid-template-areas:'figure_visual'_'label_label'_'caption_caption']",
                divided && (count === 3 ? dividedStatOfThree : dividedStat),
              )}
              style={{ "--i": index } as CSSProperties}
              tabIndex={stat.context ? 0 : undefined}
              data-context={stat.context && stat.detail ? "" : undefined}
            >
              <dt className="text-sm leading-body font-medium text-foreground text-pretty @max-[520px]/stats:[grid-area:label]">{stat.label}</dt>
              <dd className="order-[-1] m-0 mb-5 @max-[520px]/stats:mb-3 @max-[520px]/stats:self-end @max-[520px]/stats:[grid-area:figure]">
                <CountUp stat={stat} run={inView} delay={index * STAGGER} duration={duration} reduced={reduced} locale={locale} />
              </dd>
              {(stat.detail || stat.context) && (
                <dd className="mx-0 mt-0.5 mb-0 grid text-sm leading-body text-text-muted @max-[520px]/stats:[grid-area:caption]">
                  {stat.detail && (
                    <span
                      className={cn(
                        "min-w-0 text-pretty [grid-area:1/1] [transition:opacity_var(--duration-standard)_var(--ease-standard),translate_var(--duration-standard)_var(--ease-standard)] motion-reduce:[transition-duration:0ms]!",
                        "group-data-[context]/stat:group-focus-visible/stat:-translate-y-1 group-data-[context]/stat:group-focus-visible/stat:opacity-0",
                        "[@media(hover:none)]:group-data-[context]/stat:group-focus/stat:-translate-y-1 [@media(hover:none)]:group-data-[context]/stat:group-focus/stat:opacity-0",
                        "group-data-[context]/stat:group-hover/stat:-translate-y-1 group-data-[context]/stat:group-hover/stat:opacity-0",
                      )}
                    >
                      {stat.detail}
                    </span>
                  )}
                  {stat.context && (
                    <span
                      className={cn(
                        "min-w-0 text-pretty text-text-secondary [grid-area:1/1] [transition:opacity_var(--duration-standard)_var(--ease-standard),translate_var(--duration-standard)_var(--ease-standard)] motion-reduce:[transition-duration:0ms]!",
                        "group-data-[context]/stat:translate-y-1 group-data-[context]/stat:opacity-0",
                        "group-data-[context]/stat:group-focus-visible/stat:translate-y-0 group-data-[context]/stat:group-focus-visible/stat:opacity-100",
                        "[@media(hover:none)]:group-data-[context]/stat:group-focus/stat:translate-y-0 [@media(hover:none)]:group-data-[context]/stat:group-focus/stat:opacity-100",
                        "group-data-[context]/stat:group-hover/stat:translate-y-0 group-data-[context]/stat:group-hover/stat:opacity-100",
                      )}
                    >
                      {stat.context}
                    </span>
                  )}
                </dd>
              )}
              {withVisuals && (
                <dd
                  className="relative m-0 mt-auto flex h-[calc(56px+var(--space-8))] flex-none flex-col justify-end pt-8 *:relative *:h-full @max-[520px]/stats:mb-3 @max-[520px]/stats:h-10 @max-[520px]/stats:self-end @max-[520px]/stats:p-0 @max-[520px]/stats:[grid-area:visual]"
                  aria-hidden="true"
                >
                  {stat.visual && <Visual visual={stat.visual} />}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
})

StatsBand.displayName = "StatsBand"

const layoutOptions = [
  { value: "divided", label: "Divided" },
  { value: "plain", label: "Plain" },
]

/** Preview: the band in either layout. Switching layouts plays the sequence again. */
export function StatsBandBlock() {
  const [layout, setLayout] = useState<StatsBandLayout>("divided")
  return (
    <div className="grid w-full justify-items-center gap-4">
      <SegmentedControl label="Stats layout" options={layoutOptions} value={layout} onValueChange={next => setLayout(next as StatsBandLayout)} />
      <div className="w-full overflow-hidden rounded-[20px] border border-border bg-background">
        <StatsBand key={layout} layout={layout} title="Fast, steady, and close to everyone" description="Measured across every region from October 2025 to September 2026." />
      </div>
    </div>
  )
}

export default StatsBandBlock
