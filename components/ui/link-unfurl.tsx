"use client"

/* eslint-disable @next/next/no-img-element -- favicons and preview images come from the caller's unfurl data as plain URLs. */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties, ClipboardEvent, FormEvent, KeyboardEvent, PointerEvent } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, animate, motion } from "motion/react"
import type { AnimationPlaybackControls, Transition } from "motion/react"
import { ArrowUpIcon, CaretUpIcon, CheckIcon, GlobeIcon, LinkIcon, XIcon } from "@phosphor-icons/react"

import { motionTokens as presets } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface LinkUnfurlPreview {
  url: string
  site: string
  title: string
  description?: string
  /** Open Graph image, shown at 1.91 : 1. */
  image?: string
  /** Square favicon, aligned with the one in the inline link. */
  favicon?: string
}
export interface LinkUnfurlMessage {
  /** The message with links written out as addresses. */
  text: string
  previews: LinkUnfurlPreview[]
}
export interface LinkUnfurlProps {
  label?: string
  placeholder?: string
  defaultValue?: string
  samples?: LinkUnfurlPreview[]
  resolve?: (url: string, signal: AbortSignal) => Promise<LinkUnfurlPreview | null>
  autoExpand?: boolean
  autoPlay?: boolean
  speed?: number
  paused?: boolean
  accent?: string
  sendLabel?: string
  onSend?: (message: LinkUnfurlMessage) => void | Promise<unknown>
  className?: string
  style?: CSSProperties
}

type Status = "loading" | "ready" | "failed"
type Link = {
  id: string
  url: string
  node: HTMLElement
  status: Status
  preview: LinkUnfurlPreview | null
  open: boolean
  /** Taken out of the message; its card folds away before it leaves. */
  removed?: boolean
}
type Part = "slot" | "card" | "plate" | "body" | "img" | "fav"
/**
 * One card's spring and the nodes the loop writes to. Progress runs from 0 (folded into its link) to 1 (open).
 * `foldAt` is when the last fold started, for the card's late fade once it sits on its link.
 */
type Ctrl = { p: number; v: number; target: number; drag: boolean; foldAt: number; removed: boolean } & Partial<Record<Part, HTMLElement | null>>

type Bezier = [number, number, number, number]
const enter = [...presets.ease.enter] as Bezier
const standard = [...presets.ease.standard] as Bezier
/** Space below each card in the lane. */
const GAP = 10
const CARD_RADIUS = 18
/** The card unrolls on one progress spring of about 10 rad/s, just past critical damping, and folds back on a stiffer, overdamped one. */
const UNROLL = { stiffness: 100, damping: 22 }
const FOLD = { stiffness: 960, damping: 68 }
/** A removed card holds a beat, then closes on a critically damped spring of about 14 rad/s. */
const LEAVE = { stiffness: 196, damping: 28 }
const LEAVE_HOLD = 0.04
/** The link's own width follows its new label on a far stiffer critically damped spring (about 50 rad/s). */
const CHIP_WIDTH: Transition = { type: "spring", stiffness: 2500, damping: 100, mass: 1 }
/** After a fold the card, now sitting on its link, fades out over this window (seconds after the fold starts). */
const FADE_FROM = 0.115
const FADE_FOR = 0.785
/** The send button's check settles with a hint of overshoot. */
const SEND_POP: Transition = { type: "spring", visualDuration: 0.3, bounce: 0.08 }
/** Matches http(s) and www addresses; trailing punctuation is trimmed off afterwards. */
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/g
const TRAILING = /[.,!?;:)\]}'"]+$/

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const display = (url: string) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "")
const hrefOf = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`)
const same = (a: string, b: string) => display(a).toLowerCase() === display(b).toLowerCase()

const subscribe = () => () => {}
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  return !!useReducedMotion() && hydrated
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    })
  })
}
/** Preview images are decoded before the card opens, so the morph never reveals an empty frame. */
function decode(src?: string) {
  if (!src) return Promise.resolve()
  const image = new Image()
  image.src = src
  return image.decode().catch(() => undefined)
}
/** A link with no known preview still gets a small card: the site, and the last part of the path as a title. */
function plainPreview(url: string): LinkUnfurlPreview {
  const address = display(url)
  let site = address.split("/")[0]
  try {
    site = new URL(hrefOf(url)).hostname.replace(/^www\./, "")
  } catch {}
  const last = decodeURIComponent(address.split(/[?#]/)[0].split("/").filter(Boolean).slice(1).pop() ?? "").replace(/[-_]+/g, " ").trim()
  const title = last ? last.charAt(0).toUpperCase() + last.slice(1) : site
  return { url, site, title, description: address }
}

/* The chip wrapper is created outside React (it lives in the contenteditable); React renders its face through a portal. */
const CHIP_CLASS = "inline-block max-w-full align-top select-none [-webkit-user-modify:read-only]"

/**
 * The inline link: a pulsing globe and a sweep while loading. Once resolved the favicon pops in, the title rolls up, and the link's width
 * follows on a stiff spring.
 */
function ChipFace({ link, still, onActivate }: { link: Link; still: boolean; onActivate: (id: string) => void }) {
  const { blur, duration } = useMotionTokens()
  const { status, preview, open } = link
  const loading = status === "loading"
  const ready = status === "ready" && !!preview
  const text = ready ? preview.title : display(link.url)
  const name = loading
    ? `${display(link.url)}, loading preview`
    : status === "failed"
      ? `${display(link.url)}, no preview, activate to try again`
      : `${text}, ${preview?.site ?? display(link.url)} link`
  const faceRef = useRef<HTMLSpanElement>(null)
  const width = useRef(0)
  const morph = useRef<AnimationPlaybackControls | null>(null)

  // The face measures its natural width after each label change and springs there from where it was.
  useLayoutEffect(() => {
    const face = faceRef.current
    if (!face) return
    const running = morph.current && morph.current.state === "running"
    const from = running ? face.getBoundingClientRect().width : width.current
    morph.current?.stop()
    face.style.width = ""
    const to = face.getBoundingClientRect().width
    width.current = to
    if (still || !from || Math.abs(from - to) < 0.5) return
    face.style.width = `${from}px`
    const controls = animate(face, { width: [from, to] }, CHIP_WIDTH)
    morph.current = controls
    controls.then(() => {
      if (morph.current === controls) face.style.width = ""
    })
  }, [text, status, still])
  useEffect(() => () => morph.current?.stop(), [])
  // The wrapper lives outside React, so its status attribute is written from its portal.
  useLayoutEffect(() => {
    faceRef.current?.parentElement?.setAttribute("data-status", status)
  }, [status])

  return (
    <span
      ref={faceRef}
      role="button"
      tabIndex={-1}
      aria-label={name}
      title={status === "failed" ? "No preview. Click to try again" : (preview?.title ?? link.url)}
      data-chip-face=""
      onMouseDown={event => event.preventDefault()}
      onClick={() => onActivate(link.id)}
      className={cn(
        "relative isolate inline-flex h-[26px] max-w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-full pr-2.5 pl-[5px] align-top text-sm leading-[14px] whitespace-nowrap",
        "transition-[background-color,color,box-shadow] duration-200 ease-standard motion-reduce:transition-none",
        ready && open
          ? "bg-[color-mix(in_oklab,var(--lu-accent)_11%,transparent)] text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--lu-accent)_34%,transparent)] dark:bg-[color-mix(in_oklab,var(--lu-accent)_20%,transparent)] dark:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--lu-accent)_48%,transparent)]"
          : ready
            ? "bg-surface-muted text-foreground shadow-[inset_0_0_0_1px_var(--border-subtle)] pointer-fine:hover:bg-foreground/[0.06]"
            : status === "failed"
              ? "bg-surface-muted text-text-secondary underline decoration-dotted underline-offset-2 shadow-[inset_0_0_0_1px_var(--border-subtle)]"
              : "bg-surface-muted text-text-secondary shadow-[inset_0_0_0_1px_var(--border-subtle)]",
      )}
    >
      {loading && !still && (
        <motion.span
          className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-[135px] bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--foreground)_9%,transparent),transparent)]"
          initial={{ x: -135 }}
          animate={{ x: [-135, 258] }}
          transition={{ duration: 1.2, ease: [...presets.ease.inOut] as Bezier, repeat: Infinity }}
          aria-hidden="true"
        />
      )}
      <span data-icon="" className="relative grid size-4 flex-none place-items-center" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          {ready && preview.favicon ? (
            <motion.img
              key="favicon"
              src={preview.favicon}
              alt=""
              className="size-4 rounded-[4px] object-cover"
              initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={still ? { duration: duration.fast } : { scale: CHIP_WIDTH, opacity: { duration: 0.15, ease: enter } }}
            />
          ) : (
            <motion.span
              key={ready ? "link" : "globe"}
              className="grid size-4 place-items-center text-text-muted"
              initial={{ opacity: 0 }}
              animate={loading && !still ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: duration.instant } }}
              transition={loading && !still ? { duration: 1.2, ease: "easeInOut", repeat: Infinity } : { duration: duration.fast }}
            >
              {ready ? <LinkIcon className="size-3.5" /> : <GlobeIcon className="size-3.5" />}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="relative block max-w-[16em] min-w-0">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={text}
            className="block truncate"
            initial={still ? { opacity: 0 } : { opacity: 0, y: 5, filter: `blur(${blur.subtle}px)` }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.06 } }}
            transition={{ duration: 0.2, ease: enter }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  )
}

/** The rich card. It sits laid out at its open place in the lane; the loop clips and translates it onto its link. */
function PreviewCard({
  link,
  bind,
  onCollapse,
  onRemove,
  onHeadDown,
}: {
  link: Link
  bind: (part: Part) => (node: HTMLElement | null) => void
  onCollapse: () => void
  onRemove: () => void
  onHeadDown: (event: PointerEvent<HTMLDivElement>) => void
}) {
  const preview = link.preview!
  const folded = !link.open || !!link.removed
  const iconButton =
    "grid size-[30px] flex-none cursor-pointer place-items-center rounded-full text-text-muted outline-none transition-[background-color,color] duration-160 ease-standard focus-visible:bg-foreground/[0.06] pointer-fine:hover:bg-foreground/[0.06] pointer-fine:hover:text-foreground"
  return (
    <div ref={bind("slot")} className="relative h-0" data-card-slot="">
      <div
        ref={bind("plate")}
        className="pointer-events-none invisible absolute top-0 left-0 rounded-[18px] bg-surface-raised shadow-[inset_0_0_0_1px_var(--border)]"
        aria-hidden="true"
      />
      <article
        ref={bind("card")}
        inert={folded || undefined}
        aria-hidden={folded || undefined}
        aria-label={`${preview.site}: ${preview.title}`}
        className="invisible absolute top-0 left-0 w-full max-w-[440px] p-2 will-change-[transform,clip-path]"
      >
        <div
          onPointerDown={onHeadDown}
          className="flex h-[30px] cursor-grab touch-none items-center gap-2 pl-[7px] select-none active:cursor-grabbing"
        >
          {preview.favicon ? (
            <img ref={bind("fav")} src={preview.favicon} alt="" className="size-4 flex-none rounded-[4px] object-cover" draggable={false} />
          ) : (
            <span ref={bind("fav")} className="grid size-4 flex-none place-items-center text-text-muted" aria-hidden="true">
              <LinkIcon className="size-3.5" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs leading-[1.4] text-text-secondary">{preview.site}</span>
          <button type="button" aria-label={`Collapse preview of ${preview.title}`} onClick={onCollapse} className={iconButton}>
            <CaretUpIcon className="size-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label={`Remove link to ${preview.title}`} onClick={onRemove} className={iconButton}>
            <XIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div ref={bind("body")} className="grid gap-0.5 px-1.5 pt-0.5 opacity-0">
          <a
            href={hrefOf(preview.url)}
            target="_blank"
            rel="noreferrer"
            draggable={false}
            className="min-w-0 truncate rounded-[6px] text-base leading-[1.4] font-medium text-foreground outline-none focus-visible:bg-foreground/[0.06] pointer-fine:hover:underline"
          >
            {preview.title}
          </a>
          {preview.description && <p className="line-clamp-2 text-sm leading-[1.4] text-text-secondary">{preview.description}</p>}
          {preview.image && (
            <div className="relative mt-2 aspect-[1.91] overflow-hidden rounded-[10px] bg-surface-muted after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--border-subtle)]">
              <img ref={bind("img")} src={preview.image} alt="" className="size-full object-cover" draggable={false} />
            </div>
          )}
        </div>
      </article>
    </div>
  )
}

/**
 * A message composer that unfurls links. A pasted address becomes an inline link with a soft loading sweep; once the preview resolves,
 * the favicon and title roll in and the link unrolls into a rich card in one continuous morph. Click the link, press collapse, or drag the
 * card up to fold it back into the text; remove it to take the link out of the message.
 */
export function LinkUnfurl({
  label = "Message #kyoto-offsite",
  placeholder = "Message #kyoto-offsite",
  defaultValue = "Found a place for the offsite, take a look",
  samples = [],
  resolve,
  autoExpand = true,
  autoPlay = true,
  speed = 1,
  paused = false,
  accent,
  sendLabel = "Send message",
  onSend,
  className,
  style,
}: LinkUnfurlProps) {
  const { duration } = useMotionTokens()
  const reduced = useReducedFlag()
  const still = reduced || paused
  const uid = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const [links, setLinks] = useState<Link[]>([])
  const linksRef = useRef<Link[]>([])
  const [empty, setEmpty] = useState(true)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const seq = useRef(0)
  const aborts = useRef(new Map<string, AbortController>())
  const interacted = useRef(false)

  // Latest props and flags for callbacks that outlive a render.
  const live = useRef({ resolve, samples, speed, still, autoExpand })
  useLayoutEffect(() => {
    live.current = { resolve, samples, speed, still, autoExpand }
    linksRef.current = links
  })

  const announce = useCallback((message: string) => setAnnouncement(current => (current === message ? `${message}​` : message)), [])

  /* ---------- The rAF loop ---------- */
  const ctrls = useRef(new Map<string, Ctrl>())
  const frame = useRef(0)
  const lastTime = useRef(0)
  const onscreen = useRef(true)

  const ctrlOf = useCallback((id: string) => {
    let ctrl = ctrls.current.get(id)
    if (!ctrl) {
      ctrl = { p: 0, v: 0, target: 0, drag: false, foldAt: -Infinity, removed: false }
      ctrls.current.set(id, ctrl)
    }
    return ctrl
  }, [])
  /** Drops a removed link once its card has folded away. */
  const dropRef = useRef<(id: string) => void>(() => {})

  const tickRef = useRef<FrameRequestCallback>(() => {})
  const tick = useCallback((time: number) => {
    frame.current = 0
    const dt = Math.min(0.05, Math.max(0, (time - lastTime.current) / 1000))
    lastTime.current = time
    const now = time / 1000
    const { still: instant, speed: rate } = live.current
    const land = instant || !onscreen.current || document.visibilityState === "hidden"
    const pace = Math.max(0.1, rate)
    let busy = false

    // Integrate: one spring per card, critically damped while unrolling, stiffer while folding.
    for (const ctrl of ctrls.current.values()) {
      if (ctrl.drag) continue
      if (land) {
        ctrl.p = ctrl.target
        ctrl.v = 0
        ctrl.foldAt = -Infinity
        continue
      }
      if (ctrl.removed && (now - ctrl.foldAt) * pace < LEAVE_HOLD) {
        busy = true
        continue
      }
      const { stiffness, damping } = ctrl.removed ? LEAVE : ctrl.target > 0 ? UNROLL : FOLD
      const k = stiffness * pace * pace
      const c = damping * pace
      let left = dt
      while (left > 0) {
        const h = Math.min(left, 1 / 240)
        ctrl.v += (-k * (ctrl.p - ctrl.target) - c * ctrl.v) * h
        ctrl.p += ctrl.v * h
        left -= h
      }
      if (Math.abs(ctrl.p - ctrl.target) < 0.0005 && Math.abs(ctrl.v) < 0.005) {
        ctrl.p = ctrl.target
        ctrl.v = 0
      } else busy = true
      if (ctrl.target === 0 && (now - ctrl.foldAt) * pace < FADE_FROM + FADE_FOR) busy = true
    }

    // Read every rectangle first, then write, so a frame costs one layout pass.
    type Job = { id: string; ctrl: Ctrl; tx0: number; ty0: number; l0: number; t0: number; r0: number; b0: number; r0px: number; w: number; h: number }
    const jobs: Job[] = []
    for (const [id, ctrl] of ctrls.current) {
      const link = linksRef.current.find(item => item.id === id)
      const { slot, card, fav } = ctrl
      if (!link || !slot || !card || !fav) continue
      const w = card.offsetWidth
      const h = card.offsetHeight
      // A removed link has no chip to fold into; its card closes downward in place.
      if (ctrl.removed || !link.node.isConnected) {
        jobs.push({ id, ctrl, tx0: 0, ty0: 0, l0: 0, t0: 0, r0: 0, b0: h, r0px: CARD_RADIUS, w, h })
        continue
      }
      const icon = link.node.querySelector<HTMLElement>("[data-icon]")
      const face = link.node.querySelector<HTMLElement>("[data-chip-face]") ?? link.node
      if (!icon) continue
      const slotRect = slot.getBoundingClientRect()
      const chip = face.getBoundingClientRect()
      const iconRect = icon.getBoundingClientRect()
      const favX = card.offsetLeft + fav.offsetLeft
      const favY = card.offsetTop + fav.offsetTop
      // Folded, the card sits with its favicon on the link's favicon and is clipped to the link's exact rectangle.
      const tx0 = iconRect.left - (slotRect.left + favX)
      const ty0 = iconRect.top - (slotRect.top + favY)
      const l0 = Math.max(0, chip.left - slotRect.left - card.offsetLeft - tx0)
      const t0 = Math.max(0, chip.top - slotRect.top - card.offsetTop - ty0)
      const r0 = Math.max(0, w - l0 - chip.width)
      const b0 = Math.max(0, h - t0 - chip.height)
      jobs.push({ id, ctrl, tx0, ty0, l0, t0, r0, b0, r0px: chip.height / 2, w, h })
    }
    for (const { id, ctrl, tx0, ty0, l0, t0, r0, b0, r0px, w, h } of jobs) {
      const p = clamp01(ctrl.p)
      const { slot, card, plate, body, img } = ctrl
      if (!slot || !card || !plate) continue
      // The clip widens first and deepens after: width runs a little ahead of the progress, height and lane follow it exactly.
      const across = 1 - Math.pow(1 - p, 1.6)
      const tx = tx0 * (1 - across)
      const ty = ty0 * (1 - p)
      const l = l0 * (1 - across)
      const r = r0 * (1 - across)
      const t = t0 * (1 - p)
      const b = b0 * (1 - p)
      const radius = r0px + (CARD_RADIUS - r0px) * across
      // Opening, the card shows within the first few percent; folded onto its link, it waits a beat and then fades.
      const folding = ctrl.target === 0 && !ctrl.drag
      const fade = ctrl.removed
        ? clamp01(ctrl.p * 1.5)
        : folding && Number.isFinite(ctrl.foldAt)
          ? 1 - clamp01(((now - ctrl.foldAt) * pace - FADE_FROM) / FADE_FOR)
          : clamp01(ctrl.p / 0.04)
      const hidden = folding && p < 0.001 && fade <= 0.001
      slot.style.height = `${((h + GAP) * p).toFixed(2)}px`
      card.style.visibility = hidden ? "hidden" : "visible"
      plate.style.visibility = hidden ? "hidden" : "visible"
      card.style.opacity = `${fade.toFixed(3)}`
      plate.style.opacity = `${fade.toFixed(3)}`
      card.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`
      card.style.clipPath = `inset(${t.toFixed(2)}px ${r.toFixed(2)}px ${b.toFixed(2)}px ${l.toFixed(2)}px round ${radius.toFixed(2)}px)`
      plate.style.transform = `translate3d(${(tx + l).toFixed(2)}px, ${(ty + t).toFixed(2)}px, 0)`
      plate.style.width = `${Math.max(0, w - l - r).toFixed(2)}px`
      plate.style.height = `${Math.max(0, h - t - b).toFixed(2)}px`
      plate.style.borderRadius = `${radius.toFixed(2)}px`
      // The header shows from the first frame; the body fades in after it, and the image settles from a slight zoom.
      if (body) body.style.opacity = `${clamp01((p - 0.18) / 0.54).toFixed(3)}`
      if (img) img.style.transform = `scale(${(1 + 0.07 * (1 - p)).toFixed(4)})`
      if (ctrl.removed && p < 0.001 && ctrl.target === 0) dropRef.current(id)
    }
    if (busy || [...ctrls.current.values()].some(ctrl => ctrl.drag)) {
      frame.current = requestAnimationFrame(time => tickRef.current(time))
    }
  }, [])
  useLayoutEffect(() => {
    tickRef.current = tick
  }, [tick])

  const kick = useCallback(() => {
    if (frame.current) return
    lastTime.current = performance.now()
    frame.current = requestAnimationFrame(tick)
  }, [tick])
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      frame.current = 0
    },
    [],
  )

  // Targets follow state; React renders once per change and the loop does the rest.
  useEffect(() => {
    for (const link of links) {
      const ctrl = ctrlOf(link.id)
      const target = link.open && link.status === "ready" && !link.removed ? 1 : 0
      if ((target === 0 && ctrl.target === 1) || (link.removed && !ctrl.removed)) ctrl.foldAt = performance.now() / 1000
      ctrl.target = target
      ctrl.removed = !!link.removed
    }
    for (const id of [...ctrls.current.keys()]) if (!links.some(link => link.id === id)) ctrls.current.delete(id)
    kick()
  }, [ctrlOf, kick, links])

  // Cards that change size (fonts, width, images) re-lay their slot.
  useEffect(() => {
    const lane = rootRef.current?.querySelector("[data-lane]")
    if (!lane || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => kick())
    observer.observe(lane)
    lane.querySelectorAll("[data-card-slot] > article").forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [kick, links])

  // Offscreen or in a hidden tab, cards land instantly and the loop sleeps.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const io = new IntersectionObserver(entries => {
      onscreen.current = entries[0]?.isIntersecting ?? true
      kick()
    })
    io.observe(root)
    const onVisibility = () => kick()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [kick])

  const bindFor = useCallback(
    (id: string) => (part: Part) => (node: HTMLElement | null) => {
      ctrlOf(id)[part] = node
    },
    [ctrlOf],
  )

  useLayoutEffect(() => {
    dropRef.current = id => setLinks(all => (all.some(link => link.id === id) ? all.filter(link => link.id !== id) : all))
  }, [])

  /* ---------- Links ---------- */
  const setOpen = useCallback(
    (id: string, open: boolean, say = true) => {
      const link = linksRef.current.find(item => item.id === id)
      if (!link || link.removed || link.status !== "ready" || link.open === open) return
      setLinks(all => all.map(item => (item.id === id ? { ...item, open } : item)))
      if (say && link.preview) announce(open ? `Preview shown. ${link.preview.site}, ${link.preview.title}.` : `Preview collapsed. ${link.preview.title}.`)
    },
    [announce],
  )

  const startResolve = useCallback(
    (id: string, url: string) => {
      aborts.current.get(id)?.abort()
      const controller = new AbortController()
      aborts.current.set(id, controller)
      const { signal } = controller
      announce(`Link added. Loading a preview for ${display(url).split("/")[0]}.`)
      const builtIn = async () => {
        await wait(1150 / Math.max(0.1, live.current.speed), signal)
        return live.current.samples.find(sample => same(sample.url, url)) ?? plainPreview(url)
      }
      const custom = live.current.resolve
      ;(async () => {
        let preview: LinkUnfurlPreview | null = null
        try {
          preview = custom ? await custom(hrefOf(url), signal) : await builtIn()
          if (preview) await Promise.all([decode(preview.image), decode(preview.favicon)])
        } catch {
          preview = null
        }
        if (signal.aborted) return
        aborts.current.delete(id)
        // The link takes its title and the card starts unrolling from it in the same frame.
        const openNow = !!preview && live.current.autoExpand
        setLinks(all => all.map(item => (item.id === id ? { ...item, status: preview ? "ready" : "failed", preview, open: openNow } : item)))
        if (!preview) announce(`No preview for ${display(url)}. Click the link to try again.`)
        else if (openNow) announce(`Preview shown. ${preview.site}, ${preview.title}.`)
        else announce(`Preview ready. ${preview.title}.`)
      })()
    },
    [announce],
  )

  const createChip = (url: string) => {
    const id = `${uid}-link-${++seq.current}`
    const node = document.createElement("span")
    node.contentEditable = "false"
    node.dataset.link = id
    node.dataset.url = url
    node.dataset.status = "loading"
    node.className = CHIP_CLASS
    return { id, url, node }
  }
  const adopt = (made: { id: string; url: string; node: HTMLElement }[]) => {
    if (!made.length) return
    setLinks(all => [...all, ...made.map(item => ({ ...item, status: "loading" as const, preview: null, open: false }))])
    made.forEach(item => startResolve(item.id, item.url))
  }

  /** Builds text and atomic links from plain text. */
  const fragmentOf = (text: string) => {
    const fragment = document.createDocumentFragment()
    const made: { id: string; url: string; node: HTMLElement }[] = []
    let index = 0
    for (const match of text.matchAll(URL_PATTERN)) {
      const raw = match[0]
      const url = raw.replace(TRAILING, "")
      const start = match.index ?? 0
      if (start > index) fragment.append(text.slice(index, start))
      const chip = createChip(url)
      made.push(chip)
      fragment.append(chip.node)
      index = start + url.length
    }
    if (index < text.length) fragment.append(text.slice(index))
    // A link at the very end gets a space after it, so the caret has somewhere to land.
    const lastNode = fragment.lastChild
    if (lastNode instanceof HTMLElement && lastNode.dataset.link) fragment.append(" ")
    return { fragment, made }
  }

  const refresh = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const isEmpty = !editor.textContent?.trim() && !editor.querySelector("[data-link]")
    setEmpty(isEmpty)
  }, [])

  const caretRange = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || !selection.rangeCount) return null
    const range = selection.getRangeAt(0)
    return editor.contains(range.commonAncestorContainer) ? range : null
  }
  const placeCaretAfter = (node: Node) => {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.setStartAfter(node)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const insertText = (text: string, atEnd = false) => {
    const editor = editorRef.current
    if (!editor) return
    let range = atEnd ? null : caretRange()
    if (!range) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      const before = editor.textContent ?? ""
      if (before && !/\s$/.test(before)) text = ` ${text}`
    }
    const { fragment, made } = fragmentOf(text)
    const lastNode = fragment.lastChild
    range.deleteContents()
    range.insertNode(fragment)
    if (lastNode) {
      if (!atEnd || document.activeElement === editor) placeCaretAfter(lastNode)
    }
    adopt(made)
    refresh()
  }

  /** A typed address followed by a space becomes a link. */
  const linkifyBeforeCaret = () => {
    const range = caretRange()
    if (!range || !range.collapsed || range.startContainer.nodeType !== Node.TEXT_NODE) return
    const node = range.startContainer as Text
    const before = node.data.slice(0, range.startOffset)
    const match = /(^|\s)((?:https?:\/\/|www\.)\S+)\s$/.exec(before)
    if (!match) return
    const url = match[2].replace(TRAILING, "")
    const start = match.index + match[1].length
    const word = document.createRange()
    word.setStart(node, start)
    word.setEnd(node, start + url.length)
    word.deleteContents()
    const chip = createChip(url)
    word.insertNode(chip.node)
    // The space typed after the address stays after the link; the caret follows it.
    const next = chip.node.nextSibling
    if (next && next.nodeType === Node.TEXT_NODE) {
      const selection = window.getSelection()
      const caret = document.createRange()
      const offset = Math.min((next as Text).data.length, before.length - start - url.length)
      caret.setStart(next, offset)
      caret.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(caret)
    }
    adopt([chip])
  }

  /** Writes the message out with links as addresses. */
  const serialize = () => {
    const editor = editorRef.current
    if (!editor) return ""
    let out = ""
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) out += (node as Text).data
      else if (node instanceof HTMLElement) {
        if (node.dataset.link) {
          out += linksRef.current.find(link => link.id === node.dataset.link)?.url ?? ""
          return
        }
        if (node.tagName === "BR") {
          out += "\n"
          return
        }
        const block = node !== editor && (node.tagName === "DIV" || node.tagName === "P")
        if (block && out && !out.endsWith("\n")) out += "\n"
        node.childNodes.forEach(walk)
      }
    }
    walk(editor)
    return out.replace(/ /g, " ").trim()
  }

  const removeLink = (id: string, focusEditor = true) => {
    const link = linksRef.current.find(item => item.id === id)
    if (!link) return
    aborts.current.get(id)?.abort()
    aborts.current.delete(id)
    const editor = editorRef.current
    if (link.node.isConnected && editor) {
      const caret = document.createRange()
      caret.setStartBefore(link.node)
      caret.collapse(true)
      // Drop a doubled space left behind by the link.
      const next = link.node.nextSibling
      link.node.remove()
      if (next && next.nodeType === Node.TEXT_NODE && (next as Text).data.startsWith(" ")) {
        const prev = next.previousSibling
        if (!prev || (prev.nodeType === Node.TEXT_NODE && /\s$/.test((prev as Text).data))) (next as Text).deleteData(0, 1)
      }
      if (focusEditor) {
        editor.focus({ preventScroll: true })
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(caret)
      }
    }
    // An open card folds away in place before the link leaves; anything else goes at once.
    const ctrl = ctrls.current.get(id)
    if (link.open && link.status === "ready" && ctrl && ctrl.p > 0.001) setLinks(all => all.map(item => (item.id === id ? { ...item, removed: true } : item)))
    else setLinks(all => all.filter(item => item.id !== id))
    announce(`Link removed. ${link.preview?.title ?? display(link.url)}.`)
    refresh()
  }

  const activate = (id: string) => {
    interacted.current = true
    const link = linksRef.current.find(item => item.id === id)
    if (!link || link.removed) return
    if (link.status === "failed") {
      setLinks(all => all.map(item => (item.id === id ? { ...item, status: "loading" } : item)))
      startResolve(id, link.url)
    } else if (link.status === "ready") setOpen(id, !link.open)
  }

  // Links deleted by any edit (cut, select all, undo) leave the message and stop fetching.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const observer = new MutationObserver(() => {
      refresh()
      const gone = linksRef.current.filter(link => !link.removed && !link.node.isConnected)
      if (!gone.length) return
      gone.forEach(link => {
        aborts.current.get(link.id)?.abort()
        aborts.current.delete(link.id)
      })
      // Open cards fold away in place; the rest leave with their links.
      setLinks(all =>
        all
          .filter(link => link.removed || link.node.isConnected || (link.open && link.status === "ready"))
          .map(link => (link.removed || link.node.isConnected ? link : { ...link, removed: true })),
      )
    })
    observer.observe(editor, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [refresh])

  // The starting text goes in once; addresses in it become links like pasted ones.
  const seeded = useRef(false)
  useLayoutEffect(() => {
    if (seeded.current || !editorRef.current) return
    seeded.current = true
    if (defaultValue) insertText(defaultValue, true)
    else refresh()
    // Seeding runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Every pending fetch stops with the composer.
  useEffect(() => {
    const map = aborts.current
    return () => map.forEach(controller => controller.abort())
  }, [])

  // Autoplay pastes the first sample the first time the composer scrolls into view, unless someone got there first.
  useEffect(() => {
    if (!autoPlay || paused || !samples.length) return
    const root = rootRef.current
    if (!root) return
    let timer = 0
    const io = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return
      io.disconnect()
      timer = window.setTimeout(() => {
        if (interacted.current || linksRef.current.length) return
        insertText(samples[0].url, true)
      }, 700)
    })
    io.observe(root)
    return () => {
      io.disconnect()
      window.clearTimeout(timer)
    }
    // Only the first view counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- Sending ---------- */
  const send = async () => {
    if (pending) return
    const text = serialize()
    if (!text) return
    const ordered = orderedLinks()
    const previews = ordered.filter(link => link.status === "ready" && link.preview).map(link => link.preview!)
    setError(null)
    try {
      const result = onSend?.({ text, previews })
      if (result && typeof (result as Promise<unknown>).then === "function") {
        setPending(true)
        await result
      }
    } catch (reason) {
      setPending(false)
      setError(reason instanceof Error && reason.message ? reason.message : "Couldn’t send the message. Try again.")
      return
    }
    setPending(false)
    aborts.current.forEach(controller => controller.abort())
    aborts.current.clear()
    if (editorRef.current) editorRef.current.textContent = ""
    setLinks([])
    refresh()
    setSent(true)
    announce("Message sent.")
  }
  useEffect(() => {
    if (!sent) return
    const timer = window.setTimeout(() => setSent(false), 1700)
    return () => window.clearTimeout(timer)
  }, [sent])

  const orderedLinks = () =>
    linksRef.current.filter(link => !link.removed).sort((a, b) => (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))

  /** The link that ends at or before the caret. */
  const linkBeforeCaret = () => {
    const caret = caretRange()
    if (!caret) return null
    let found: Link | null = null
    for (const link of orderedLinks()) {
      if (!link.node.isConnected) continue
      const end = document.createRange()
      end.setStartAfter(link.node)
      if (end.compareBoundaryPoints(Range.START_TO_START, caret) <= 0) found = link
    }
    return found
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    interacted.current = true
    if (event.nativeEvent.isComposing) return
    if (event.key === "Enter" && event.altKey) {
      event.preventDefault()
      const link = linkBeforeCaret()
      if (link) activate(link.id)
      return
    }
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault()
      // Chrome and Safari insert a visible break (a <br>) here; the fallback appends a newline text node.
      if (!document.execCommand("insertLineBreak")) insertText("\n")
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      void send()
      return
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      // A link deletes as one unit.
      const range = caretRange()
      if (!range || !range.collapsed) return
      const back = event.key === "Backspace"
      const { startContainer: container, startOffset: offset } = range
      let neighbor: Node | null = null
      if (container.nodeType === Node.TEXT_NODE) {
        const text = container as Text
        if (back && offset === 0) neighbor = text.previousSibling
        if (!back && offset === text.data.length) neighbor = text.nextSibling
      } else {
        neighbor = back ? container.childNodes[offset - 1] ?? null : container.childNodes[offset] ?? null
      }
      if (neighbor instanceof HTMLElement && neighbor.dataset.link) {
        event.preventDefault()
        removeLink(neighbor.dataset.link)
      }
    }
  }
  const onInput = (event: FormEvent<HTMLDivElement>) => {
    const native = event.nativeEvent as InputEvent
    if (native.inputType === "insertText" && native.data && /\s$/.test(native.data)) linkifyBeforeCaret()
    refresh()
  }
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    interacted.current = true
    const text = event.clipboardData.getData("text/plain")
    if (text) insertText(text)
  }

  /* ---------- Card drag: up folds with the pointer ---------- */
  const dragState = useRef<{ id: string; pointer: number; y: number; from: number; travel: number; moved: boolean; samples: { t: number; y: number }[] } | null>(null)
  const onHeadDown = (id: string) => (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("a, button")) return
    const ctrl = ctrlOf(id)
    const height = ctrl.card?.offsetHeight ?? 200
    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = { id, pointer: event.pointerId, y: event.clientY, from: ctrl.p, travel: Math.max(120, height * 0.8), moved: false, samples: [{ t: event.timeStamp, y: event.clientY }] }
    const head = event.currentTarget
    const move = (e: globalThis.PointerEvent) => {
      const state = dragState.current
      if (!state || e.pointerId !== state.pointer) return
      const dy = e.clientY - state.y
      if (!state.moved && Math.abs(dy) < 4) return
      state.moved = true
      ctrl.drag = true
      ctrl.v = 0
      // Pulling down past open gives a little, with resistance; pulling up folds 1:1.
      const raw = state.from + dy / state.travel
      ctrl.p = raw > 1 ? 1 + (1 - 1 / ((raw - 1) * 3 + 1)) * 0.04 : Math.max(0, raw)
      state.samples.push({ t: e.timeStamp, y: e.clientY })
      if (state.samples.length > 5) state.samples.shift()
      kick()
    }
    const up = (e: globalThis.PointerEvent) => {
      const state = dragState.current
      if (!state || e.pointerId !== state.pointer) return
      head.removeEventListener("pointermove", move)
      head.removeEventListener("pointerup", up)
      head.removeEventListener("pointercancel", up)
      dragState.current = null
      if (!state.moved) return
      const first = state.samples[0]
      const last = state.samples[state.samples.length - 1]
      const elapsed = (last.t - first.t) / 1000
      const velocity = elapsed > 0.01 && e.timeStamp - last.t < 80 ? (last.y - first.y) / elapsed : 0
      ctrl.drag = false
      ctrl.v = velocity / state.travel
      const fold = 1 - ctrl.p > 0.4 || velocity < -650
      if (fold) {
        ctrl.target = 0
        setOpen(id, false)
      } else ctrl.target = 1
      kick()
    }
    head.addEventListener("pointermove", move)
    head.addEventListener("pointerup", up)
    head.addEventListener("pointercancel", up)
  }

  const collapseFromCard = (link: Link) => {
    setOpen(link.id, false)
    // Focus leaves the folding card for the caret after its link.
    const editor = editorRef.current
    if (editor && link.node.isConnected) {
      editor.focus({ preventScroll: true })
      placeCaretAfter(link.node)
    }
  }

  const sampleState = (sample: LinkUnfurlPreview) => linksRef.current.find(link => !link.removed && same(link.url, sample.url))
  const onSample = (sample: LinkUnfurlPreview) => {
    interacted.current = true
    const link = sampleState(sample)
    if (link) activate(link.id)
    else insertText(sample.url, true)
  }

  // Cards keep the order of their links; a card folding away after its link was removed keeps its place.
  const ordered = [...links].sort((a, b) =>
    a.removed || b.removed ? 0 : a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )
  const descId = `${uid}-keys`
  const rootStyle = { ...style, "--lu-accent": accent ?? "var(--accent)" } as CSSProperties

  return (
    <div
      ref={rootRef}
      className={cn("@container grid w-full gap-2", className)}
      style={rootStyle}
      aria-busy={pending || undefined}
      onPointerDownCapture={() => void (interacted.current = true)}
    >
      <div className="grid rounded-[26px] border border-border bg-surface">
        <div className="relative">
          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-label={label}
            aria-describedby={descId}
            aria-placeholder={placeholder}
            data-placeholder={placeholder}
            data-empty={empty ? "" : undefined}
            contentEditable={pending ? "false" : "true"}
            suppressContentEditableWarning
            spellCheck
            onKeyDown={onKeyDown}
            onInput={onInput}
            onPaste={onPaste}
            className={cn(
              "max-h-48 min-h-[84px] cursor-text overflow-y-auto rounded-t-[25px] px-[18px] pt-4 pb-3 text-base leading-[26px] break-words whitespace-pre-wrap text-foreground caret-foreground outline-none",
              "data-empty:before:pointer-events-none data-empty:before:absolute data-empty:before:text-text-muted data-empty:before:content-[attr(data-placeholder)]",
              pending && "opacity-60",
            )}
          />
        </div>
        <div data-lane="" className="relative z-10 grid px-3">
          {ordered
            .filter(link => link.status === "ready" && link.preview)
            .map(link => (
              <PreviewCard
                key={link.id}
                link={link}
                bind={bindFor(link.id)}
                onCollapse={() => collapseFromCard(link)}
                onRemove={() => removeLink(link.id)}
                onHeadDown={onHeadDown(link.id)}
              />
            ))}
        </div>
        <div className="flex items-center gap-3 pt-2 pr-2.5 pb-2.5 pl-3.5">
          {samples.length > 0 && (
            <div role="group" aria-label="Sample links" className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="flex-none pr-1 text-xs leading-[1.4] text-text-muted @max-[359px]:hidden">Try</span>
              <div className="-m-0.5 flex min-w-0 flex-1 gap-1.5 overflow-x-auto p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {samples.map(sample => {
                  const link = links.find(item => !item.removed && same(item.url, sample.url))
                  return (
                    <button
                      key={sample.url}
                      type="button"
                      aria-pressed={link ? link.open : undefined}
                      aria-label={link ? `${link.open ? "Collapse" : "Show"} ${sample.site} preview` : `Paste ${sample.site} link`}
                      onClick={() => onSample(sample)}
                      className={cn(
                        "inline-flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-full pr-3 pl-2.5 text-xs leading-[1.4] shadow-[inset_0_0_0_1px_var(--border-subtle)] outline-none",
                        "transition-[background-color,color] duration-160 ease-standard focus-visible:bg-surface-muted pointer-fine:hover:bg-surface-muted",
                        link ? "bg-surface-muted text-foreground" : "text-text-secondary",
                      )}
                    >
                      {sample.favicon ? (
                        <img src={sample.favicon} alt="" className="size-3.5 rounded-[3px] object-cover" />
                      ) : (
                        <LinkIcon className="size-3.5" aria-hidden="true" />
                      )}
                      {sample.site}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <button
            type="button"
            aria-label={sendLabel}
            aria-disabled={empty || pending || undefined}
            data-state={sent ? "sent" : "idle"}
            onClick={() => void send()}
            className={cn(
              "relative ml-auto grid size-9 flex-none cursor-pointer place-items-center overflow-hidden rounded-full outline-none",
              "transition-[background-color,color,opacity] duration-200 ease-standard",
              sent
                ? "bg-success text-background"
                : empty
                  ? "bg-surface-muted text-text-muted"
                  : "bg-foreground text-background focus-visible:opacity-85",
            )}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={pending ? "pending" : sent ? "sent" : "idle"}
                className="grid place-items-center"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6, transition: { duration: duration.instant, ease: standard } }}
                transition={still ? { duration: duration.instant } : { scale: SEND_POP, opacity: { duration: duration.fast, ease: enter } }}
              >
                {pending ? (
                  <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent [animation-duration:.7s]" />
                ) : sent ? (
                  <CheckIcon className="size-4" aria-hidden="true" />
                ) : (
                  <ArrowUpIcon className="size-4" aria-hidden="true" />
                )}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="px-3 text-xs leading-[1.4] text-danger">
          {error}
        </p>
      )}
      <span id={descId} className="sr-only">
        Paste a link to preview it. Enter sends, Shift+Enter adds a line, Alt+Enter shows or collapses the preview of the link before the caret.
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {links
        .filter(link => !link.removed)
        .map(link => createPortal(<ChipFace link={link} still={still} onActivate={activate} />, link.node, link.id))}
    </div>
  )
}

export default LinkUnfurl
