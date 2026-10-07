"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode, Ref } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import type { PanInfo, Transition, Variants } from "motion/react"
import { CaretDownIcon, MonitorIcon, MoonIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react"
import { SpinnerArc } from "@/components/ui/icons"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type UserStatus = "available" | "busy" | "away"
export type ThemePreference = "light" | "dark" | "system"

/** Statuses in menu order. Each one has its own dot shape as well as color: solid, barred, or hollow. */
export const userStatuses: { value: UserStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "away", label: "Away" },
]

const themes: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon size={16} aria-hidden="true" /> },
  { value: "dark", label: "Dark", icon: <MoonIcon size={16} aria-hidden="true" /> },
  { value: "system", label: "System", icon: <MonitorIcon size={16} aria-hidden="true" /> },
]

export interface UserMenuUser {
  name: string
  email: string
  plan?: string
  avatarSrc?: string
  avatarSrcSet?: string
}
export interface UserMenuItem {
  label: string
  icon?: ReactNode
  keys?: string[]
  onSelect?: () => void
}

/**
 * The account menu behind a person's photo in an app's top bar. It holds a compact identity header, a short group of account
 * destinations, an inline theme switch, and sign out. On screens narrower than 640px it opens as a bottom sheet instead.
 * Theme and status choices keep the menu open; everything else closes it and returns focus to the trigger.
 * When `onSignOut` returns a promise, the item shows its progress and the menu closes once it settles.
 */
export interface UserMenuProps {
  user: UserMenuUser
  /** Presence status. Passing `status` or `onStatusChange` shows the presence dot and an inline status switch. */
  status?: UserStatus
  defaultStatus?: UserStatus
  onStatusChange?: (status: UserStatus) => void
  theme?: ThemePreference
  defaultTheme?: ThemePreference
  /** Reports the choice. Applying it to the page is up to the app. */
  onThemeChange?: (theme: ThemePreference) => void
  /** Shows the inline light, dark, and system switch. */
  showTheme?: boolean
  /** Account destinations with optional shortcut hints, such as ["⌘", ","]. Keep it to three or four. */
  items?: UserMenuItem[]
  onSignOut?: () => void | Promise<unknown>
  signOutKeys?: string[]
  align?: "start" | "center" | "end"
  /** Shows the name and a chevron beside the avatar from 640px up. */
  showName?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Renders the desktop panel in a portal on the body. Pass false to keep it inside the trigger's wrapper. */
  portal?: boolean
  /** The trigger button, for returning focus after the menu is swapped out. */
  ref?: Ref<HTMLButtonElement>
  className?: string
}

type Highlight = { top: number; height: number; tone?: string; glide: boolean }
type OpenReason = "first" | "last" | "pointer" | null

const compactQuery = "(max-width: 639px)"
const subscribeCompact = (change: () => void) => {
  const query = window.matchMedia(compactQuery)
  query.addEventListener("change", change)
  return () => query.removeEventListener("change", change)
}
const subscribeNothing = () => () => {}
const statusLabel = (status: UserStatus) => userStatuses.find(option => option.value === status)?.label ?? status
const enter = [...motionTokens.ease.enter] as [number, number, number, number]
const standard = [...motionTokens.ease.standard] as [number, number, number, number]
const exitEase = [0.4, 0, 1, 1] as [number, number, number, number]

/** The panel grows out of the trigger on a critically damped spring; rows follow a beat later. Closing is a short fade. */
const panelMotion: Variants = {
  closed: { opacity: 0, scale: 0.94 },
  open: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      visualDuration: 0.3,
      bounce: 0,
      opacity: { duration: motionTokens.duration.fast, ease: enter },
      delayChildren: 0.03,
      staggerChildren: 0.016,
    },
  },
  exit: { opacity: 0, scale: 0.97, transition: { duration: motionTokens.duration.instant, ease: exitEase } },
}
const sheetMotion: Variants = {
  closed: { y: "100%" },
  open: { y: 0, transition: { ...motionTokens.spring.smooth, visualDuration: 0.36, delayChildren: 0.06, staggerChildren: 0.02 } },
  exit: { y: "100%", transition: { duration: 0.22, ease: exitEase } },
}
const stillMotion: Variants = {
  closed: { opacity: 0 },
  open: { opacity: 1, transition: { duration: motionTokens.duration.instant } },
  exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
}
const rowMotion: Variants = { closed: { opacity: 0, y: 3 }, open: { opacity: 1, y: 0, transition: { duration: 0.2, ease: enter } } }

/* One mark, three shapes: solid for available, a bar for busy, a ring for away. Color and shape change together, so status never rests on color alone. */
const dotBase = [
  "relative inline-block size-(--dot-size,10px) flex-none rounded-pill bg-(--dot-color)",
  "[transition:background-color_var(--duration-standard)_var(--ease-standard),box-shadow_var(--duration-fast)_var(--ease-standard)]",
  "before:absolute before:inset-0 before:m-auto before:bg-(--presence-surface,var(--surface)) before:content-['']",
  "after:absolute after:inset-0 after:m-auto after:bg-(--presence-surface,var(--surface)) after:content-['']",
  "before:[transition:transform_var(--duration-spring)_var(--ease-spring),background-color_var(--duration-fast)_var(--ease-standard)]",
  "after:[transition:transform_var(--duration-spring)_var(--ease-spring),background-color_var(--duration-fast)_var(--ease-standard)]",
  "before:size-[46%] before:rounded-pill after:h-[22%] after:min-h-[1.5px] after:w-[58%] after:rounded-[1px]",
  "motion-reduce:transition-none motion-reduce:before:transition-none motion-reduce:after:transition-none",
].join(" ")
const dotStatus: Record<UserStatus | "offline", string> = {
  available: "[--dot-color:var(--success)] before:[transform:scale(0)] after:[transform:scaleX(0)]",
  busy: "[--dot-color:var(--danger)] before:[transform:scale(0)] after:[transform:scaleX(1)]",
  away: "[--dot-color:var(--warning)] before:[transform:scale(1)] after:[transform:scaleX(0)]",
  offline: "[--dot-color:var(--text-muted)] before:[transform:scale(1)] after:[transform:scaleX(0)]",
}

/** A presence mark that morphs between statuses: the color crossfades while a hole opens for away and a bar slides in for busy. */
export function PresenceDot({ status, className }: { status: UserStatus | "offline"; className?: string }) {
  return <span className={cn(dotBase, dotStatus[status], className)} data-status={status} aria-hidden="true" />
}

const portraitClass =
  "block size-full rounded-pill bg-surface-muted object-cover object-[50%_15%] outline-1 -outline-offset-1 outline-[color-mix(in_oklab,var(--foreground)_9%,transparent)] select-none"

function Portrait({ user }: { user: UserMenuUser }) {
  const [failed, setFailed] = useState<string>()
  if (!user.avatarSrc || failed === user.avatarSrc) {
    const initials = user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join("")
    return (
      <span
        className={cn(
          portraitClass,
          "grid place-items-center text-[calc(var(--face-size)*.36)] leading-none font-medium text-text-secondary",
        )}
      >
        {initials}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- registry components stay framework agnostic; pass optimized URLs as avatarSrc and avatarSrcSet.
    <img
      className={portraitClass}
      src={user.avatarSrc}
      srcSet={user.avatarSrcSet}
      alt=""
      decoding="async"
      draggable={false}
      onError={() => setFailed(user.avatarSrc)}
    />
  )
}

function Face({ user, status, size }: { user: UserMenuUser; status?: UserStatus; size: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "relative inline-grid size-(--face-size) flex-none",
        size === "sm" ? "[--dot-size:11px] [--face-size:32px]" : "[--dot-size:12px] [--face-size:40px]",
      )}
      data-size={size}
    >
      <Portrait user={user} />
      {status && (
        <PresenceDot status={status} className="absolute -right-px -bottom-px shadow-[0_0_0_2px_var(--presence-surface,var(--surface))]" />
      )}
    </span>
  )
}

/** Changing text rises out of a small blur while the old text lifts away. */
function Rise({ text, reduced }: { text: string; reduced: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={text}
        className="inline-block whitespace-nowrap"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: `blur(${motionTokens.blur.subtle}px)` }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={
          reduced
            ? { opacity: 0, transition: { duration: 0 } }
            : {
                opacity: 0,
                y: "-0.35em",
                filter: `blur(${motionTokens.blur.subtle}px)`,
                transition: { duration: motionTokens.duration.fast, ease: standard },
              }
        }
        transition={reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: enter }}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  )
}

function Keys({ keys, sheet }: { keys: string[]; sheet: boolean }) {
  return (
    <kbd
      className={cn(
        "ml-auto inline-flex flex-none items-center gap-px font-body text-xs tracking-normal text-text-muted tabular-nums opacity-80",
        sheet && "hidden",
      )}
      aria-hidden="true"
    >
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`} className="inline-block min-w-[1.05em] text-center [font:inherit]">
          {key}
        </kbd>
      ))}
    </kbd>
  )
}

const iconSlot = "inline-grid w-4 flex-none place-items-center [transition:color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none"

/** A compact inline switch. It is one stop in the menu: up and down pass over it, left and right choose within it. */
function Segmented<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
  variants,
  sheet,
}: {
  label: string
  icon: ReactNode
  value: T
  options: { value: T; label: string; icon: ReactNode }[]
  onChange: (value: T) => void
  variants?: Variants
  sheet: boolean
}) {
  const index = Math.max(
    0,
    options.findIndex(option => option.value === value),
  )
  return (
    <motion.div
      className={cn("relative flex items-center gap-3 pr-1.5 pl-3", sheet ? "h-14" : "h-11")}
      data-stop="group"
      data-label={label}
      variants={variants}
    >
      <span className={cn(iconSlot, "text-text-secondary")} aria-hidden="true">
        {icon}
      </span>
      <span className={cn("flex-1 leading-body text-foreground", sheet ? "text-base" : "text-sm")} aria-hidden="true">
        {label}
      </span>
      {/* The thumb slides under the icons; the group owns the stacking context. */}
      <div
        className={cn(
          "relative isolate inline-grid flex-none auto-cols-(--segment) grid-flow-col rounded-pill bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] p-0.5",
          sheet ? "h-[38px] [--segment:44px]" : "h-[30px] [--segment:32px]",
        )}
        role="group"
        aria-label={label}
        style={{ "--index": index, "--count": options.length } as CSSProperties}
      >
        <span
          className={cn(
            "absolute top-0.5 bottom-0.5 left-0.5 -z-1 w-(--segment) rounded-pill bg-surface-raised shadow-[0_1px_2px_oklch(0%_0_0/.1),0_0_0_1px_var(--border-subtle)]",
            "[transform:translateX(calc(var(--index)*100%))] [transition:transform_var(--duration-spring)_var(--ease-spring)] motion-reduce:transition-none",
            "dark:bg-[color-mix(in_oklab,var(--foreground)_20%,var(--surface-raised))] dark:shadow-none",
          )}
          aria-hidden="true"
        />
        {options.map(option => {
          const checked = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={checked}
              aria-label={option.label}
              title={option.label}
              className={cn(
                "m-0 grid cursor-pointer place-items-center rounded-pill border-0 bg-transparent p-0 outline-none [-webkit-tap-highlight-color:transparent]",
                "[transition:color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
                checked ? "text-foreground" : "text-text-muted pointer-fine:hover:text-text-secondary",
              )}
              onClick={() => onChange(option.value)}
            >
              {option.icon}
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

const getStops = (root: HTMLElement | null) => Array.from(root?.querySelectorAll<HTMLElement>("[data-stop]") ?? [])
function focusStop(stop: HTMLElement | undefined) {
  if (!stop) return
  const target =
    stop.dataset.stop === "group"
      ? (stop.querySelector<HTMLElement>('[aria-checked="true"]') ?? stop.querySelector<HTMLElement>("button"))
      : stop
  target?.focus({ preventScroll: true })
}

/** Rows: a fixed height from --row, nested corners stepped down from the panel by its inset. */
function itemClass(danger: boolean, sheet: boolean) {
  return cn(
    "group/item relative m-0 box-border flex h-(--row) w-full cursor-pointer items-center gap-3 rounded-[calc(var(--radius-panel)-var(--inset))] border-0 bg-transparent px-3",
    "text-left leading-body outline-none select-none [-webkit-tap-highlight-color:transparent]",
    "[transition:color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none [@media(hover:none)]:active:bg-surface-muted",
    sheet ? "text-base" : "text-sm",
    danger ? "text-[color-mix(in_oklab,var(--danger)_58%,var(--text-secondary))] focus:text-danger" : "text-foreground",
  )
}
function itemIconClass(danger: boolean) {
  return cn(
    iconSlot,
    danger
      ? "text-[color-mix(in_oklab,var(--danger)_58%,var(--text-secondary))] group-focus/item:text-danger"
      : "text-text-secondary group-focus/item:text-accent-strong",
  )
}

export function UserMenu({
  user,
  status: statusProp,
  defaultStatus = "available",
  onStatusChange,
  theme: themeProp,
  defaultTheme = "system",
  onThemeChange,
  showTheme = true,
  items = [],
  onSignOut,
  signOutKeys,
  align = "end",
  showName = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  portal = true,
  ref,
  className,
}: UserMenuProps) {
  const id = useId()
  const menuId = `${id}-menu`
  const triggerId = `${id}-trigger`
  const reduced = !!useReducedMotion()
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  )
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(compactQuery).matches,
    () => false,
  )
  const [innerOpen, setInnerOpen] = useState(defaultOpen)
  const [innerStatus, setInnerStatus] = useState(defaultStatus)
  const [innerTheme, setInnerTheme] = useState(defaultTheme)
  const [signingOut, setSigningOut] = useState(false)
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const open = openProp ?? innerOpen
  const showStatus = statusProp !== undefined || onStatusChange !== undefined
  const status = statusProp ?? innerStatus
  const theme = themeProp ?? innerTheme
  const rootRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const reason = useRef<OpenReason>(null)
  const typed = useRef({ text: "", timer: 0 })
  const mounted = useRef(true)
  const pending = useRef(false)
  const sheet = hydrated && compact
  const inline = !portal && !sheet

  useEffect(() => {
    mounted.current = true
    const current = typed.current
    return () => {
      mounted.current = false
      window.clearTimeout(current.timer)
    }
  }, [])

  function setTriggerRef(node: HTMLButtonElement | null) {
    triggerRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) (ref as { current: HTMLButtonElement | null }).current = node
  }

  function setOpen(next: boolean, why: OpenReason = null) {
    reason.current = next ? why : null
    if (next) setSigningOut(pending.current)
    setHighlight(null)
    setInnerOpen(next)
    onOpenChange?.(next)
  }
  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }

  // Focus moves in only when a person opened the menu, so a menu that starts open never steals focus or scrolls the page.
  useEffect(() => {
    if (!open) return
    const why = reason.current
    reason.current = null
    if (!why) return
    const frame = requestAnimationFrame(() => {
      const stops = getStops(listRef.current)
      if (why === "first") focusStop(stops[0])
      else if (why === "last") focusStop(stops.at(-1))
      else surfaceRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, sheet])

  // The panel is placed against the trigger and scales from the avatar's center, flipping above when there is no room below.
  useLayoutEffect(() => {
    if (!open || sheet) return
    const place = () => {
      const panel = surfaceRef.current,
        trigger = triggerRef.current
      if (!panel || !trigger) return
      const rect = trigger.getBoundingClientRect()
      const width = panel.offsetWidth,
        height = panel.offsetHeight
      let left: number, top: number
      if (inline) {
        const root = rootRef.current?.getBoundingClientRect()
        left = (root?.left ?? 0) + panel.offsetLeft
        top = (root?.top ?? 0) + panel.offsetTop
      } else {
        const wanted =
          align === "start" ? rect.left : align === "center" ? rect.left + rect.width / 2 - width / 2 : rect.right - width
        left = Math.min(Math.max(12, wanted), window.innerWidth - width - 12)
        const below = rect.bottom + 8
        top = below + height > window.innerHeight - 12 && rect.top - 8 - height > 12 ? rect.top - 8 - height : below
        panel.style.left = `${left}px`
        panel.style.top = `${top}px`
      }
      const faceCenter = rect.left + Math.min(rect.width, 40) / 2
      const originX = align === "end" && rect.width > 40 ? rect.right - 20 - left : faceCenter - left
      panel.style.setProperty("--origin-x", `${Math.min(Math.max(0, originX), width)}px`)
      panel.style.setProperty("--origin-y", top < rect.top ? `${height}px` : "0px")
    }
    place()
    if (inline) return
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, sheet, inline, align])

  // Outside presses close the panel. The sheet has its own scrim.
  useEffect(() => {
    if (!open || sheet) return
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node
      if (surfaceRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      reason.current = null
      setHighlight(null)
      setInnerOpen(false)
      onOpenChange?.(false)
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [open, sheet, onOpenChange])

  // The page behind the sheet stays put.
  useEffect(() => {
    if (!open || !sheet) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = "hidden"
    return () => {
      root.style.overflow = previous
    }
  }, [open, sheet])

  function changeStatus(value: UserStatus) {
    setInnerStatus(value)
    onStatusChange?.(value)
  }
  function changeTheme(value: ThemePreference) {
    setInnerTheme(value)
    onThemeChange?.(value)
  }

  function signOut() {
    if (pending.current) return
    const result = onSignOut?.()
    if (!result || typeof result.then !== "function") {
      close(true)
      return
    }
    // Async sign out keeps the menu open with its progress on the item, then closes once it settles.
    pending.current = true
    setSigningOut(true)
    const done = () => {
      pending.current = false
      if (mounted.current) close(false)
    }
    result.then(done, done)
  }

  function onListFocus(event: FocusEvent<HTMLDivElement>) {
    const stop = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-stop]") : null
    if (!stop) {
      setHighlight(null)
      return
    }
    setHighlight(current => ({ top: stop.offsetTop, height: stop.offsetHeight, tone: stop.dataset.tone, glide: current !== null }))
  }

  // Focus follows a mouse or pen, so the keyboard carries on from wherever the pointer left the highlight.
  function onItemPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return
    if (document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true })
  }
  // The inline switches are not rows, so the pointer over them releases the highlight instead of dragging it along.
  function onListPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" || !highlight) return
    const group = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-stop="group"]') : null
    if (!group || group.contains(document.activeElement)) return
    setHighlight(null)
    surfaceRef.current?.focus({ preventScroll: true })
  }
  function onListPointerLeave(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return
    setHighlight(null)
    surfaceRef.current?.focus({ preventScroll: true })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const stops = getStops(listRef.current)
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const current = active?.closest<HTMLElement>("[data-stop]") ?? null
    const index = current ? stops.indexOf(current) : -1
    const step = (to: HTMLElement | undefined) => {
      event.preventDefault()
      focusStop(to)
    }
    switch (event.key) {
      case "ArrowDown":
        return step(stops[(index + 1) % stops.length])
      case "ArrowUp":
        return step(stops[index <= 0 ? stops.length - 1 : index - 1])
      case "Home":
        return step(stops[0])
      case "End":
        return step(stops.at(-1))
      case "Escape":
      case "Tab":
        event.preventDefault()
        return close(true)
      case "ArrowLeft":
      case "ArrowRight": {
        if (current?.dataset.stop !== "group") return
        event.preventDefault()
        const segments = Array.from(current.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'))
        const at = Math.max(
          0,
          segments.findIndex(segment => segment.getAttribute("aria-checked") === "true"),
        )
        const next = segments[(at + (event.key === "ArrowRight" ? 1 : -1) + segments.length) % segments.length]
        next?.focus({ preventScroll: true })
        next?.click()
        return
      }
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.key === " ") return
    // Typeahead: letters jump to the next row whose label starts with what was typed.
    const memory = typed.current
    window.clearTimeout(memory.timer)
    memory.text += event.key.toLowerCase()
    memory.timer = window.setTimeout(() => {
      memory.text = ""
    }, 500)
    const ordered = [...stops.slice(index + 1), ...stops.slice(0, index + 1)]
    const search = memory.text.length > 1 && current?.dataset.label?.toLowerCase().startsWith(memory.text) ? [current] : ordered
    const match = search.find(stop => stop.dataset.label?.toLowerCase().startsWith(memory.text))
    if (match) step(match)
  }

  function onTriggerClick(event: MouseEvent<HTMLButtonElement>) {
    if (open) {
      close(false)
      return
    }
    setOpen(true, event.detail === 0 ? "first" : "pointer")
  }
  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    setOpen(true, event.key === "ArrowDown" ? "first" : "last")
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80 || info.velocity.y > 500) close(true)
  }

  const glide: Transition = highlight?.glide && !reduced ? motionTokens.spring.snappy : { duration: 0 }
  const row = reduced ? undefined : rowMotion
  const menuProps = { id: menuId, role: "menu", "aria-labelledby": triggerId, tabIndex: -1, onKeyDown }
  const separator = <div className="-mx-(--inset) my-(--inset) h-px bg-border-subtle" role="separator" />

  const content = (
    <>
      <motion.div className={cn("flex items-center gap-3", sheet ? "px-2 pt-1 pb-3" : "px-2 pt-2 pb-2.5")} variants={row}>
        <Face user={user} status={showStatus ? status : undefined} size="md" />
        <div className="grid min-w-0 flex-1 gap-px">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm leading-body font-medium text-foreground">{user.name}</span>
            {user.plan && (
              <span className="inline-flex h-[18px] flex-none items-center rounded-pill bg-accent-subtle px-[7px] text-xs leading-none font-medium text-accent-strong">
                {user.plan}
              </span>
            )}
          </div>
          <span className="truncate text-xs leading-body text-text-muted" title={user.email}>
            {user.email}
          </span>
        </div>
      </motion.div>
      <div ref={listRef} className="relative" onFocus={onListFocus} onPointerMove={onListPointerMove} onPointerLeave={onListPointerLeave}>
        {/* One highlight follows the pointer and the keyboard. It is the only hover treatment in the menu. */}
        <motion.span
          className="pointer-events-none absolute top-0 right-0 left-0 rounded-[calc(var(--radius-panel)-var(--inset))] bg-accent-subtle opacity-0 data-[tone=danger]:bg-[color-mix(in_oklab,var(--danger)_11%,transparent)]"
          data-tone={highlight?.tone}
          aria-hidden="true"
          initial={false}
          animate={highlight ? { y: highlight.top, height: highlight.height, opacity: 1 } : { opacity: 0 }}
          transition={{ default: glide, opacity: { duration: reduced ? 0 : motionTokens.duration.instant } }}
        />
        {items.length > 0 && (
          <>
            {separator}
            {items.map(item => (
              <motion.button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={itemClass(false, sheet)}
                data-stop="item"
                data-label={item.label}
                variants={row}
                onPointerMove={onItemPointerMove}
                onClick={() => {
                  close(true)
                  item.onSelect?.()
                }}
              >
                <span className={itemIconClass(false)} aria-hidden="true">
                  {item.icon}
                </span>
                <span className="relative inline-flex min-w-0 flex-1">{item.label}</span>
                {item.keys && <Keys keys={item.keys} sheet={sheet} />}
              </motion.button>
            ))}
          </>
        )}
        {(showTheme || showStatus) && (
          <>
            {separator}
            {showStatus && (
              <Segmented
                label="Status"
                icon={<PresenceDot status={status} className="[--dot-size:10px]" />}
                value={status}
                onChange={changeStatus}
                options={userStatuses.map(option => ({
                  ...option,
                  icon: <PresenceDot status={option.value} className="[--dot-size:9px] [--presence-surface:var(--surface-raised)]" />,
                }))}
                variants={row}
                sheet={sheet}
              />
            )}
            {showTheme && (
              <Segmented
                label="Theme"
                icon={<SunIcon size={16} />}
                value={theme}
                onChange={changeTheme}
                options={themes}
                variants={row}
                sheet={sheet}
              />
            )}
          </>
        )}
        {separator}
        <motion.button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={itemClass(true, sheet)}
          data-stop="item"
          data-tone="danger"
          data-label="Sign out"
          variants={row}
          aria-busy={signingOut || undefined}
          onPointerMove={onItemPointerMove}
          onClick={signOut}
        >
          <span className={itemIconClass(true)} aria-hidden="true">
            {signingOut ? (
              <SpinnerArc
                className="animate-spin [animation-duration:.8s] motion-reduce:[animation-duration:2.4s]"
                size={16}
              />
            ) : (
              <SignOutIcon size={16} />
            )}
          </span>
          <span className="relative inline-flex min-w-0 flex-1">
            <Rise text={signingOut ? "Signing out" : "Sign out"} reduced={reduced} />
          </span>
          {signOutKeys && <Keys keys={signOutKeys} sheet={sheet} />}
        </motion.button>
      </div>
    </>
  )

  /* The panel scales out of the avatar it belongs to; the component sets the origin once it is placed. */
  const surfaceClass =
    "box-border border border-border bg-surface-raised text-left font-body leading-body tracking-body text-foreground shadow-floating outline-none [--presence-surface:var(--surface-raised)]"

  const panel = (
    <AnimatePresence>
      {open && !sheet && (
        <motion.div
          key="panel"
          ref={surfaceRef}
          {...menuProps}
          className={cn(
            surfaceClass,
            "z-60 w-68 max-w-[calc(100vw-24px)] rounded-panel p-(--inset) [--inset:6px] [--row:40px]",
            "origin-[var(--origin-x,100%)_var(--origin-y,0px)]",
            inline
              ? cn(
                  "absolute top-[calc(100%+8px)]",
                  align === "end" ? "right-0 left-auto" : align === "start" ? "left-0" : "left-1/2 -ml-34",
                )
              : "fixed top-0 left-0",
          )}
          data-inline={inline || undefined}
          data-align={align}
          variants={reduced ? stillMotion : panelMotion}
          initial="closed"
          animate="open"
          exit="exit"
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  )

  /* Below 640px the same content rises as a bottom sheet with larger rows. */
  const bottomSheet = (
    <AnimatePresence>
      {open && sheet && (
        <motion.div
          key="scrim"
          className="fixed inset-0 z-70 bg-[oklch(0%_0_0/.32)] [-webkit-tap-highlight-color:transparent]"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.1 : 0.2, ease: standard }}
          onClick={() => close(true)}
        />
      )}
      {open && sheet && (
        <motion.div
          key="sheet"
          ref={surfaceRef}
          {...menuProps}
          className={cn(
            surfaceClass,
            "fixed top-auto right-0 bottom-0 left-0 z-71 max-h-[88dvh] w-auto max-w-none overflow-y-auto overscroll-contain [--inset:10px] [--row:48px]",
            "rounded-t-panel rounded-b-none border-b-0 px-(--inset) pt-2 pb-[calc(12px+env(safe-area-inset-bottom))]",
            "origin-[var(--origin-x,100%)_var(--origin-y,0px)]",
          )}
          aria-modal="true"
          variants={reduced ? stillMotion : sheetMotion}
          initial="closed"
          animate="open"
          exit="exit"
          drag={reduced ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.04, bottom: 0.9 }}
          dragMomentum={false}
          onDragEnd={onDragEnd}
        >
          <span className="mx-auto mt-0 mb-2.5 block h-[5px] w-9 cursor-grab rounded-pill bg-border-strong" aria-hidden="true" />
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <span ref={rootRef} className="relative inline-flex flex-none align-middle">
      {/* The trigger anchors the menu, so it answers hover and press with color, never with scale. */}
      <button
        ref={setTriggerRef}
        id={triggerId}
        type="button"
        className={cn(
          "group/trigger relative m-0 inline-flex h-10 flex-none cursor-pointer items-center gap-2 rounded-pill border-0 bg-transparent p-1",
          "font-body text-sm leading-[inherit] tracking-body text-foreground [-webkit-tap-highlight-color:transparent]",
          "[--presence-surface:var(--user-menu-surface,var(--surface))] [transition:background-color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
          "pointer-fine:hover:bg-surface-muted pointer-fine:hover:[--presence-surface:var(--surface-muted)]",
          "data-[state=open]:bg-surface-muted data-[state=open]:[--presence-surface:var(--surface-muted)]",
          "active:bg-[color-mix(in_oklab,var(--surface-muted),var(--foreground)_8%)] active:[--presence-surface:color-mix(in_oklab,var(--surface-muted),var(--foreground)_8%)]",
          showName && "pr-2.5 max-sm:pr-1",
          className,
        )}
        data-state={open ? "open" : "closed"}
        data-name={showName || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu, ${user.name}${showStatus ? `, ${statusLabel(status)}` : ""}`}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        <Face user={user} status={showStatus ? status : undefined} size="sm" />
        {showName && (
          <>
            <span className="max-w-44 truncate leading-none font-medium max-sm:hidden">{user.name}</span>
            <CaretDownIcon
              className={cn(
                "-ml-0.5 flex-none text-text-muted max-sm:hidden",
                "[transition:transform_var(--duration-spring)_var(--ease-spring),color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
                "group-hover/trigger:text-foreground group-data-[state=open]/trigger:[transform:rotate(180deg)] group-data-[state=open]/trigger:text-foreground",
              )}
              size={16}
              aria-hidden="true"
            />
          </>
        )}
      </button>
      {sheet ? createPortal(bottomSheet, document.body) : inline ? panel : hydrated ? createPortal(panel, document.body) : null}
    </span>
  )
}

export default UserMenu
