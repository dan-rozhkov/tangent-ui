"use client"

import {
  useEffect,
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
  animate,
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface WaffleCategory {
  /** Stable identity. Cells keep following their category when the data changes, so a new dataset flows instead of repainting. */
  key: string
  /** Name in the legend, the tooltip, and the data table. */
  label: string
  /** Raw amount. Shares are computed from the total; negatives count as zero. */
  value: number
  /** Any CSS color. Defaults to the first series for accentKey, the supporting series for the next three, then neutral steps. */
  color?: string
}

/** A unit chart: every cell is one share of the whole, so parts of a total read as countable squares. */
export interface WaffleChartProps {
  /** Categories in fill order. The first fills from the bottom-left corner, column by column. */
  data: WaffleCategory[]
  /** What the whole is, such as "Electricity generation, 2023". Names the chart for assistive technology. */
  label: string
  /** Unit after each raw value in the tooltip and table, such as "TWh". */
  unit?: string
  formatValue?: (value: number, category: WaffleCategory) => string
  /** Grid rows. rows × columns cells make the whole; 10 × 10 means one cell per percent. */
  rows?: number
  columns?: number
  /** The category painted in the accent. Pass null to keep every category neutral. Defaults to the first category. */
  accentKey?: string | null
  /** Controlled focused category. Others dim while one is focused. */
  activeKey?: string | null
  defaultActiveKey?: string | null
  onActiveChange?: (key: string | null) => void
  /** Category list with shares that roll to their new value. */
  legend?: boolean
  /** Decimal places for shares. */
  decimals?: number
  emptyLabel?: string
  ref?: Ref<HTMLElement>
  className?: string
}

type Cell = { id: number; key: string | null; slot: number }
type Pointer = { key: string; slot: number } | null

const { spring } = motionTokens
const GAP = 3
/** accentKey takes the first series and the next three categories the supporting series. Anything past that falls back to neutral steps that alternate in lightness. */
const SHADES = [40, 20, 30, 14]
/** A second, colour-free channel: neutral categories cycle through square, round, and framed cells, so neighbours differ in shape as well as lightness. */
const SHAPES = ["square", "round", "framed"] as const
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))
const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })

const subscribeNothing = () => () => {}
function useReducedMotionSafe() {
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  )
  return !!useReducedMotion() && hydrated
}

/** Whole cells per category by largest remainder, so the counts always add up to the grid. */
function allocate(
  data: WaffleCategory[],
  total: number,
  cells: number
): number[] {
  if (total <= 0) return data.map(() => 0)
  const exact = data.map((item) => (Math.max(0, item.value) / total) * cells)
  const counts = exact.map(Math.floor)
  let left = cells - counts.reduce((sum, count) => sum + count, 0)
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest)
  for (let k = 0; left > 0 && k < order.length; k++, left--)
    counts[order[k].index]++
  return counts
}

/**
 * Hands cells to categories while moving as few as possible: each category keeps the cells it already had,
 * surplus cells join the categories that grew, and every block takes its cells in their previous order so paths never cross.
 */
function reassign(
  previous: Cell[],
  data: WaffleCategory[],
  counts: number[]
): Cell[] {
  const bySlot = [...previous].sort((a, b) => a.slot - b.slot)
  const kept = new Map<string, Cell[]>()
  const pool: Cell[] = []
  const want = new Map(data.map((item, index) => [item.key, counts[index]]))
  for (const cell of bySlot) {
    const list = cell.key !== null ? (kept.get(cell.key) ?? []) : []
    if (cell.key !== null && list.length < (want.get(cell.key) ?? 0)) {
      list.push(cell)
      kept.set(cell.key, list)
    } else pool.push(cell)
  }
  const next: Cell[] = []
  let slot = 0
  data.forEach((item, index) => {
    const own = kept.get(item.key) ?? []
    while (own.length < counts[index] && pool.length) own.push(pool.shift()!)
    own
      .sort((a, b) => a.slot - b.slot)
      .forEach((cell) =>
        next.push({ id: cell.id, key: item.key, slot: slot++ })
      )
  })
  pool.forEach((cell) => next.push({ id: cell.id, key: null, slot: slot++ }))
  return next.sort((a, b) => a.id - b.id)
}

/** A share that rolls to its new value on a spring and holds its width with tabular figures. */
function Rolling({
  value,
  decimals,
  reduced,
}: {
  value: number
  decimals: number
  reduced: boolean
}) {
  const shown = useMotionValue(value)
  const text = useTransform(shown, (current) => `${current.toFixed(decimals)}%`)
  useEffect(() => {
    if (reduced) {
      shown.jump(value)
      return
    }
    const controls = animate(shown, value, spring.smooth)
    return () => controls.stop()
  }, [reduced, shown, value])
  return <motion.span>{text}</motion.span>
}

export function WaffleChart({
  data,
  label,
  unit = "",
  formatValue,
  rows = 10,
  columns = 10,
  accentKey,
  activeKey,
  defaultActiveKey = null,
  onActiveChange,
  legend = true,
  decimals = 0,
  emptyLabel = "No data",
  ref,
  className,
}: WaffleChartProps) {
  const reduced = useReducedMotionSafe()
  const figure = useRef<HTMLElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => figure.current as HTMLElement)
  const inView = useInView(figure, { once: true, amount: 0.35 })
  const count = Math.max(1, rows * columns)
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0)
  const empty = !data.length || total <= 0
  const accent = accentKey === undefined ? (data[0]?.key ?? null) : accentKey

  // Cells are persistent objects; each data change reassigns them so they travel instead of repainting.
  const signature = `${count}|${data.map((item) => `${item.key}:${item.value}`).join(",")}`
  const counts = useMemo(() => allocate(data, total, count), [signature]) // eslint-disable-line react-hooks/exhaustive-deps
  const [layout, setLayout] = useState(() => ({
    cells: reassign(
      Array.from({ length: count }, (_, id) => ({ id, key: null, slot: id })),
      data,
      counts
    ),
    moved: new Set<number>(),
    version: 0,
  }))
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    const base = Array.from(
      { length: count },
      (_, id) => layout.cells[id] ?? { id, key: null, slot: id }
    )
    const next = reassign(base, data, counts)
    setLayout({
      cells: next,
      moved: new Set(
        next
          .filter(
            (cell) =>
              base[cell.id].slot !== cell.slot || base[cell.id].key !== cell.key
          )
          .map((cell) => cell.id)
      ),
      version: layout.version + 1,
    })
  }
  const { cells, moved, version } = layout

  const [ownActive, setOwnActive] = useState<string | null>(defaultActiveKey)
  const pinned = activeKey !== undefined ? activeKey : ownActive
  const setPinned = (key: string | null) => {
    if (activeKey === undefined) setOwnActive(key)
    onActiveChange?.(key)
  }
  const [pointer, setPointer] = useState<Pointer>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const focusKey = pointer?.key ?? preview ?? pinned
  const active =
    focusKey && data.some((item) => item.key === focusKey) ? focusKey : null

  const [side, setSide] = useState(0)
  useLayoutEffect(() => {
    const node = grid.current
    if (!node) return
    const read = () => setSide(node.clientWidth)
    read()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const size = side ? (side - GAP * (columns - 1)) / columns : 0
  const height = size ? size * rows + GAP * (rows - 1) : 0
  // Column by column from the bottom-left corner, like a glass filling up.
  const place = (slot: number) => ({
    x: Math.floor(slot / rows) * (size + GAP),
    y: (rows - 1 - (slot % rows)) * (size + GAP),
  })

  const colorOf = (key: string | null) => {
    if (key === null) return "transparent"
    const index = data.findIndex((item) => item.key === key),
      item = data[index]
    if (!item) return "transparent"
    if (item.color) return item.color
    if (key === accent) return "var(--series-1)"
    const rank = data
      .filter((entry) => entry.key !== accent)
      .findIndex((entry) => entry.key === key)
    return rank < 3
      ? `var(--series-${rank + 2})`
      : `color-mix(in oklab, var(--foreground) ${SHADES[(rank - 3) % SHADES.length]}%, var(--surface))`
  }

  const shapeOf = (key: string | null) => {
    if (key === null || key === accent) return "square"
    const rank = data
      .filter((entry) => entry.key !== accent)
      .findIndex((entry) => entry.key === key)
    return rank < 0 ? "square" : SHAPES[rank % SHAPES.length]
  }

  // The tooltip glides between cells on its own spring and stays inside the figure.
  const tipX = useMotionValue(0),
    tipY = useMotionValue(0)
  const follow = { stiffness: 520, damping: 44, restDelta: 0.01 }
  const glideX = useSpring(tipX, follow),
    glideY = useSpring(tipY, follow)
  const wasShown = useRef(false)
  useLayoutEffect(() => {
    const bubble = tip.current,
      host = figure.current,
      board = grid.current
    if (!pointer || !bubble || !host || !board || !size) {
      wasShown.current = false
      return
    }
    const hostBox = host.getBoundingClientRect(),
      boardBox = board.getBoundingClientRect()
    const { x, y } = place(pointer.slot)
    const cx = boardBox.left - hostBox.left + x + size / 2,
      cy = boardBox.top - hostBox.top + y
    const tw = bubble.offsetWidth,
      th = bubble.offsetHeight
    let top = cy - th - 10
    if (top < 0) top = cy + size + 10
    const left = clamp(cx - tw / 2, 0, Math.max(0, hostBox.width - tw))
    tipX.set(left)
    tipY.set(clamp(top, 0, Math.max(0, hostBox.height - th)))
    if (!wasShown.current || reduced) {
      glideX.jump(tipX.get())
      glideY.jump(tipY.get())
    }
    wasShown.current = true
  })

  const slotAt = (clientX: number, clientY: number) => {
    const box = grid.current?.getBoundingClientRect()
    if (!box || !size) return null
    const col = clamp(
      Math.floor((clientX - box.left) / (size + GAP)),
      0,
      columns - 1
    )
    const row = clamp(
      Math.floor((clientY - box.top) / (size + GAP)),
      0,
      rows - 1
    )
    return col * rows + (rows - 1 - row)
  }
  const pointAt = (slot: number | null): Pointer => {
    if (slot === null) return null
    const cell = cells.find((item) => item.slot === slot)
    return cell?.key ? { key: cell.key, slot } : null
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || event.buttons)
      setPointer(pointAt(slotAt(event.clientX, event.clientY)))
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse")
      event.currentTarget.setPointerCapture?.(event.pointerId)
    setPointer(pointAt(slotAt(event.clientX, event.clientY)))
  }

  // Arrows walk the grid cell by cell; Page keys jump between categories.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (empty) return
    if (event.key === "Escape" && pointer) {
      event.preventDefault()
      setPointer(null)
      return
    }
    const filled = cells.filter((cell) => cell.key !== null).length
    const at = pointer?.slot ?? 0
    const col = Math.floor(at / rows),
      row = at % rows
    const blocks = counts
      .map((size, index) => ({
        start: counts.slice(0, index).reduce((sum, value) => sum + value, 0),
        size,
      }))
      .filter((block) => block.size > 0)
    const block = Math.max(
      0,
      blocks.findIndex(
        (item) => at >= item.start && at < item.start + item.size
      )
    )
    const moves: Record<string, () => number> = {
      ArrowUp: () => col * rows + Math.min(rows - 1, row + 1),
      ArrowDown: () => col * rows + Math.max(0, row - 1),
      ArrowRight: () => Math.min(columns - 1, col + 1) * rows + row,
      ArrowLeft: () => Math.max(0, col - 1) * rows + row,
      PageDown: () => blocks[Math.min(blocks.length - 1, block + 1)].start,
      PageUp: () =>
        at > blocks[block].start
          ? blocks[block].start
          : blocks[Math.max(0, block - 1)].start,
      Home: () => 0,
      End: () => filled - 1,
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setPointer(pointAt(clamp(pointer ? move() : 0, 0, Math.max(0, filled - 1))))
  }

  const format = (value: number, item: WaffleCategory) =>
    `${formatValue ? formatValue(value, item) : grouped.format(value)}${unit ? ` ${unit}` : ""}`
  const share = (item: WaffleCategory) =>
    total > 0 ? (Math.max(0, item.value) / total) * 100 : 0
  const reading = pointer
    ? (data.find((item) => item.key === pointer.key) ?? null)
    : null
  const announce = reading
    ? `${reading.label}, ${share(reading).toFixed(decimals)}%, ${format(reading.value, reading)}`
    : ""
  const summary = empty
    ? `${label}. ${emptyLabel}.`
    : `${label}. ${data.map((item) => `${item.label} ${share(item).toFixed(decimals)}%`).join(", ")}.`
  const shownX = reduced ? tipX : glideX,
    shownY = reduced ? tipY : glideY
  const settle = reduced ? { duration: 0 } : spring.morph

  return (
    <figure
      ref={figure}
      className={cn(
        "group/figure @container relative m-0 min-w-0 font-sans tracking-body text-foreground",
        className
      )}
      aria-label={label}
      data-legend={legend || undefined}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-6 @min-[420px]:group-data-[legend]/figure:grid-cols-[minmax(0,232px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div
            ref={grid}
            className="group/grid relative mx-auto w-full max-w-[300px] cursor-default touch-pan-y outline-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-user-select:none]"
            style={{
              height: height || undefined,
              aspectRatio: height ? undefined : `${columns} / ${rows}`,
            }}
            data-active={active ? true : undefined}
            role="group"
            tabIndex={empty ? -1 : 0}
            aria-roledescription="waffle chart"
            aria-label={`${label}. ${count} cells. Use arrow keys to move between cells, Page Up and Page Down to jump between categories.`}
            onPointerMove={onPointerMove}
            onPointerDown={onPointerDown}
            onPointerUp={(event) => {
              if (event.pointerType !== "mouse") setPointer(null)
            }}
            onPointerCancel={() => setPointer(null)}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setPointer(null)
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setPointer(null)}
            onFocus={(event) => {
              if (event.currentTarget.matches(":focus-visible") && !empty)
                setPointer((current) => current ?? pointAt(0))
            }}
          >
            {size > 0 &&
              cells.map((cell) => {
                const { x, y } = place(cell.slot)
                const travel = moved.has(cell.id) && !reduced
                const delay = reduced ? 0 : (cell.slot / count) * 0.32
                const on = cell.key !== null && cell.key === active
                const shown = inView || reduced
                // A travelling cell dips while it flies, so the flow reads as cells lifting out of one block and landing in another.
                const dip = travel ? [1, 0.62 + (version % 2) * 0.001, 1] : 1
                return (
                  <motion.span
                    key={cell.id}
                    className="absolute top-0 left-0 rounded-[22%] bg-[var(--cell)] [box-shadow:var(--inner),var(--outer)] will-change-transform [--inner:0_0_0_0_transparent] [--outer:0_0_0_0_transparent] [transition:background-color_var(--duration-considered)_var(--ease-standard)_var(--delay,0s),border-radius_var(--duration-considered)_var(--ease-standard)_var(--delay,0s),box-shadow_var(--duration-considered)_var(--ease-standard)_var(--delay,0s),opacity_var(--duration-fast)_var(--ease-standard)] data-cursor:[--outer:0_0_0_2px_var(--surface),0_0_0_3.5px_color-mix(in_oklab,var(--foreground)_55%,transparent)] data-[shape=framed]:[--inner:inset_0_0_0_2.5px_var(--cell),inset_0_0_0_3.25px_var(--surface)] data-[shape=round]:rounded-[50%] motion-reduce:[transition:none]! group-data-[active]/grid:[&:not([data-on])]:opacity-[.26]! group-data-[active]/grid:[&:not([data-on])]:[transition:background-color_var(--duration-considered)_var(--ease-standard)_var(--delay,0s),border-radius_var(--duration-considered)_var(--ease-standard)_var(--delay,0s),opacity_var(--duration-standard)_var(--ease-standard)]"
                    aria-hidden="true"
                    data-on={on || undefined}
                    data-cursor={pointer?.slot === cell.slot || undefined}
                    data-empty={cell.key === null || undefined}
                    data-shape={shapeOf(cell.key)}
                    style={
                      {
                        width: size,
                        height: size,
                        "--cell": colorOf(cell.key),
                        "--delay": `${delay}s`,
                      } as CSSProperties
                    }
                    initial={reduced ? false : { x, y, scale: 0.4, opacity: 0 }}
                    animate={
                      shown
                        ? {
                            x,
                            y,
                            scale: dip,
                            opacity: cell.key === null ? 0 : 1,
                          }
                        : { x, y, scale: 0.4, opacity: 0 }
                    }
                    transition={
                      reduced
                        ? { duration: 0 }
                        : {
                            x: { ...settle, delay },
                            y: { ...settle, delay },
                            scale: travel
                              ? {
                                  duration: 0.62,
                                  times: [0, 0.42, 1],
                                  ease: motionTokens.ease.inOut,
                                  delay,
                                }
                              : { ...spring.snappy, delay: delay * 0.6 },
                            opacity: {
                              duration: motionTokens.duration.standard,
                              ease: motionTokens.ease.standard,
                              delay: delay * 0.6,
                            },
                          }
                    }
                  />
                )
              })}
          </div>
          {!empty && (
            <motion.div
              ref={tip}
              className="pointer-events-none absolute top-0 left-0 z-2 grid max-w-[min(240px,100%)] min-w-[150px] scale-[.96] gap-0.5 rounded-[14px] border border-border bg-surface-raised px-3 py-2 opacity-0 shadow-floating transition-[opacity,scale] duration-160 ease-standard data-shown:scale-100 data-shown:opacity-100 motion-reduce:transition-none"
              data-shown={pointer ? true : undefined}
              style={{ x: shownX, y: shownY }}
              aria-hidden="true"
            >
              <p className="m-0 flex min-w-0 items-center gap-2 text-[length:var(--text-sm)] leading-[1.3]">
                <span
                  className="size-2.5 flex-none rounded-[3px] bg-[var(--cell)] transition-[background-color] duration-160 ease-standard data-[shape=framed]:[box-shadow:inset_0_0_0_2px_var(--cell),inset_0_0_0_3px_var(--surface)] data-[shape=round]:rounded-[50%] motion-reduce:transition-none"
                  data-shape={shapeOf(reading?.key ?? null)}
                  style={
                    { "--cell": colorOf(reading?.key ?? null) } as CSSProperties
                  }
                />
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-text-secondary">
                  {reading?.label ?? ""}
                </span>
                <span className="ml-2 flex-none font-medium tabular-nums">
                  {reading ? `${share(reading).toFixed(decimals)}%` : ""}
                </span>
              </p>
              <p className="m-0 ml-[18px] text-[length:var(--text-xs)] leading-body whitespace-nowrap text-text-muted tabular-nums">
                {reading ? format(reading.value, reading) : ""}
              </p>
            </motion.div>
          )}
          {empty && (
            <p className="m-0 grid min-h-40 place-items-center text-[length:var(--text-sm)] text-text-muted">
              {emptyLabel}
            </p>
          )}
        </div>
        {legend && !empty && (
          <ul
            className="m-0 grid min-w-0 list-none grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-2 gap-y-0.5 p-0 @max-[419px]:mx-[max(-10px,calc((100%-320px)/2))] @max-[419px]:grid-cols-[minmax(0,1fr)] @min-[420px]:group-data-[legend]/figure:grid-cols-[minmax(0,1fr)]"
            aria-label={`${label} categories`}
            onPointerLeave={() => setPreview(null)}
          >
            {data.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className="grid min-h-9 w-full cursor-pointer grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[12px] border-0 bg-transparent px-2.5 py-1 text-left text-[length:var(--text-sm)] leading-body text-text-secondary [-webkit-tap-highlight-color:transparent] [font:inherit] [transition:color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-fast)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)] active:[transform:scale(.98)] aria-pressed:text-foreground data-dim:opacity-50 data-on:bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)] data-on:text-foreground motion-reduce:[transition:none] pointer-fine:hover:text-foreground"
                  aria-pressed={pinned === item.key}
                  data-on={active === item.key || undefined}
                  data-dim={
                    (active !== null && active !== item.key) || undefined
                  }
                  onClick={() =>
                    setPinned(pinned === item.key ? null : item.key)
                  }
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setPreview(item.key)
                  }}
                  onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible"))
                      setPreview(item.key)
                  }}
                  onBlur={() => setPreview(null)}
                >
                  <span
                    className="size-2.5 rounded-[3px] bg-[var(--cell)] data-[shape=framed]:[box-shadow:inset_0_0_0_2px_var(--cell),inset_0_0_0_3px_var(--surface)] data-[shape=round]:rounded-[50%]"
                    data-shape={shapeOf(item.key)}
                    style={{ "--cell": colorOf(item.key) } as CSSProperties}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {item.label}
                  </span>
                  <span className="min-w-[3.2em] text-right text-[length:var(--text-base)] font-medium text-foreground tabular-nums">
                    <Rolling
                      value={share(item)}
                      decimals={decimals}
                      reduced={reduced}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      <p className="sr-only">{summary}</p>
      {!empty && (
        <div className="sr-only">
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Value</th>
                <th scope="col">Share</th>
                <th scope="col">Cells</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={item.key}>
                  <th scope="row">{item.label}</th>
                  <td>{format(item.value, item)}</td>
                  <td>{share(item).toFixed(decimals)}%</td>
                  <td>{counts[index]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}

export default WaffleChart
