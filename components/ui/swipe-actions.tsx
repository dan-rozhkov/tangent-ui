"use client"

import { createContext, useContext, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react"
import type {
  CSSProperties,
  Dispatch,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  SetStateAction,
} from "react"
import { Menu } from "@base-ui/react/menu"
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useTransform,
} from "motion/react"
import type { AnimationPlaybackControls, MotionValue } from "motion/react"
import { DotsThreeIcon } from "@phosphor-icons/react"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"
import { clampUnit, axisVelocity, resistPast } from "@/lib/gesture"

export interface SwipeAction {
  label: string
  icon: ReactNode
  /** Fill of the revealed action. Pair `danger` with a label that names the destructive result. */
  tone?: "neutral" | "accent" | "danger"
  /** Runs for a full swipe, a tap on the revealed action, or the More actions menu. Remove the item here unless `keepRow` is set. */
  onSelect: () => void
  /** The row springs home after the action instead of sliding away and collapsing, for actions such as Mark as unread. */
  keepRow?: boolean
}

/**
 * A list whose rows reveal actions on a horizontal swipe, the way a mail inbox does. Use it for short lists where people triage items quickly.
 * Only one row stays open at a time; touching anywhere else or pressing Escape puts it away. Every row also has a More actions menu with the same
 * actions, so keyboard and screen reader users never need the gesture.
 */
export interface SwipeActionsProps {
  label: string
  children: ReactNode
  className?: string
}

/** One row. `leading` actions sit under the left edge and `trailing` actions under the right; the outermost action on each side commits on a full swipe. */
export interface SwipeActionsRowProps {
  /** Names the row in its menu button, for example the message subject. */
  label: string
  leading?: SwipeAction[]
  trailing?: SwipeAction[]
  /** Lets a long swipe commit the outermost action without a tap. On by default. */
  fullSwipe?: boolean
  children: ReactNode
  className?: string
}

type Side = "leading" | "trailing"
type Group = {
  openId: string | null
  setOpenId: Dispatch<SetStateAction<string | null>>
  rows: Map<string, HTMLElement>
}
type Drag = {
  pointer: number
  type: string
  startX: number
  startY: number
  origin: number
  locked: "x" | "y" | null
  samples: { t: number; x: number }[]
}

/* The surface clips every row, so revealed actions never spill past its rounded corners. It hides once the last row has left.
   When the last row is on its way out, the frame and the rows' tint fade with it instead of leaving a hairline or a band behind. */
const surfaceClass = [
  "overflow-hidden rounded-panel border border-border bg-surface [transition:border-color_var(--duration-standard)_var(--ease-standard),background-color_var(--duration-standard)_var(--ease-standard)] motion-reduce:transition-none",
  "[&:not(:has(>ul>li:not([data-removing])))]:border-transparent [&:not(:has(>ul>li:not([data-removing])))]:bg-transparent has-[>ul:empty]:hidden",
  "[&:not(:has(>ul>li:not([data-removing])))_li]:bg-transparent",
].join(" ")
/* The content follows the finger by transform only; vertical pans stay with the page. Its surface is a separate layer behind the children, and the
   children get a compositing layer of their own, so the rounded edge can animate without re-rasterising images inside. */
const contentClass = [
  "relative z-10 flex min-h-18 touch-pan-y items-center gap-2 py-3 pr-2 pl-4 select-none [-webkit-touch-callout:none] [&_img]:[-webkit-user-drag:none]",
  "pointer-fine:cursor-grab group-data-dragging/row:cursor-grabbing",
].join(" ")
/* The button anchors a menu, so a press answers with colour, never scale. */
const moreClass = [
  "grid size-8 flex-none cursor-pointer place-items-center rounded-[calc(var(--radius-control)-6px)] border-0 bg-transparent text-text-muted [-webkit-tap-highlight-color:transparent] focus-visible:outline-none",
  "[transition:color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
  "active:bg-surface-muted active:text-foreground data-popup-open:bg-surface-muted data-popup-open:text-foreground pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
  "group-data-dragging/row:bg-transparent! group-data-dragging/row:text-text-muted!",
].join(" ")
/* Each action is a transparent hit target spanning the full row from the edge it hides behind, sliding in by transform. The list surface shows
   through; only the pill and its label are drawn. Outer actions stack above inner ones. */
const layerClass = [
  "absolute top-0 bottom-0 w-full cursor-pointer border-0 bg-transparent p-0 text-text-secondary [-webkit-tap-highlight-color:transparent] focus:outline-none",
  "data-[side=leading]:right-full data-[side=trailing]:left-full",
].join(" ")
/* The pill carries the tone; its icon reads against it in both themes. */
const pillToneClass = {
  neutral:
    "bg-[color-mix(in_oklab,var(--foreground)_56%,var(--surface))] text-background dark:bg-[color-mix(in_oklab,var(--foreground)_26%,var(--surface))] dark:text-foreground",
  accent: "bg-accent text-accent-foreground",
  danger: "bg-danger text-background",
} as const
/* The menu grows from its trigger, matching the library dropdown. Transitions keyed off Base UI's starting and ending states stand in for the keyframes. */
const menuClass = [
  "[--menu-x:0px] [--menu-y:-5px] data-[side=top]:[--menu-y:5px]",
  "relative min-w-44 rounded-panel border border-border bg-surface-raised p-[5px] shadow-floating outline-none",
  "origin-(--transform-origin) [transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-spring)_var(--ease-spring)]",
  "data-starting-style:[transform:translate(var(--menu-x),var(--menu-y))_scale(.97)] data-starting-style:opacity-0",
  "data-ending-style:[transform:translate(calc(var(--menu-x)*.5),calc(var(--menu-y)*.5))_scale(.985)] data-ending-style:opacity-0",
  "data-ending-style:[transition:opacity_var(--duration-instant)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)]",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_var(--duration-instant)_linear]!",
].join(" ")
const itemClass = [
  "group/item relative flex min-h-9 cursor-pointer items-center gap-[10px] rounded-[calc(var(--radius-panel)-6px)] px-[11px] text-sm text-foreground outline-none",
  "[transition:background-color_var(--duration-instant)_var(--ease-standard),opacity_var(--duration-standard)_var(--ease-enter)_calc(min(var(--i,0),4)*35ms),transform_var(--duration-standard)_var(--ease-enter)_calc(min(var(--i,0),4)*35ms)]",
  "in-data-starting-style:[transform:translate(calc(var(--menu-x)*.4),calc(var(--menu-y)*.4))] in-data-starting-style:opacity-0 motion-reduce:transition-none",
  "data-highlighted:bg-surface-muted data-[tone=danger]:text-danger data-[tone=danger]:data-highlighted:bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface-raised))]",
].join(" ")

/** Width of one action while a row rests open. */
const ACTION = 80
/** Height of a pill once its slot is wide enough, and the gap between neighbouring pills. */
const PILL_H = 44
const GAP = 8
/** Space between a pill and its label, and the label's line height. */
const LABEL_GAP = 4
const LABEL_H = 16
/** Travel over which the content's edge facing the revealed actions grows to `--radius-panel`. */
const RADIUS_TRAVEL = 24
/** A pill's icon fades in over the pill widths from `ICON_FROM`, across `ICON_SPAN`. */
const ICON_FROM = 14
const ICON_SPAN = 26
/** Distance from a layer's outer edge to its inner edge, for the layer at `rank`. Past the outermost rank there is nothing, so the inset is zero. */
function insetOf(rank: number, count: number, coverRank: number | null, revealed: number, progress: number) {
  const base = ((count - rank) * revealed) / count
  if (coverRank === rank) return base + progress * (revealed - base)
  if (coverRank !== null && rank > coverRank) return base * (1 - progress)
  return base
}
/** Movement before a press is read as a swipe or handed to the page as a scroll. */
const SLOP = 8
/** The divider fades out over the first few pixels of travel, the same distance a press needs to count as a swipe. */
const DIVIDER_FADE = SLOP
/** Seconds of travel projected from the release velocity, roughly a 0.99 deceleration rate. */
const PROJECTION = 0.1
/** Release speed in px/s that counts as a flick. */
const FLICK = 900
const sideOf = (value: number): Side | null => (value > 0 ? "leading" : value < 0 ? "trailing" : null)

const GroupContext = createContext<Group>({
  openId: null,
  setOpenId: () => {},
  rows: new Map(),
})

export function SwipeActions({ label, children, className }: SwipeActionsProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [rows] = useState(() => new Map<string, HTMLElement>())
  useEffect(() => {
    if (!openId) return
    const onPointerDown = (event: PointerEvent) => {
      const row = rows.get(openId)
      if (row && event.target instanceof Node && row.contains(event.target)) return
      setOpenId(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null)
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [openId, rows])
  const group = useMemo(() => ({ openId, setOpenId, rows }), [openId, rows])
  return (
    <GroupContext.Provider value={group}>
      <div className={cn(surfaceClass, className)}>
        <ul
          role="list"
          aria-label={label}
          tabIndex={-1}
          className="m-0 mb-[-1px] list-none p-0 focus-visible:outline-none"
        >
          <AnimatePresence initial={false}>{children}</AnimatePresence>
        </ul>
      </div>
    </GroupContext.Provider>
  )
}

/** The release speed measured up to the last sample: nothing to go stale, since the release is the last move. */
function velocityOf(samples: Drag["samples"]) {
  const last = samples[samples.length - 1]
  return last ? axisVelocity(samples, last.t, (sample) => sample.x, { stale: Infinity }) : 0
}

export function SwipeActionsRow({
  label,
  leading = [],
  trailing = [],
  fullSwipe = true,
  children,
  className,
}: SwipeActionsRowProps) {
  const motionTokens = useMotionTokens()
  const { openId, setOpenId, rows } = useContext(GroupContext)
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const present = useIsPresent()
  const rowRef = useRef<HTMLLIElement>(null)
  const x = useMotionValue(0)
  const cover = useMotionValue(0)
  // Only the edge facing the revealed actions rounds off, growing with the distance travelled.
  const radiusTrailing = useTransform(x, (value) => `calc(var(--radius-panel) * ${clampUnit(-value / RADIUS_TRAVEL)})`)
  const radiusLeading = useTransform(x, (value) => `calc(var(--radius-panel) * ${clampUnit(value / RADIUS_TRAVEL)})`)
  // The divider would poke past the rounded corner, so it fades as soon as the row leaves home.
  const dividerOpacity = useTransform(x, (value) => 1 - clampUnit(Math.abs(value) / DIVIDER_FADE))
  const [covering, setCovering] = useState<{
    side: Side
    index: number
  } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const width = useRef(0)
  const drag = useRef<Drag | null>(null)
  const travel = useRef<AnimationPlaybackControls | null>(null)
  const stretch = useRef<AnimationPlaybackControls | null>(null)
  const armed = useRef(false)
  const leaving = useRef(false)
  const swallowClick = useRef(false)
  const focusNeighbour = useRef(false)
  const restoreTimer = useRef(0)

  const actionsOf = (side: Side) => (side === "leading" ? leading : trailing)
  const openWidth = (side: Side) => actionsOf(side).length * ACTION
  const outermost = (side: Side) => (side === "leading" ? 0 : trailing.length - 1)
  const canCommit = (side: Side) => fullSwipe && actionsOf(side).length > 0
  const threshold = (side: Side) => Math.max(openWidth(side) + 48, width.current * 0.56)

  function stretchTo(value: number) {
    stretch.current?.stop()
    if (reduced) {
      cover.jump(value)
      return
    }
    stretch.current = animate(cover, value, motionTokens.spring.morph)
  }

  /** Springs the row to a stop, carrying the release velocity. Travel snaps instantly with reduced motion. */
  function settle(target: number, velocity = 0) {
    if (armed.current || (target !== 0 && cover.get() !== 0)) stretchTo(0)
    armed.current = false
    const from = x.get()
    const home = () => {
      if (target === 0) {
        stretch.current?.stop()
        cover.jump(0)
      }
    }
    if (reduced) {
      x.jump(target)
      home()
    } else {
      // Heading home, the spring may not carry the row past zero, or the opposite actions would flash.
      const toward = target === 0 && Math.sign(velocity) === -Math.sign(from)
      const launch = toward ? Math.sign(velocity) * Math.min(Math.abs(velocity), Math.abs(from) * 12) : velocity
      travel.current = animate(x, target, {
        ...(target === 0 ? motionTokens.spring.smooth : motionTokens.spring.snappy),
        velocity: launch,
        onComplete: home,
      })
    }
    if (target === 0) setOpenId((current) => (current === id ? null : current))
    else setOpenId(id)
  }

  /** The chosen action stretches over the whole row while the row leaves in its direction; the list then closes the gap. */
  function commit(side: Side, index: number, velocity = 0) {
    const action = actionsOf(side)[index]
    if (!action || leaving.current) return
    const direction = side === "leading" ? 1 : -1
    armed.current = false
    setCovering({ side, index })
    stretchTo(1)
    if (action.keepRow) {
      action.onSelect()
      settle(0, velocity)
      return
    }
    leaving.current = true
    const row = rowRef.current
    if (row) row.dataset.removing = ""
    travel.current?.stop()
    const end = direction * (width.current + 2)
    if (reduced) x.jump(end)
    else
      travel.current = animate(x, end, {
        ...motionTokens.spring.smooth,
        velocity: Math.sign(velocity) === direction ? velocity : 0,
      })
    setOpenId((current) => (current === id ? null : current))
    action.onSelect()
    // A list that keeps the item gets its row back instead of an empty band of colour.
    window.clearTimeout(restoreTimer.current)
    restoreTimer.current = window.setTimeout(() => {
      if (!leaving.current) return
      leaving.current = false
      if (row) delete row.dataset.removing
      settle(0)
    }, 1400)
  }

  function arm(value: number, pointerType: string) {
    const side = sideOf(value)
    const limit = side ? threshold(side) : Infinity
    const next = !!side && canCommit(side) && Math.abs(value) > (armed.current ? limit - 20 : limit)
    if (next === armed.current || !side) {
      if (!side && armed.current) {
        armed.current = false
        stretchTo(0)
      }
      return
    }
    armed.current = next
    if (next) {
      setCovering({ side, index: outermost(side) })
      if (pointerType === "touch") navigator.vibrate?.(8)
    }
    stretchTo(next ? 1 : 0)
  }

  function constrain(raw: number) {
    const side = sideOf(raw)
    if (!side) return 0
    const dimension = width.current || 320
    const limit = actionsOf(side).length === 0 ? 0 : canCommit(side) ? dimension : openWidth(side)
    // Past its last stop the row still follows, but every pixel costs more, like pulling against elastic.
    return resistPast(raw, limit, dimension)
  }

  function release(velocity: number) {
    const value = x.get(),
      side = sideOf(value)
    if (!side || actionsOf(side).length === 0) {
      settle(0, velocity)
      return
    }
    const direction = side === "leading" ? 1 : -1
    const distance = Math.abs(value),
      outward = velocity * direction,
      open = openWidth(side)
    const projected = distance + outward * PROJECTION
    const flung = distance > open && outward > FLICK && projected > threshold(side)
    // A flick back toward home cancels an armed full swipe.
    if (canCommit(side) && ((armed.current && outward > -FLICK) || flung)) {
      commit(side, outermost(side), velocity)
      return
    }
    settle(projected > open / 2 ? direction * open : 0, velocity)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    swallowClick.current = false
    if (leaving.current || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return
    // Catch the row mid-flight: the next move retargets from wherever it is now.
    travel.current?.stop()
    drag.current = {
      pointer: event.pointerId,
      type: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      origin: x.get(),
      locked: null,
      samples: [{ t: event.timeStamp, x: event.clientX }],
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId || current.locked === "y") return
    if (!current.locked) {
      const dx = event.clientX - current.startX,
        dy = event.clientY - current.startY
      if (Math.hypot(dx, dy) < SLOP) return
      if (Math.abs(dy) > Math.abs(dx)) {
        current.locked = "y"
        return
      }
      // Measure from here, so crossing the slop never jumps the row.
      current.locked = "x"
      current.startX = event.clientX
      event.currentTarget.setPointerCapture(event.pointerId)
      if (rowRef.current) rowRef.current.dataset.dragging = ""
      setOpenId(id)
    }
    const value = constrain(current.origin + event.clientX - current.startX)
    x.set(value)
    current.samples.push({ t: event.timeStamp, x: event.clientX })
    if (current.samples.length > 12) current.samples.shift()
    arm(value, current.type)
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId) return
    drag.current = null
    if (current.locked === "x") {
      swallowClick.current = true
      if (rowRef.current) delete rowRef.current.dataset.dragging
      current.samples.push({ t: event.timeStamp, x: event.clientX })
      release(event.type === "pointercancel" ? 0 : velocityOf(current.samples))
      return
    }
    // A tap on an open row closes it instead of acting on what is underneath.
    if (current.locked === null && Math.abs(x.get()) > 0.5) {
      swallowClick.current = true
      settle(0)
    }
  }

  function onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!swallowClick.current) return
    swallowClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  function moveFocusToNeighbour() {
    const row = rowRef.current
    if (!row) return
    const staying = (step: "nextElementSibling" | "previousElementSibling") => {
      let node = row[step]
      while (node instanceof HTMLElement && "removing" in node.dataset) node = node[step]
      return node
    }
    const neighbour = staying("nextElementSibling") ?? staying("previousElementSibling")
    ;(neighbour?.querySelector<HTMLElement>("[data-swipe-more]") ?? row.parentElement)?.focus({ preventScroll: true })
  }

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    rows.set(id, row)
    width.current = row.offsetWidth
    const observer = new ResizeObserver(([entry]) => {
      width.current = entry.contentRect.width
    })
    observer.observe(row)
    return () => {
      observer.disconnect()
      rows.delete(id)
      window.clearTimeout(restoreTimer.current)
      setOpenId((current) => (current === id ? null : current))
    }
  }, [id, rows, setOpenId])

  // Another row opened, or someone touched outside: put this one away.
  const closeForOthers = useEffectEvent(() => {
    if (openId !== id && !leaving.current && drag.current?.locked !== "x" && x.get() !== 0) settle(0)
  })
  useEffect(() => {
    closeForOthers()
  }, [openId])

  // Undo brought the item back while it was still leaving: slide it home as the height reopens.
  const returnHome = useEffectEvent(() => {
    if (!leaving.current) return
    leaving.current = false
    window.clearTimeout(restoreTimer.current)
    if (rowRef.current) delete rowRef.current.dataset.removing
    settle(0)
  })
  useEffect(() => {
    if (present) returnHome()
  }, [present])

  const menuItems = [
    ...leading.map((action, index) => ({
      action,
      side: "leading" as const,
      index,
    })),
    ...trailing.map((action, index) => ({
      action,
      side: "trailing" as const,
      index,
    })),
  ]
  const collapse = reduced
    ? { opacity: 0, transition: { duration: 0.15 } }
    : {
        height: 0,
        opacity: 0,
        transition: {
          height: { ...motionTokens.spring.smooth, delay: 0.12 },
          opacity: { duration: motionTokens.duration.instant, delay: 0.34 },
        },
      }

  return (
    <motion.li
      ref={rowRef}
      // The tint behind the actions lets the rounded card edge read against the list surface.
      className={cn("group/row relative isolate overflow-hidden bg-[color-mix(in_oklab,var(--foreground)_5%,var(--surface))] [transition:background-color_var(--duration-standard)_var(--ease-standard)] motion-reduce:transition-none", className)}
      style={{ "--swipe-action-width": `${ACTION}px` } as CSSProperties}
      initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={collapse}
      transition={
        reduced
          ? { duration: 0.15 }
          : {
              height: motionTokens.spring.smooth,
              opacity: {
                duration: motionTokens.duration.standard,
                ease: [...motionTokens.ease.enter],
              },
            }
      }
    >
      {(["leading", "trailing"] as const).map((side) =>
        actionsOf(side).map((action, index) => {
          const count = actionsOf(side).length
          const rank = side === "leading" ? count - 1 - index : index
          const coverRank =
            covering?.side === side ? (side === "leading" ? count - 1 - covering.index : covering.index) : null
          return (
            <ActionLayer
              key={`${side}-${index}`}
              action={action}
              side={side}
              rank={rank}
              count={count}
              coverRank={coverRank}
              x={x}
              cover={cover}
              onPress={() => commit(side, index)}
            />
          )
        })
      )}
      <motion.div
        className={contentClass}
        style={{ x }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-surface"
          style={{
            borderTopLeftRadius: radiusLeading,
            borderBottomLeftRadius: radiusLeading,
            borderTopRightRadius: radiusTrailing,
            borderBottomRightRadius: radiusTrailing,
          }}
        />
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 left-(--swipe-actions-inset,var(--space-4)) h-px bg-border"
          style={{ opacity: dividerOpacity }}
        />
        <div className="min-w-0 flex-[1_1_auto] will-change-transform">{children}</div>
        {menuItems.length > 0 && (
          <Menu.Root open={menuOpen} onOpenChange={(open) => setMenuOpen(open)} loopFocus>
            {/* Opens on click rather than on press, so a swipe that starts on the button still moves the row. */}
            <Menu.Trigger
              className={moreClass}
              data-swipe-more=""
              aria-label={`More actions for ${label}`}
              onPointerDown={(event) => event.preventDefault()}
              onClick={(event) => {
                if (event.detail > 0) setMenuOpen((open) => !open)
              }}
            >
              <DotsThreeIcon size={18} aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner className="z-60" align="end" sideOffset={6} collisionPadding={12}>
                <Menu.Popup
                  className={menuClass}
                  finalFocus={() => {
                    if (!focusNeighbour.current) return true
                    focusNeighbour.current = false
                    moveFocusToNeighbour()
                    return false
                  }}
                >
                  {menuItems.map(({ action, side, index }, order) => (
                    <Menu.Item
                      key={`${side}-${index}`}
                      className={itemClass}
                      data-tone={action.tone}
                      style={{ "--i": order } as CSSProperties}
                      onClick={() => {
                        focusNeighbour.current = !action.keepRow
                        commit(side, index)
                      }}
                    >
                      <span
                        className="inline-flex w-[17px] text-text-secondary group-data-[tone=danger]/item:text-danger [&_svg]:size-4"
                        aria-hidden="true"
                      >
                        {action.icon}
                      </span>
                      {action.label}
                    </Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </motion.div>
    </motion.li>
  )
}

type LayerProps = {
  action: SwipeAction
  side: Side
  rank: number
  count: number
  coverRank: number | null
  x: MotionValue<number>
  cover: MotionValue<number>
  onPress: () => void
}

/**
 * One revealed action: a pill with its label below it. Rank 0 sits against the content and the highest rank at the row's outer edge. Every layer spans
 * the full row, transparent, and slides in from its edge. Its slot is the strip of the revealed space it owns; the pill fills the slot minus a gap, so
 * it starts as a small circle, grows, then stretches. The covering action's slot grows to the whole revealed width and its pill stretches across,
 * with the icon staying at the inner edge.
 */
function ActionLayer({ action, side, rank, count, coverRank, x, cover, onPress }: LayerProps) {
  const direction = side === "leading" ? 1 : -1
  const covers = coverRank === rank
  // `inset` is the distance from the row's outer edge to this layer's inner edge. The slot runs from there to the next layer's inner edge.
  const place = useTransform([x, cover], ([value, progress]: number[]) => {
    const revealed = Math.max(0, value * direction)
    const inset = insetOf(rank, count, coverRank, revealed, progress)
    return { inset, slot: Math.max(0, inset - insetOf(rank + 1, count, coverRank, revealed, progress)) }
  })
  const shift = useTransform(place, ({ inset }) => direction * inset)
  const slot = useTransform(place, (value) => value.slot)
  // The covering layer rises above the others only while it stretches, so at rest the outer layer always wins the tap.
  const zIndex = useTransform(cover, (progress) => (progress > 0 && covers ? count + 1 : rank + 1))
  const pillW = useTransform(slot, (value) => Math.max(0, value - GAP))
  const pillH = useTransform(pillW, (value) => Math.min(PILL_H, value))
  // The icon sits in a square-ish box at the inner edge of the pill, so it stays put while the pill stretches.
  const iconBox = useTransform(pillW, (value) => Math.min(value, ACTION - GAP))
  // The label rides the centre of the slot, then hugs the content edge while this action covers the row.
  const labelX = useTransform(
    [slot, cover],
    ([share, progress]: number[]) => -direction * (covers ? share / 2 + progress * (ACTION / 2 - share / 2) : share / 2)
  )
  const iconReveal = useTransform([pillW, cover], ([width, progress]: number[]) => {
    const own = clampUnit((width - ICON_FROM) / ICON_SPAN)
    if (covers) return Math.max(own, progress)
    return coverRank === null ? own : own * (1 - progress)
  })
  const labelReveal = useTransform([slot, cover], ([share, progress]: number[]) => {
    const own = clampUnit((share - ACTION * 0.72) / (ACTION * 0.24))
    if (covers) return Math.max(own, progress)
    return coverRank === null ? own : own * (1 - progress)
  })
  const iconScale = useTransform(iconReveal, (value) => 0.6 + 0.4 * value)
  const innerEdge = side === "trailing" ? "left" : "right"
  // The pill and label stack is centred in the row, whatever the pill's current height.
  const stackTop = `calc(50% - ${(PILL_H + LABEL_GAP + LABEL_H) / 2}px)`
  // The menu button is the accessible path, so the revealed copy stays out of the tab order and the accessibility tree.
  return (
    <motion.button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      className={layerClass}
      data-side={side}
      style={{ x: shift, zIndex }}
      onClick={onPress}
    >
      <span className="absolute flex items-center" style={{ top: stackTop, height: PILL_H, [innerEdge]: GAP / 2 }}>
        <motion.span
          className={cn("relative block overflow-hidden rounded-pill", pillToneClass[action.tone ?? "neutral"])}
          style={{ width: pillW, height: pillH }}
        >
          <motion.span
            className={cn("absolute inset-y-0 grid place-items-center [&_svg]:size-5", side === "trailing" ? "left-0" : "right-0")}
            style={{ width: iconBox, opacity: iconReveal, scale: iconScale }}
          >
            {action.icon}
          </motion.span>
        </motion.span>
      </span>
      <motion.span
        className={cn("absolute w-0", side === "trailing" ? "left-0" : "right-0")}
        style={{ x: labelX, top: `calc(${stackTop} + ${PILL_H + LABEL_GAP}px)`, height: LABEL_H }}
      >
        <span className="absolute inset-y-0 left-[calc(var(--swipe-action-width)/-2)] flex w-(--swipe-action-width) items-center justify-center">
          <motion.span
            className="text-xs leading-4 font-medium tracking-body whitespace-nowrap"
            style={{ opacity: labelReveal }}
          >
            {action.label}
          </motion.span>
        </span>
      </motion.span>
    </motion.button>
  )
}

export default SwipeActions
