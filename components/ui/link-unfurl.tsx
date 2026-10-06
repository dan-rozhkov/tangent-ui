"use client"

/* eslint-disable @next/next/no-img-element -- favicons and preview images come from the caller's unfurl data as plain URLs. */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties, ClipboardEvent, FormEvent, KeyboardEvent, PointerEvent } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUp, Check, ChevronsDownUp, Globe, Link2, X } from "lucide-react"

import { TextShimmer } from "@/components/ui/text-shimmer"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

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
type Link = { id: string; url: string; node: HTMLElement; status: Status; preview: LinkUnfurlPreview | null; open: boolean }
type Part = "slot" | "card" | "plate" | "shadow" | "head" | "body" | "img" | "fav"
/** One card's spring and the nodes the loop writes to. Progress runs from 0 (folded into its link) to 1 (open). */
type Ctrl = { p: number; v: number; target: number; drag: boolean } & Partial<Record<Part, HTMLElement | null>>

const { blur, duration } = motionTokens
type Bezier = [number, number, number, number]
const enter = [...motionTokens.ease.enter] as Bezier
const standard = [...motionTokens.ease.standard] as Bezier
/** Space above each card in the lane. */
const GAP = 8
const CHIP_RADIUS = 6
const CARD_RADIUS = 14
/** Matches http(s) and www addresses; trailing punctuation is trimmed off afterwards. */
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/g
const TRAILING = /[.,!?;:)\]}'"]+$/

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => value * value * (3 - 2 * value)
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
function plainPreview(url: string): LinkUnfurlPreview {
  const address = display(url)
  let site = address.split("/")[0]
  try {
    site = new URL(hrefOf(url)).hostname.replace(/^www\./, "")
  } catch {}
  return { url, site, title: address }
}

/* The chip wrapper is created outside React (it lives in the contenteditable); React renders its face through a portal. */
const CHIP_CLASS = "inline-block max-w-[16em] align-[-0.32em] select-none [-webkit-user-modify:read-only]"

/** The inline link: a globe and a sweep while loading; once resolved the favicon pops in and the title rolls up as the width follows. */
function ChipFace({ link, still, onActivate }: { link: Link; still: boolean; onActivate: (id: string) => void }) {
  const { status, preview, open } = link
  const loading = status === "loading"
  const text = status === "ready" && preview ? preview.title : display(link.url)
  const name =
    status === "loading" ? `${display(link.url)}, loading preview` : status === "failed" ? `${display(link.url)}, no preview, activate to retry` : `${text}, preview ${open ? "open" : "folded"}`
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label={name}
      title={status === "failed" ? "No preview. Click to try again" : preview?.title ?? link.url}
      data-chip-face=""
      onMouseDown={event => event.preventDefault()}
      onClick={() => onActivate(link.id)}
      className={cn(
        "inline-flex h-[1.6em] max-w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-[6px] pr-1.5 pl-1 align-top font-medium",
        "transition-[background-color,color] duration-200 ease-standard motion-reduce:transition-none",
        open
          ? "bg-[color-mix(in_oklab,var(--lu-accent)_12%,transparent)] text-[var(--lu-accent)]"
          : loading
            ? "bg-foreground/[0.05] text-foreground"
            : status === "failed"
              ? "bg-foreground/[0.04] text-text-secondary underline decoration-dotted underline-offset-2"
              : "bg-foreground/[0.06] text-foreground pointer-fine:hover:bg-foreground/[0.09]",
      )}
    >
      <span data-icon="" className="relative grid size-4 flex-none place-items-center" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          {status === "ready" && preview?.favicon ? (
            <motion.img
              key="favicon"
              src={preview.favicon}
              alt=""
              className="size-4 rounded-[4px] object-cover"
              initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={still ? { duration: duration.fast } : { ...motionTokens.spring.snappy, delay: 0.06 }}
            />
          ) : (
            <motion.span
              key={status === "ready" ? "link" : "globe"}
              className="grid size-4 place-items-center text-text-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: duration.instant } }}
            >
              {status === "ready" ? <Link2 className="size-3.5" /> : <Globe className="size-3.5" />}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <TextShimmer
        active={loading && !still}
        className={cn("block min-w-0 [&>span]:max-w-full [&>span>span]:truncate", loading && still && "text-text-muted")}
      >
        {text}
      </TextShimmer>
    </span>
  )
}

/** The rich card. It sits at its open place in the lane; the loop clips and translates it onto its link. */
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
  const folded = !link.open
  return (
    <div ref={bind("slot")} className="relative h-0" data-card-slot="">
      <div
        ref={bind("plate")}
        className="pointer-events-none invisible absolute top-2 left-0 rounded-[14px] bg-surface-raised ring-1 ring-border"
        aria-hidden="true"
      >
        <div ref={bind("shadow")} className="absolute inset-0 rounded-[inherit] opacity-0 shadow-floating" />
      </div>
      <div
        ref={bind("card")}
        inert={folded || undefined}
        aria-hidden={folded || undefined}
        role="group"
        aria-label={`Preview: ${preview.site}, ${preview.title}`}
        className="invisible absolute top-2 left-0 w-full max-w-[440px] will-change-transform"
      >
        <div
          ref={bind("head")}
          onPointerDown={onHeadDown}
          className="flex h-10 cursor-grab touch-none items-center gap-1.5 pr-1.5 pl-3 select-none active:cursor-grabbing"
        >
          {preview.favicon ? (
            <img ref={bind("fav")} src={preview.favicon} alt="" className="size-4 flex-none rounded-[4px] object-cover" draggable={false} />
          ) : (
            <span ref={bind("fav")} className="grid size-4 flex-none place-items-center text-text-muted" aria-hidden="true">
              <Link2 className="size-3.5" />
            </span>
          )}
          <a
            href={hrefOf(preview.url)}
            target="_blank"
            rel="noreferrer"
            draggable={false}
            className="ml-0.5 min-w-0 flex-1 truncate rounded-[6px] text-[15px] leading-7 font-medium text-foreground outline-none focus-visible:bg-foreground/[0.065] pointer-fine:hover:underline"
          >
            {preview.title}
          </a>
          <button
            type="button"
            aria-label={`Collapse preview of ${preview.title}`}
            onClick={onCollapse}
            className="grid size-7 flex-none cursor-pointer place-items-center rounded-full text-text-secondary outline-none focus-visible:bg-foreground/[0.065] pointer-fine:hover:bg-foreground/[0.065] pointer-fine:hover:text-foreground"
          >
            <ChevronsDownUp className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Remove link ${preview.title}`}
            onClick={onRemove}
            className="grid size-7 flex-none cursor-pointer place-items-center rounded-full text-text-secondary outline-none focus-visible:bg-foreground/[0.065] pointer-fine:hover:bg-foreground/[0.065] pointer-fine:hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div ref={bind("body")} className="flex flex-col gap-2.5 px-3 pb-3 opacity-0">
          {preview.image && (
            <div className="aspect-[1.91] overflow-hidden rounded-[10px] bg-surface-muted">
              <img ref={bind("img")} src={preview.image} alt="" className="size-full object-cover" draggable={false} />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-xs leading-body text-text-muted">{preview.site}</span>
            {preview.description && <p className="line-clamp-2 text-sm leading-body text-text-secondary">{preview.description}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * A message composer that unfurls links. A pasted address becomes an inline link with a soft loading sweep; once the preview resolves,
 * the favicon and title roll in and the link unrolls into a rich card in one continuous morph. Click the link, press collapse, or drag the
 * card up to fold it back into the text; remove it to take the link out of the message.
 */
export function LinkUnfurl({
  label = "Message #lisbon-offsite",
  placeholder = "Message #lisbon-offsite",
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
      ctrl = { p: 0, v: 0, target: 0, drag: false }
      ctrls.current.set(id, ctrl)
    }
    return ctrl
  }, [])

  const tickRef = useRef<FrameRequestCallback>(() => {})
  const tick = useCallback((time: number) => {
    frame.current = 0
    const dt = Math.min(0.05, Math.max(0, (time - lastTime.current) / 1000))
    lastTime.current = time
    const { still: instant, speed: rate } = live.current
    const land = instant || !onscreen.current || document.visibilityState === "hidden"
    let busy = false

    // Integrate: a critically damped spring per card, quicker when folding.
    for (const ctrl of ctrls.current.values()) {
      if (ctrl.drag) continue
      if (land) {
        ctrl.p = ctrl.target
        ctrl.v = 0
        continue
      }
      const visualDuration = (ctrl.target > 0 ? motionTokens.spring.morph.visualDuration : 0.3) / Math.max(0.1, rate)
      const omega = (2 * Math.PI) / (visualDuration * 1.2)
      let left = dt
      while (left > 0) {
        const h = Math.min(left, 1 / 240)
        const accel = -omega * omega * (ctrl.p - ctrl.target) - 2 * omega * ctrl.v
        ctrl.v += accel * h
        ctrl.p += ctrl.v * h
        left -= h
      }
      if (Math.abs(ctrl.p - ctrl.target) < 0.0005 && Math.abs(ctrl.v) < 0.005) {
        ctrl.p = ctrl.target
        ctrl.v = 0
      } else busy = true
    }

    // Read every rectangle first, then write, so a frame costs one layout pass.
    const jobs: { ctrl: Ctrl; tx0: number; ty0: number; l0: number; t0: number; r0: number; b0: number; w: number; h: number }[] = []
    for (const [id, ctrl] of ctrls.current) {
      const link = linksRef.current.find(item => item.id === id)
      const { slot, card, fav } = ctrl
      if (!link || !slot || !card || !fav || !link.node.isConnected) continue
      const icon = link.node.querySelector<HTMLElement>("[data-icon]")
      const face = link.node.querySelector<HTMLElement>("[data-chip-face]") ?? link.node
      if (!icon) continue
      const slotRect = slot.getBoundingClientRect()
      const chip = face.getBoundingClientRect()
      const iconRect = icon.getBoundingClientRect()
      const w = card.offsetWidth
      const h = card.offsetHeight
      const favX = card.offsetLeft + fav.offsetLeft
      const favY = card.offsetTop + fav.offsetTop
      // Folded, the card sits with its favicon on the link's favicon and is clipped to the link's exact rectangle.
      const tx0 = iconRect.left - (slotRect.left + favX)
      const ty0 = iconRect.top - (slotRect.top + favY)
      const l0 = Math.max(0, chip.left - slotRect.left - card.offsetLeft - tx0)
      const t0 = Math.max(0, chip.top - slotRect.top - card.offsetTop - ty0)
      const r0 = Math.max(0, w - l0 - chip.width)
      const b0 = Math.max(0, h - t0 - chip.height)
      jobs.push({ ctrl, tx0, ty0, l0, t0, r0, b0, w, h })
    }
    for (const { ctrl, tx0, ty0, l0, t0, r0, b0, w, h } of jobs) {
      const p = ctrl.p
      const { slot, card, plate, shadow, head, body, img } = ctrl
      if (!slot || !card || !plate) continue
      const hidden = p < 0.001 && ctrl.target === 0 && !ctrl.drag
      // The clip widens first and deepens after, while the translation eases home.
      const across = smooth(clamp01(p / 0.6))
      const down = smooth(clamp01((p - 0.22) / 0.78))
      const travel = smooth(clamp01(p))
      const tx = tx0 * (1 - travel)
      const ty = ty0 * (1 - travel)
      const l = l0 * (1 - across)
      const r = r0 * (1 - across)
      const t = t0 * (1 - down)
      const b = b0 * (1 - down)
      const radius = CHIP_RADIUS + (CARD_RADIUS - CHIP_RADIUS) * across
      slot.style.height = `${((h + GAP) * down).toFixed(2)}px`
      card.style.visibility = hidden ? "hidden" : "visible"
      plate.style.visibility = hidden ? "hidden" : "visible"
      card.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`
      card.style.clipPath = `inset(${t.toFixed(2)}px ${r.toFixed(2)}px ${b.toFixed(2)}px ${l.toFixed(2)}px round ${radius.toFixed(2)}px)`
      plate.style.transform = `translate3d(${(tx + l).toFixed(2)}px, ${(ty + t).toFixed(2)}px, 0)`
      plate.style.width = `${Math.max(0, w - l - r).toFixed(2)}px`
      plate.style.height = `${Math.max(0, h - t - b).toFixed(2)}px`
      plate.style.borderRadius = `${radius.toFixed(2)}px`
      plate.style.opacity = `${clamp01(p / 0.12)}`
      // The shadow lifts only mid flight.
      if (shadow) shadow.style.opacity = `${Math.sin(Math.PI * clamp01(p)).toFixed(3)}`
      if (head) head.style.opacity = `${clamp01(p / 0.12)}`
      // The body fades in after the header, and the image settles from a slight zoom.
      if (body) body.style.opacity = `${clamp01((p - 0.45) / 0.4)}`
      if (img) img.style.transform = `scale(${(1.06 - 0.06 * clamp01((p - 0.3) / 0.7)).toFixed(4)})`
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
    for (const link of links) ctrlOf(link.id).target = link.open && link.status === "ready" ? 1 : 0
    for (const id of [...ctrls.current.keys()]) if (!links.some(link => link.id === id)) ctrls.current.delete(id)
    kick()
  }, [ctrlOf, kick, links])

  // Cards that change size (fonts, width, images) re-lay their slot.
  useEffect(() => {
    const lane = rootRef.current?.querySelector("[data-lane]")
    if (!lane || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => kick())
    observer.observe(lane)
    lane.querySelectorAll("[data-card-slot] > [role='group']").forEach(node => observer.observe(node))
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

  /* ---------- Links ---------- */
  const setOpen = useCallback(
    (id: string, open: boolean, say = true) => {
      const link = linksRef.current.find(item => item.id === id)
      if (!link || link.status !== "ready" || link.open === open) return
      setLinks(all => all.map(item => (item.id === id ? { ...item, open } : item)))
      if (say && link.preview) announce(open ? `Preview open: ${link.preview.site}, ${link.preview.title}` : `Preview collapsed: ${link.preview.title}`)
    },
    [announce],
  )

  const startResolve = useCallback(
    (id: string, url: string) => {
      aborts.current.get(id)?.abort()
      const controller = new AbortController()
      aborts.current.set(id, controller)
      const { signal } = controller
      announce(`Link added: ${display(url)}. Loading preview`)
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
        // Without motion the card opens with the title; otherwise the link settles into its title first, then unrolls.
        const openNow = !!preview && live.current.autoExpand && live.current.still
        setLinks(all => all.map(item => (item.id === id ? { ...item, status: preview ? "ready" : "failed", preview, open: openNow } : item)))
        if (!preview) {
          announce(`No preview for ${display(url)}`)
          return
        }
        if (!live.current.autoExpand) {
          announce(`Preview ready: ${preview.title}`)
          return
        }
        if (openNow) announce(`Preview open: ${preview.site}, ${preview.title}`)
        else window.setTimeout(() => setOpen(id, true), 320 / Math.max(0.1, live.current.speed))
      })()
    },
    [announce, setOpen],
  )

  const createChip = (url: string) => {
    const id = `${uid}-link-${++seq.current}`
    const node = document.createElement("span")
    node.contentEditable = "false"
    node.dataset.link = id
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
    setLinks(all => all.filter(item => item.id !== id))
    announce(`Link removed: ${link.preview?.title ?? display(link.url)}`)
    refresh()
  }

  const activate = (id: string) => {
    interacted.current = true
    const link = linksRef.current.find(item => item.id === id)
    if (!link) return
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
      const gone = linksRef.current.filter(link => !link.node.isConnected)
      if (!gone.length) return
      gone.forEach(link => {
        aborts.current.get(link.id)?.abort()
        aborts.current.delete(link.id)
      })
      setLinks(all => all.filter(link => link.node.isConnected))
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
    announce("Message sent")
  }
  useEffect(() => {
    if (!sent) return
    const timer = window.setTimeout(() => setSent(false), 1600)
    return () => window.clearTimeout(timer)
  }, [sent])

  const orderedLinks = () =>
    [...linksRef.current].sort((a, b) => (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))

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

  const sampleState = (sample: LinkUnfurlPreview) => linksRef.current.find(link => same(link.url, sample.url))
  const onSample = (sample: LinkUnfurlPreview) => {
    interacted.current = true
    const link = sampleState(sample)
    if (link) activate(link.id)
    else insertText(sample.url, true)
  }

  const ordered = [...links].sort((a, b) => (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
  const descId = `${uid}-keys`
  const rootStyle = { ...style, "--lu-accent": accent ?? "var(--accent)" } as CSSProperties

  return (
    <div
      ref={rootRef}
      className={cn("@container w-full", className)}
      style={rootStyle}
      aria-busy={pending || undefined}
      onPointerDownCapture={() => void (interacted.current = true)}
    >
      <div className="flex flex-col gap-1 rounded-[22px] bg-surface-raised p-2 shadow-raised ring-1 ring-border @min-[560px]:p-3">
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
              "max-h-40 min-h-14 overflow-y-auto rounded-[14px] px-2 py-1.5 text-[15px] leading-7 break-words whitespace-pre-wrap text-foreground caret-foreground outline-none",
              "data-empty:before:pointer-events-none data-empty:before:absolute data-empty:before:text-text-muted data-empty:before:content-[attr(data-placeholder)]",
              pending && "opacity-60",
            )}
          />
        </div>
        <div data-lane="" className="relative z-10 flex flex-col px-2">
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
        <div className="mt-1 flex items-center gap-1.5 pl-1">
          {samples.length > 0 && (
            <>
              <span className="pr-0.5 text-xs leading-body text-text-muted @max-[359px]:hidden">Try</span>
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {samples.map(sample => {
                  const link = links.find(item => same(item.url, sample.url))
                  return (
                    <button
                      key={sample.url}
                      type="button"
                      aria-pressed={link ? link.open : undefined}
                      title={link ? `${link.open ? "Collapse" : "Show"} the preview` : `Add the ${sample.site} link`}
                      onClick={() => onSample(sample)}
                      className={cn(
                        "inline-flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs leading-body font-medium outline-none",
                        "transition-[background-color,color] duration-160 ease-standard focus-visible:bg-foreground/[0.08] pointer-fine:hover:bg-foreground/[0.065]",
                        link?.open ? "bg-foreground/[0.07] text-foreground" : "text-text-secondary",
                      )}
                    >
                      {sample.favicon ? (
                        <img src={sample.favicon} alt="" className="size-3.5 rounded-[3px] object-cover" />
                      ) : (
                        <Link2 className="size-3.5" aria-hidden="true" />
                      )}
                      {sample.site}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          <button
            type="button"
            aria-label={sendLabel}
            aria-disabled={empty || pending || undefined}
            onClick={() => void send()}
            className={cn(
              "relative ml-auto grid size-9 flex-none cursor-pointer place-items-center overflow-hidden rounded-full outline-none",
              "transition-[background-color,color,opacity] duration-200 ease-standard",
              empty && !sent ? "bg-foreground/[0.08] text-text-muted" : "bg-foreground text-background focus-visible:opacity-85",
            )}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={pending ? "pending" : sent ? "sent" : "idle"}
                className="grid place-items-center"
                initial={{ opacity: 0, scale: 0.6, filter: `blur(${blur.subtle}px)` }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.6, filter: `blur(${blur.subtle}px)`, transition: { duration: duration.instant, ease: standard } }}
                transition={still ? { duration: duration.instant } : { ...motionTokens.spring.snappy, opacity: { duration: duration.fast, ease: enter } }}
              >
                {pending ? (
                  <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent [animation-duration:.7s]" />
                ) : sent ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <ArrowUp className="size-4" aria-hidden="true" />
                )}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 px-3 text-xs leading-body text-danger">
          {error}
        </p>
      )}
      <span id={descId} className="sr-only">
        Enter sends, Shift+Enter adds a line, Alt+Enter shows or collapses the preview of the link before the caret.
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {links.map(link => createPortal(<ChipFace link={link} still={still} onActivate={activate} />, link.node, link.id))}
    </div>
  )
}

export default LinkUnfurl
