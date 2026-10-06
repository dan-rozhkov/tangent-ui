"use client"

/* eslint-disable @next/next/no-img-element -- people avatars are plain img tags from the caller's URLs, as documented. */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { KeyboardEvent, ReactNode, RefObject } from "react"
import { createPortal } from "react-dom"
import {
  AnimatePresence,
  animate,
  motion,
  useAnimationControls,
  useDragControls,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import type { Transition, Variants } from "motion/react"
import { Check, ChevronDown, Copy, Link2, RotateCcw, Share, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { motionTokens as defaults } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"

export interface SharePerson {
  id: string
  name: string
  avatar: string
}
export interface ShareAccess {
  value: string
  label: string
  description: string
  icon: ReactNode
}
export interface ShareChannel {
  id: string
  label: string
  icon: ReactNode
  /** Shown once onChannel resolves. Keep it about as long as label. */
  doneLabel: string
}
export interface ShareSubmission {
  people: SharePerson[]
  access: string
}
export interface ShareSheetProps {
  title: string
  link: string
  people: SharePerson[]
  access: ShareAccess[]
  channels?: ShareChannel[]
  defaultAccess?: string
  onSend?: (submission: ShareSubmission) => void | Promise<unknown>
  onChannel?: (channel: string) => void | Promise<unknown>
  onCopy?: (access: string) => void
  /** Called when Undo is pressed on the confirmation; the picked people come back into the panel. */
  onUndo?: (submission: ShareSubmission) => void
  label?: string
  align?: "start" | "end" | "center"
  sheetOnPhones?: boolean
  className?: string
}

type Face = "trigger" | "panel" | "sent"
type ChannelState = "idle" | "pending" | "done" | "failed"

type Bezier = [number, number, number, number]
/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps the velocity it already has. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}
const CONTROL_RADIUS = 18
const RADIUS: Record<Face, number> = { trigger: CONTROL_RADIUS, panel: 28, sent: 26 }

const subscribe = () => () => {}
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  return !!useReducedMotion() && hydrated
}
const phoneQuery = "(max-width: 520px)"
function subscribePhone(callback: () => void) {
  const media = window.matchMedia(phoneQuery)
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}
function usePhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(phoneQuery).matches, () => false)
}

/** Motion derived from the tokens: eases, the physical springs, and the face variants. Recomputed only when the tokens change. */
function useShareMotion() {
  const motionTokens = useMotionTokens()
  return useMemo(() => {
    const enter = [...motionTokens.ease.enter] as Bezier
    const standard = [...motionTokens.ease.standard] as Bezier
    const { blur } = motionTokens
    const GROW = physical(motionTokens.spring.morph.visualDuration ?? defaults.spring.morph.visualDuration, motionTokens.spring.morph.bounce ?? defaults.spring.morph.bounce)
    const FOLD = physical(motionTokens.spring.smooth.visualDuration ?? defaults.spring.smooth.visualDuration, motionTokens.spring.smooth.bounce ?? defaults.spring.smooth.bounce)
    /** In-panel growth (the access list) follows the new content a beat late and settles without overshoot. */
    const RESIZE: Transition = { ...FOLD, delay: 0.04 }
  /** Faces cross with a short blur and a hint of scale, so the eye reads one shape changing rather than two layers. */
  const faceVariants: Variants = {
    hidden: { opacity: 0, scale: 0.97, filter: `blur(${blur.soft}px)` },
    shown: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: { scale: GROW, opacity: { duration: 0.2, ease: enter, delay: 0.05 }, filter: { duration: 0.22, ease: enter, delay: 0.05 } },
    },
    gone: {
      opacity: 0,
      scale: 0.98,
      filter: `blur(${blur.soft}px)`,
      transition: { duration: 0.12, ease: standard },
    },
  }
    return { motionTokens, enter, standard, blur, GROW, FOLD, RESIZE, faceVariants }
  }, [motionTokens])
}

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
}

const alignClass = {
  start: "left-0 origin-top-left",
  end: "right-0 origin-top-right",
  center: "left-1/2 -translate-x-1/2 origin-top",
} as const

function FaceLayer({
  id,
  reduced,
  align,
  onSize,
  className,
  children,
  labelledBy,
  role,
}: {
  id: Face
  reduced: boolean
  align: keyof typeof alignClass
  onSize: (id: Face, width: number, height: number) => void
  className?: string
  children: ReactNode
  labelledBy?: string
  role?: string
}) {
  const { faceVariants } = useShareMotion()
  const ref = useRef<HTMLDivElement>(null)
  const present = useIsPresent()
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || !present) return
    const report = () => onSize(id, node.offsetWidth, node.offsetHeight)
    report()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  }, [id, onSize, present])
  return (
    <motion.div
      ref={ref}
      data-face={id}
      role={role}
      aria-labelledby={labelledBy}
      variants={reduced ? fadeVariants : faceVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!present || undefined}
      className={cn("absolute top-0", alignClass[align], className)}
    >
      {children}
    </motion.div>
  )
}

function Spinner() {
  return (
    <span
      className="size-3.5 flex-none animate-spin rounded-full border-[1.5px] border-current border-r-transparent [animation-duration:.7s] motion-reduce:[animation-duration:1.6s]"
      aria-hidden="true"
    />
  )
}

/** The count rolls one digit up when it grows and down when it shrinks. */
function RollingCount({ value, reduced }: { value: number; reduced: boolean }) {
  const { motionTokens } = useShareMotion()
  const [previous, setPrevious] = useState(value)
  const [direction, setDirection] = useState(1)
  if (previous !== value) {
    setDirection(value > previous ? 1 : -1)
    setPrevious(value)
  }
  return (
    <span className="relative inline-flex h-[1.25em] min-w-[1ch] overflow-hidden tabular-nums" aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={{
            hidden: (dir: number) => (reduced ? { opacity: 0 } : { y: `${dir * 100}%`, opacity: 0 }),
            shown: { y: 0, opacity: 1 },
            gone: (dir: number) => (reduced ? { opacity: 0 } : { y: `${dir * -100}%`, opacity: 0 }),
          }}
          initial="hidden"
          animate="shown"
          exit="gone"
          transition={reduced ? { duration: motionTokens.duration.fast } : motionTokens.spring.snappy}
          className="block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

type Flight = { id: string; src: string; from: { x: number; y: number; size: number } }

/** A picked avatar flies from the recent row to its chip on its own layer, above the chips row that scrolls and clips. */
function AvatarFlight({ flight, layer, onDone }: { flight: Flight; layer: HTMLElement | null; onDone: () => void }) {
  const { motionTokens } = useShareMotion()
  const ref = useRef<HTMLImageElement>(null)
  useLayoutEffect(() => {
    const node = ref.current
    const target = layer?.querySelector<HTMLElement>(`[data-chip-avatar="${CSS.escape(flight.id)}"]`)
    if (!node || !layer || !target) {
      onDone()
      return
    }
    const row = target.closest<HTMLElement>("[data-chips]")
    if (row) row.scrollLeft = row.scrollWidth
    const base = layer.getBoundingClientRect()
    const rect = target.getBoundingClientRect()
    const to = { x: rect.left - base.left, y: rect.top - base.top, size: rect.width }
    const controls = animate(
      node,
      {
        x: [flight.from.x, to.x],
        y: [flight.from.y, to.y],
        width: [flight.from.size, to.size],
        height: [flight.from.size, to.size],
      },
      { ...motionTokens.spring.morph, onComplete: onDone },
    )
    return () => controls.stop()
  }, [flight, layer, onDone, motionTokens])
  return (
    <img
      ref={ref}
      src={flight.src}
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-10 rounded-full object-cover shadow-raised"
      style={{ width: flight.from.size, height: flight.from.size, transform: `translate(${flight.from.x}px, ${flight.from.y}px)` }}
    />
  )
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? ""
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

export function ShareSheet({
  title,
  link,
  people,
  access,
  channels = [],
  defaultAccess,
  onSend,
  onChannel,
  onCopy,
  onUndo,
  label = "Share",
  align = "end",
  sheetOnPhones = true,
  className,
}: ShareSheetProps) {
  const { motionTokens, enter, standard, blur, GROW, FOLD, RESIZE, faceVariants } = useShareMotion()
  const reduced = useReducedFlag()
  const phone = usePhone()
  const sheet = sheetOnPhones && phone
  const uid = useId()
  const titleId = `${uid}-title`
  const listId = `${uid}-access`
  const sentId = `${uid}-sent`

  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const [face, setFace] = useState<Face>("trigger")
  const [accessValue, setAccessValue] = useState(defaultAccess ?? access[0]?.value ?? "")
  const [listOpen, setListOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [sentTo, setSentTo] = useState<SharePerson[]>([])
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const [channelState, setChannelState] = useState<Record<string, ChannelState>>({})
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const [flight, setFlight] = useState<Flight | null>(null)
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const shakeRow = useAnimationControls()

  const current = useRef<Face>("trigger")
  const focusNext = useRef<string | null>(null)
  const run = useRef(0)

  const width = useMotionValue<number | string>("100%")
  const height = useMotionValue<number | string>("100%")
  /* The corner rides the size spring but is clamped to its end values, so it reaches the panel radius early and never overshoots. */
  const rawRadius = useMotionValue(CONTROL_RADIUS)
  const radiusRange = useRef<[number, number]>([CONTROL_RADIUS, CONTROL_RADIUS])
  const radius = useTransform(rawRadius, value => Math.min(Math.max(value, radiusRange.current[0]), radiusRange.current[1]))
  const target = useRef<{ w: number; h: number; id: Face } | null>(null)
  const resize = useCallback(
    (id: Face, w: number, h: number) => {
      const previous = target.current
      if (previous && previous.id === id && Math.abs(previous.w - w) < 0.5 && Math.abs(previous.h - h) < 0.5) return
      target.current = { w, h, id }
      const r = RADIUS[id]
      const from = rawRadius.get()
      radiusRange.current = [Math.min(from, r), Math.max(from, r)]
      if (!previous || reduced) {
        width.jump(w)
        height.jump(h)
        rawRadius.jump(r)
        return
      }
      const surface = surfaceRef.current
      if (typeof width.get() === "string" && surface) {
        width.jump(surface.offsetWidth)
        height.jump(surface.offsetHeight)
      }
      // Opening from the button bounces a little; every fold, and growth inside the panel, settles without overshoot.
      const spring = previous.id === "trigger" && id !== "trigger" ? GROW : id === previous.id && w * h > previous.w * previous.h ? RESIZE : FOLD
      animate(width, w, spring)
      animate(height, h, spring)
      animate(rawRadius, r, spring)
    },
    [height, rawRadius, reduced, width, GROW, FOLD, RESIZE],
  )
  /* Only the current face sizes the shape; in sheet mode the trigger stays in the shape whatever the face, so it sizes it directly. */
  const onSize = useCallback(
    (id: Face, w: number, h: number) => {
      if (id === current.current) resize(id, w, h)
    },
    [resize],
  )

  const go = useCallback((next: Face, focus: string | null) => {
    if (next === current.current) return
    current.current = next
    focusNext.current = focus
    setFace(next)
  }, [])

  // Opening moves focus to Copy, sending moves it to Done, closing returns it to the Share button.
  useEffect(() => {
    const selector = focusNext.current
    focusNext.current = null
    if (!selector) return
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-share="${CSS.escape(uid)}"] ${selector}`)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [face, uid])

  const reset = () => {
    run.current++
    setListOpen(false)
    setSending(false)
    setFailed(false)
    setFlight(null)
  }
  const open = () => {
    reset()
    go("panel", "[data-copy]")
  }
  const close = useCallback(
    (focusTrigger: boolean) => {
      run.current++
      setListOpen(false)
      setSending(false)
      setFailed(false)
      setFlight(null)
      go("trigger", focusTrigger ? "[data-trigger]" : null)
    },
    [go],
  )

  // A press outside the component closes it without stealing focus.
  useEffect(() => {
    if (face === "trigger") return
    const onDown = (event: PointerEvent) => {
      const node = event.target as Node
      if (rootRef.current?.contains(node) || sheetRef.current?.contains(node)) return
      close(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [close, face])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || face === "trigger") return
    event.preventDefault()
    event.stopPropagation()
    if (listOpen) {
      setListOpen(false)
      document.querySelector<HTMLElement>(`[data-share="${CSS.escape(uid)}"] [data-access-trigger]`)?.focus()
      return
    }
    close(true)
  }

  const selectedAccess = access.find(option => option.value === accessValue) ?? access[0]
  const pickedPeople = picked.map(id => people.find(person => person.id === id)).filter((person): person is SharePerson => !!person)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopyState("copied")
      setAnnouncement("Link copied")
      onCopy?.(accessValue)
    } catch {
      setCopyState("failed")
      setAnnouncement("Couldn’t copy the link")
    }
  }
  useEffect(() => {
    if (copyState !== "copied") return
    const timer = window.setTimeout(() => setCopyState("idle"), 1900)
    return () => window.clearTimeout(timer)
  }, [copyState])

  const chooseAccess = (value: string) => {
    setAccessValue(value)
    setListOpen(false)
    const option = access.find(item => item.value === value)
    if (option) setAnnouncement(`Access: ${option.label}`)
    document.querySelector<HTMLElement>(`[data-share="${CSS.escape(uid)}"] [data-access-trigger]`)?.focus()
  }
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'))
    const index = options.indexOf(document.activeElement as HTMLElement)
    const last = options.length - 1
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowDown" || event.key === "ArrowRight"
            ? index >= last
              ? 0
              : index + 1
            : index <= 0
              ? last
              : index - 1
    options[next]?.focus()
  }
  const [focusedOption, setFocusedOption] = useState<string | null>(null)
  // The chosen option takes focus when the list opens, so arrows start from it.
  useEffect(() => {
    if (!listOpen) return
    document.querySelector<HTMLElement>(`#${CSS.escape(listId)} [aria-selected="true"]`)?.focus()
  }, [listOpen, listId])

  const runChannel = async (channel: ShareChannel) => {
    if (channelState[channel.id] === "pending") return
    const set = (state: ChannelState) => setChannelState(all => ({ ...all, [channel.id]: state }))
    try {
      const result = onChannel?.(channel.id)
      if (result && typeof (result as Promise<unknown>).then === "function") {
        set("pending")
        await result
      }
      set("done")
      setAnnouncement(`${channel.label}: ${channel.doneLabel}`)
    } catch {
      set("failed")
      setAnnouncement(`${channel.label}: failed`)
    }
  }

  const togglePerson = (person: SharePerson, source: HTMLElement | null) => {
    if (picked.includes(person.id)) {
      setPicked(all => all.filter(id => id !== person.id))
      setAnnouncement(`Removed ${person.name}`)
      return
    }
    setPicked(all => [...all, person.id])
    setAnnouncement(`Added ${person.name}`)
    setFailed(false)
    const img = source?.querySelector("img")
    if (reduced || !img || !layer) return
    const base = layer.getBoundingClientRect()
    const rect = img.getBoundingClientRect()
    setFlight({ id: person.id, src: person.avatar, from: { x: rect.left - base.left, y: rect.top - base.top, size: rect.width } })
  }
  const removePerson = (person: SharePerson) => {
    setPicked(all => all.filter(id => id !== person.id))
    setAnnouncement(`Removed ${person.name}`)
    if (flight?.id === person.id) setFlight(null)
  }
  const endFlight = useCallback(() => setFlight(null), [])

  const send = async () => {
    if (sending) return
    if (!pickedPeople.length) {
      setAnnouncement("Pick someone to send to")
      if (!reduced) void shakeRow.start({ x: [0, -8, 7, -5, 3, 0], transition: { duration: 0.4, ease: standard } })
      return
    }
    const token = ++run.current
    setFailed(false)
    try {
      const result = onSend?.({ people: pickedPeople, access: accessValue })
      if (result && typeof (result as Promise<unknown>).then === "function") {
        setSending(true)
        await result
      }
    } catch {
      if (token !== run.current) return
      setSending(false)
      setFailed(true)
      setAnnouncement("Couldn’t send. Try again.")
      return
    }
    if (token !== run.current) return
    setSending(false)
    setSentTo(pickedPeople)
    setPicked([])
    setAnnouncement(`Sent to ${joinNames(pickedPeople.map(person => person.name))}`)
    go("sent", "[data-done]")
  }

  const undo = () => {
    if (!sentTo.length) return
    onUndo?.({ people: sentTo, access: accessValue })
    setPicked(sentTo.map(person => person.id))
    setAnnouncement(`Undone. ${joinNames(sentTo.map(person => person.name))} picked again`)
    go("panel", "[data-send]")
  }

  const copyLabels = [
    { key: "idle", text: "Copy", icon: <Copy /> },
    { key: "copied", text: "Copied", icon: <Check /> },
    { key: "failed", text: "Retry", icon: <RotateCcw /> },
  ] as const
  const panelBody = (
    <div ref={setLayer} className="relative flex flex-col gap-3 p-2">
      <div className="flex h-9 items-center gap-2 pl-2">
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-base leading-body font-medium">
          Share “{title}”
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => close(true)}
          className="grid size-8 flex-none cursor-pointer place-items-center rounded-full text-text-secondary outline-none transition-[background-color,color] duration-160 ease-standard pointer-fine:hover:bg-foreground/[0.065] pointer-fine:hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Link and access share one card; the access list opens inside it and the surface grows to fit. */}
      <div className="flex flex-col rounded-[20px] bg-surface-muted/70 ring-1 ring-border-subtle ring-inset">
        <div className="flex h-12 items-center gap-2.5 pr-1.5 pl-3.5">
          <Link2 className="size-4 flex-none text-text-secondary" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm leading-body text-text-secondary" title={link}>
            {link.replace(/^https?:\/\//, "")}
          </span>
          <button
            type="button"
            data-copy=""
            aria-label="Copy link"
            onClick={() => void copy()}
            className={cn(
              "grid h-[34px] flex-none cursor-pointer rounded-full bg-surface-raised px-3 text-sm leading-body font-medium text-foreground shadow-resting ring-1 ring-border outline-none",
              "transition-[background-color] duration-160 ease-standard pointer-fine:hover:bg-surface-muted",
              copyState === "failed" && "text-danger",
            )}
          >
            {/* All labels share one grid cell, so the pill keeps the width of the widest and only the visible one changes. */}
            {copyLabels.map(item => {
              const on = item.key === copyState
              return (
                <motion.span
                  key={item.key}
                  aria-hidden={!on || undefined}
                  className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 [&_svg]:size-3.5"
                  initial={false}
                  animate={
                    reduced
                      ? { opacity: on ? 1 : 0 }
                      : { opacity: on ? 1 : 0, y: on ? 0 : -3, filter: on ? "blur(0px)" : `blur(${blur.subtle}px)` }
                  }
                  transition={{ duration: motionTokens.duration.fast, ease: enter }}
                >
                  {item.icon}
                  {item.text}
                </motion.span>
              )
            })}
          </button>
        </div>

        {selectedAccess && (
          <>
            <button
              type="button"
              data-access-trigger=""
              aria-expanded={listOpen}
              aria-controls={listOpen ? listId : undefined}
              onClick={() => setListOpen(value => !value)}
              onKeyDown={event => {
                if (event.key === "ArrowDown" && !listOpen) {
                  event.preventDefault()
                  setListOpen(true)
                }
              }}
              className="flex h-[52px] cursor-pointer items-center gap-2.5 border-t border-border-subtle px-3.5 py-1.5 text-left outline-none"
            >
              <span className="grid size-4 flex-none place-items-center text-text-secondary [&_svg]:size-4" aria-hidden="true">
                {selectedAccess.icon}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-sm leading-body font-medium text-foreground">{selectedAccess.label}</span>
                <span className="truncate text-xs leading-body text-text-secondary">{selectedAccess.description}</span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 flex-none text-text-secondary transition-transform duration-200 ease-standard motion-reduce:transition-none",
                  listOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {listOpen && (
              <div id={listId} role="listbox" aria-label="Link access" className="flex flex-col px-1.5 pt-1 pb-1.5" onKeyDown={onListKeyDown}>
                {access.map((option, index) => {
                  const selected = option.value === accessValue
                  const tabbable = focusedOption ? focusedOption === option.value : selected
                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      tabIndex={tabbable ? 0 : -1}
                      onFocus={() => setFocusedOption(option.value)}
                      onBlur={() => setFocusedOption(null)}
                      onClick={() => chooseAccess(option.value)}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, filter: `blur(${blur.subtle}px)` }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{
                        duration: motionTokens.duration.standard,
                        ease: enter,
                        delay: reduced ? 0 : 0.04 + index * motionTokens.stagger.item,
                      }}
                      className="flex cursor-pointer items-center gap-2.5 rounded-[14px] px-2 py-2 text-left outline-none focus-visible:bg-foreground/[0.065] pointer-fine:hover:bg-foreground/[0.065]"
                    >
                      <span className="grid size-4 flex-none place-items-center text-text-secondary [&_svg]:size-4" aria-hidden="true">
                        {option.icon}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="truncate text-sm leading-body font-medium text-foreground">{option.label}</span>
                        <span className="truncate text-xs leading-body text-text-secondary">{option.description}</span>
                      </span>
                      {selected && <Check className="size-4 flex-none text-foreground" aria-hidden="true" />}
                    </motion.button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {channels.length > 0 && (
        <div role="group" aria-label="Share to" className="flex gap-1.5">
          {channels.map(channel => {
            const state = channelState[channel.id] ?? "idle"
            const text = state === "done" ? channel.doneLabel : state === "failed" ? "Failed" : channel.label
            return (
              <button
                key={channel.id}
                type="button"
                aria-busy={state === "pending" || undefined}
                onClick={() => void runChannel(channel)}
                className={cn(
                  "inline-flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-2 text-sm leading-body font-medium text-foreground ring-1 ring-border outline-none ring-inset",
                  "transition-[background-color,color,box-shadow] duration-160 ease-standard pointer-fine:hover:bg-foreground/[0.065]",
                  state === "failed" && "text-danger ring-danger",
                  state === "done" && "text-success",
                )}
              >
                <span className="grid size-4 flex-none place-items-center [&_svg]:size-4" aria-hidden="true">
                  {state === "pending" ? <Spinner /> : state === "done" ? <Check /> : channel.icon}
                </span>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={text}
                    className="truncate"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: `blur(${blur.subtle}px)` }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -3, filter: `blur(${blur.subtle}px)` }}
                    transition={{ duration: motionTokens.duration.fast, ease: enter }}
                  >
                    {text}
                  </motion.span>
                </AnimatePresence>
              </button>
            )
          })}
        </div>
      )}

      <div className="mx-1.5 h-px flex-none bg-border-subtle" aria-hidden="true" />

      {/* Send to */}
      <motion.div animate={shakeRow} className="flex flex-col gap-1.5">
        <span className="pl-2 text-xs leading-body text-text-muted">Send to</span>
        <div data-chips="" className="flex h-9 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pickedPeople.length === 0 && <span className="pl-2 text-sm leading-body text-text-muted">Pick people below</span>}
          <ul className="flex items-center gap-1.5" aria-label="Recipients">
            <AnimatePresence initial={false}>
              {pickedPeople.map(person => (
                <motion.li
                  key={person.id}
                  className="inline-flex h-8 flex-none items-center gap-1.5 overflow-hidden rounded-full bg-surface pr-1 pl-1 ring-1 ring-border ring-inset"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
                  transition={reduced ? { duration: motionTokens.duration.fast } : motionTokens.spring.smooth}
                >
                  <img
                    data-chip-avatar={person.id}
                    src={person.avatar}
                    alt=""
                    className={cn("size-6 flex-none rounded-full object-cover", flight?.id === person.id && "opacity-0")}
                  />
                  <span className="text-sm leading-body whitespace-nowrap">{person.name.split(" ")[0]}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${person.name}`}
                    onClick={() => removePerson(person)}
                    className="grid size-6 flex-none cursor-pointer place-items-center rounded-full text-text-muted outline-none pointer-fine:hover:bg-foreground/[0.065] pointer-fine:hover:text-foreground"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </motion.div>

      {people.length > 0 && (
        <div
          role="group"
          aria-label="Recent people"
          className="grid auto-cols-[minmax(4rem,1fr)] grid-flow-col gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {people.map(person => {
            const on = picked.includes(person.id)
            return (
              <button
                key={person.id}
                type="button"
                aria-pressed={on}
                aria-label={person.name}
                onClick={event => togglePerson(person, event.currentTarget)}
                className="flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-[18px] px-0.5 pt-2 pb-1.5 outline-none transition-[background-color] duration-160 ease-standard pointer-fine:hover:bg-foreground/[0.065]"
              >
                <span className="relative">
                  <img src={person.avatar} alt="" className="size-10 rounded-full object-cover" />
                  <motion.span
                    className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full border-2 border-surface-raised bg-accent text-accent-foreground"
                    initial={false}
                    animate={reduced ? { opacity: on ? 1 : 0 } : { opacity: on ? 1 : 0, scale: on ? 1 : 0.4 }}
                    transition={reduced ? { duration: motionTokens.duration.fast } : motionTokens.spring.snappy}
                    aria-hidden="true"
                  >
                    <Check className="size-2" strokeWidth={3.5} />
                  </motion.span>
                </span>
                <span className="w-full truncate px-1 text-center text-xs leading-body text-text-secondary">{person.name.split(" ")[0]}</span>
              </button>
            )
          })}
        </div>
      )}

      {failed && <span className="-mb-1 pl-2 text-xs leading-body text-danger">Couldn’t send. Try again.</span>}
      <Button
        data-send=""
        loading={sending}
        onClick={() => void send()}
        aria-label={pickedPeople.length ? `Send to ${pickedPeople.length} ${pickedPeople.length === 1 ? "person" : "people"}` : "Send"}
        className={cn(
          "min-h-11 w-full rounded-full border-transparent [&_.animate-spin]:motion-reduce:animate-[spin_1.6s_linear_infinite]",
          pickedPeople.length
            ? "bg-foreground text-background"
            : "bg-foreground/8 text-text-muted pointer-fine:hover:not-disabled:shadow-none",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          Send
          {pickedPeople.length > 0 && <RollingCount value={pickedPeople.length} reduced={reduced} />}
        </span>
      </Button>

      {flight && <AvatarFlight flight={flight} layer={layer} onDone={endFlight} />}
    </div>
  )

  const lead = sentTo[0]
  const sentBody = (
    <div role="status" className="flex flex-col items-center px-4 pt-5 pb-3.5 text-center">
      <motion.span
        className="relative block rounded-full border-[3px] border-surface-raised"
        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ scale: GROW, opacity: { duration: 0.14 } }}
        aria-hidden="true"
      >
        {lead ? (
          <img src={lead.avatar} alt="" className="size-11 rounded-full object-cover" />
        ) : (
          <span className="block size-11 rounded-full bg-surface-muted" />
        )}
        <motion.span
          className="absolute -right-1.5 -bottom-1.5 grid size-[28px] place-items-center rounded-full border-[3px] border-surface-raised bg-success text-background"
          initial={reduced ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ scale: { ...motionTokens.spring.snappy, delay: 0.12 }, opacity: { duration: 0.12, delay: 0.12 } }}
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none">
            <motion.path
              d="M5.5 12.5 10 17 18.5 7.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: enter, delay: 0.2 }}
            />
          </svg>
        </motion.span>
      </motion.span>
      <h2 id={sentId} className="mt-3 max-w-full truncate text-base leading-body font-medium">
        Sent to {sentTo.length === 1 ? lead?.name : joinNames(sentTo.map(person => person.name.split(" ")[0]))}
      </h2>
      <p className="mt-0.5 max-w-full truncate text-xs leading-body text-text-secondary">
        {selectedAccess ? `${selectedAccess.label} – ${selectedAccess.description.toLowerCase()}` : `They can open “${title}” now.`}
      </p>
      <div className="mt-4 flex w-full gap-2">
        <Button variant="secondary" className="min-h-10 flex-1 rounded-full" onClick={undo}>
          Undo
        </Button>
        <Button data-done="" className="min-h-10 flex-1 rounded-full" onClick={() => close(true)}>
          Done
        </Button>
      </div>
    </div>
  )

  const panelWidth = "w-[var(--share-sheet-width,min(24rem,calc(100vw-2rem)))]"
  const sentWidth = "w-[min(19rem,calc(100vw-2rem))]"
  const opened = face !== "trigger"
  const showTrigger = sheet || face === "trigger"
  const triggerClass = "inline-flex h-9 items-center gap-1.5 px-4 text-sm leading-body font-medium whitespace-nowrap"

  return (
    <div ref={rootRef} className={cn("relative inline-flex align-top", className)}>
      {/* The root reserves only the button's size; the panel floats over the page. */}
      <span className={cn(triggerClass, "invisible")} aria-hidden="true">
        <Share className="size-4" />
        {label}
      </span>
      <motion.div
        ref={surfaceRef}
        data-share={uid}
        className={cn(
          "absolute top-0 z-20 overflow-hidden",
          "transition-[background-color,color,box-shadow] duration-200 ease-standard motion-reduce:transition-none",
          opened && !sheet ? "bg-surface-raised text-foreground shadow-floating" : "bg-foreground text-background",
          align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
        )}
        style={{ width, height, borderRadius: radius }}
        onKeyDown={onKeyDown}
      >
        <AnimatePresence initial={false}>
          {showTrigger && (
            <FaceLayer key="trigger" id="trigger" reduced={reduced} align={align} onSize={sheet ? resize : onSize}>
              <button
                type="button"
                data-trigger=""
                aria-haspopup="dialog"
                aria-expanded={opened}
                onClick={() => (opened ? close(true) : open())}
                className={cn(
                  triggerClass,
                  "cursor-pointer touch-manipulation outline-none transition-opacity duration-160 ease-standard pointer-fine:hover:opacity-90 [-webkit-tap-highlight-color:transparent]",
                )}
              >
                <Share className="size-4" aria-hidden="true" />
                {label}
              </button>
            </FaceLayer>
          )}
          {!sheet && face === "panel" && (
            <FaceLayer key="panel" id="panel" role="dialog" labelledBy={titleId} reduced={reduced} align={align} onSize={onSize} className={panelWidth}>
              {panelBody}
            </FaceLayer>
          )}
          {!sheet && face === "sent" && (
            <FaceLayer key="sent" id="sent" role="dialog" labelledBy={sentId} reduced={reduced} align={align} onSize={onSize} className={sentWidth}>
              {sentBody}
            </FaceLayer>
          )}
        </AnimatePresence>
      </motion.div>
      {sheet && (
        <PhoneSheet
          open={opened}
          uid={uid}
          sheetRef={sheetRef}
          reduced={reduced}
          labelledBy={face === "sent" ? sentId : titleId}
          onClose={() => close(true)}
          onKeyDown={onKeyDown}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={face}
              data-face={face}
              variants={reduced ? fadeVariants : faceVariants}
              initial="hidden"
              animate="shown"
              exit="gone"
            >
              {face === "sent" ? sentBody : panelBody}
            </motion.div>
          </AnimatePresence>
        </PhoneSheet>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}

/** Up to 520px the panel opens as a bottom sheet over a dimmed backdrop, with a grabber that drags it down to close. */
function PhoneSheet({
  open,
  uid,
  sheetRef,
  reduced,
  labelledBy,
  onClose,
  onKeyDown,
  children,
}: {
  open: boolean
  uid: string
  sheetRef: RefObject<HTMLDivElement | null>
  reduced: boolean
  labelledBy: string
  onClose: () => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  children: ReactNode
}) {
  const { motionTokens, standard } = useShareMotion()
  const drag = useDragControls()
  if (typeof document === "undefined") return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-[oklch(10%_0_0/.38)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionTokens.duration.standard, ease: standard }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="sheet"
            ref={sheetRef}
            data-share={uid}
            role="dialog"
            aria-labelledby={labelledBy}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-b-0 border-border bg-surface-raised pb-[env(safe-area-inset-bottom)] text-foreground shadow-floating"
            initial={reduced ? { opacity: 0 } : { y: "100%" }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: "100%" }}
            transition={reduced ? { duration: motionTokens.duration.fast } : motionTokens.spring.smooth}
            drag={reduced ? false : "y"}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose()
            }}
            onKeyDown={onKeyDown}
          >
            <div
              className="flex h-6 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
              onPointerDown={event => drag.start(event)}
              aria-hidden="true"
            >
              <span className="h-1 w-9 rounded-full bg-border-strong" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default ShareSheet
