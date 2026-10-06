"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import type { MotionStyle, TargetAndTransition } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface GlassCardProps {
  /** Photo behind the glass. */
  image: string
  /** Alt text for the photo. Pass an empty string when it is decorative. */
  imageAlt: string
  /** Main line in the glass panel, such as a name or a product. */
  title: string
  /** Second line under the title. */
  subtitle?: ReactNode
  /** Small element at the end of the header, such as a price, a rating, or a status. */
  aside?: ReactNode
  /** Detail content revealed when the card expands. Buttons inside stay interactive and do not toggle the card. */
  children?: ReactNode
  /** Controlled expanded state. */
  open?: boolean
  /** Initial expanded state when uncontrolled. */
  defaultOpen?: boolean
  /** Called when the card expands or collapses. */
  onOpenChange?: (open: boolean) => void
  /** Maximum tilt in degrees. 0 turns tilt off. */
  tilt?: number
  /** Extra class on the card. Set its width here; the card keeps a 4 by 5 ratio. */
  className?: string
  /** Inline style on the card. */
  style?: CSSProperties
}

/** Gap between the card edge and the glass panel, in px. The panel radius follows from it, so the corners stay concentric. */
const INSET = 12
const CARD_RADIUS = 34
const PANEL_RADIUS = CARD_RADIUS - INSET
/** Tilt eases toward the pointer and back to level on the same spring. */
const FOLLOW = motionTokens.spring.gentle
/** The details trail the panel a little, so they fade in once there is room for them. */
const DETAIL_DELAY = 0.045

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** A ring only as wide as the padding; everything inside the content box is masked away. */
const RING_MASK: CSSProperties = {
  mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
  WebkitMask: "linear-gradient(#000 0 0) content-box xor, linear-gradient(#000 0 0)",
}

/**
 * A photo card with a glass info panel. The panel's rim catches a specular highlight under the pointer, the card tilts
 * a few degrees toward it, and a tap morphs the panel up into a detail sheet.
 */
export function GlassCard({
  image,
  imageAlt,
  title,
  subtitle,
  aside,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  tilt = 6,
  className,
  style,
}: GlassCardProps) {
  const reduced = useReducedMotion() ?? false
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const ids = { header: `gc-header-${uid}`, detail: `gc-detail-${uid}` }

  /* ---------- open state ---------- */
  const [innerOpen, setInnerOpen] = useState(defaultOpen)
  const isOpen = open ?? innerOpen
  const latest = useRef({ isOpen, onOpenChange })
  useLayoutEffect(() => {
    latest.current = { isOpen, onOpenChange }
  })
  const setOpen = useCallback(
    (next: boolean) => {
      if (next === latest.current.isOpen) return
      if (open === undefined) setInnerOpen(next)
      latest.current.onOpenChange?.(next)
    },
    [open],
  )
  const headerRef = useRef<HTMLButtonElement>(null)

  /* ---------- geometry ---------- */
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const cardH = useMotionValue(400)
  const panelH = useMotionValue(0)
  const placed = useRef(false)
  const reducedRef = useRef(reduced)
  useLayoutEffect(() => {
    reducedRef.current = reduced
  }, [reduced])

  useLayoutEffect(() => {
    const root = rootRef.current
    const content = contentRef.current
    if (!root || !content) return
    let running: ReturnType<typeof animate> | undefined
    const measure = () => {
      const h = root.offsetHeight
      cardH.set(h)
      const target = Math.min(content.offsetHeight, h - INSET * 2)
      if (Math.abs(panelH.get() - target) < 0.5 && placed.current) return
      running?.stop()
      if (!placed.current || reducedRef.current) {
        // First layout, or reduced motion: the panel switches size without a morph.
        placed.current = true
        panelH.jump(target)
        return
      }
      // One shape morph both ways, bottom edge pinned: the sheet grows up from the header and folds back down to it.
      running = animate(panelH, target, motionTokens.spring.morph)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(content)
    return () => {
      observer.disconnect()
      running?.stop()
    }
  }, [cardH, panelH])

  /* ---------- pointer light and tilt ---------- */
  // The card turns about its center: full tilt at the edges, level in the middle. Springs ease toward the targets.
  const tiltX = useMotionValue(0)
  const tiltY = useMotionValue(0)
  const rotateX = useSpring(tiltX, FOLLOW)
  const rotateY = useSpring(tiltY, FOLLOW)
  // The rim light sits right under the pointer and only its strength eases, so it never lags behind the hand.
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const lit = useMotionValue(0)
  const glow = useSpring(lit, motionTokens.spring.smooth)
  const panelTop = useTransform(() => cardH.get() - INSET - panelH.get())
  // In panel coordinates; above the panel they go negative, and the far edge of the gradient still reaches the rim.
  const lightX = useTransform(() => pointerX.get() - INSET)
  const lightY = useTransform(() => pointerY.get() - panelTop.get())
  const lightVars = {
    "--gc-lx": useMotionTemplate`${lightX}px`,
    "--gc-ly": useMotionTemplate`${lightY}px`,
    "--gc-lit": glow,
  } as unknown as MotionStyle

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    // Touch has no hover, so it keeps the card flat and only taps.
    if (event.pointerType === "touch") return
    const rect = event.currentTarget.getBoundingClientRect()
    // Untransformed size, so the tilt does not feed back into the pointer math.
    const w = event.currentTarget.offsetWidth || rect.width
    const h = event.currentTarget.offsetHeight || rect.height
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const nx = clamp((event.clientX - cx) / (w / 2), -1, 1)
    const ny = clamp((event.clientY - cy) / (h / 2), -1, 1)
    pointerX.set((nx + 1) * (w / 2))
    pointerY.set((ny + 1) * (h / 2))
    lit.set(1)
    if (reduced || tilt === 0) return
    tiltY.set(nx * tilt)
    tiltX.set(-ny * tilt)
  }
  function onPointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return
    // Settle back level; the light fades where it was.
    lit.set(0)
    tiltX.set(0)
    tiltY.set(0)
  }
  useEffect(() => {
    if (reduced || tilt === 0) {
      tiltX.jump(0)
      tiltY.jump(0)
      rotateX.jump(0)
      rotateY.jump(0)
    }
  }, [reduced, rotateX, rotateY, tilt, tiltX, tiltY])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !latest.current.isOpen) return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    headerRef.current?.focus()
  }

  const detailMotion: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } = reduced
    ? {
        // Same keys as the full branch, so the first render matches the server whichever branch the client picks.
        initial: { opacity: 0, filter: "blur(0px)" },
        animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      }
    : {
        // The details ride the panel's morph a beat behind it, clearing a soft blur as they arrive.
        initial: { opacity: 0, filter: `blur(${motionTokens.blur.soft}px)` },
        animate: { opacity: 1, filter: "blur(0px)", transition: { ...motionTokens.spring.morph, delay: DETAIL_DELAY } },
        // Leaving is quick, so the sheet folds over an empty panel.
        exit: {
          opacity: 0,
          filter: `blur(${motionTokens.blur.subtle}px)`,
          transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
        },
      }

  return (
    <motion.div
      ref={rootRef}
      className={cn(
        "relative aspect-[4/5] w-full min-w-0 select-none [-webkit-tap-highlight-color:transparent]",
        // Glass material per theme, then for increased contrast and reduced transparency.
        "[--gc-tint:oklch(100%_0_0/.62)] [--gc-border:oklch(100%_0_0/.42)] [--gc-inset:oklch(100%_0_0/.5)] [--gc-frost:blur(22px)_saturate(1.7)]",
        "dark:[--gc-tint:oklch(21.5%_0_0/.62)] dark:[--gc-border:oklch(100%_0_0/.14)] dark:[--gc-inset:oklch(100%_0_0/.12)]",
        "contrast-more:[--gc-tint:color-mix(in_oklab,var(--background)_94%,transparent)] contrast-more:[--gc-border:var(--border-strong)]",
        "[@media(prefers-reduced-transparency:reduce)]:[--gc-tint:var(--surface-raised)] [@media(prefers-reduced-transparency:reduce)]:[--gc-frost:none]",
        className,
      )}
      style={{ ...lightVars, ...style }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <motion.div
        className="relative size-full overflow-hidden rounded-surface bg-surface-muted shadow-floating"
        style={{ rotateX, rotateY, transformPerspective: 900 }}
      >
        {/* The photo is a pointer shortcut for the header button; keyboard users use the header. It leans in a little
            while open; the near-identity rest scale keeps it on its own layer, so the change never re-rasterizes. */}
        <div aria-hidden={imageAlt === "" ? true : undefined} className="absolute inset-0 cursor-pointer" onClick={() => setOpen(!latest.current.isOpen)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={imageAlt}
            draggable={false}
            className={cn(
              "size-full object-cover transition-[transform] duration-480 ease-standard motion-reduce:transition-none",
              isOpen ? "[transform:scale(1.05)]" : "[transform:scale(1.001)]",
            )}
          />
        </div>
        {/* The floor shade grounds the panel and deepens while it is open, so the sheet reads over any photo. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,oklch(0%_0_0/.22),transparent_45%)] transition-opacity duration-240 ease-standard motion-reduce:transition-none",
            isOpen ? "opacity-100" : "opacity-60",
          )}
        />

        <motion.div
          className="absolute overflow-hidden text-foreground"
          style={{ left: INSET, right: INSET, bottom: INSET, height: panelH, borderRadius: PANEL_RADIUS }}
        >
          {/* The glass: tint, frost, a 1px rim and a lit top edge. It carries its own radius; Chromium drops an
              ancestor's rounding on a composited backdrop filter. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 border border-(--gc-border) bg-(--gc-tint) shadow-[inset_0_1px_0_var(--gc-inset),0_12px_32px_oklch(0%_0_0/.16),0_2px_6px_oklch(0%_0_0/.08)] [backdrop-filter:var(--gc-frost)] [-webkit-backdrop-filter:var(--gc-frost)]"
            style={{ borderRadius: PANEL_RADIUS }}
          />
          {/* The specular highlight under the pointer: a masked gradient, so only the 1px rim catches it. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-px p-px opacity-(--gc-lit)"
            style={{
              ...RING_MASK,
              borderRadius: PANEL_RADIUS - 1,
              background: "radial-gradient(160px at var(--gc-lx) var(--gc-ly), oklch(100% 0 0 / .95), transparent 70%)",
            }}
          />

          <div ref={contentRef} className="relative p-px">
            <button
              ref={headerRef}
              id={ids.header}
              type="button"
              aria-expanded={isOpen}
              aria-controls={ids.detail}
              className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left text-inherit outline-none"
              onClick={() => setOpen(!latest.current.isOpen)}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-base leading-[1.4] font-medium">{title}</span>
                {subtitle ? <span className="truncate text-sm leading-[1.4] text-text-secondary">{subtitle}</span> : null}
              </span>
              {aside ? <span className="flex flex-none items-center gap-1 text-sm leading-[1.4] font-medium tabular-nums">{aside}</span> : null}
            </button>
            <AnimatePresence initial={false} mode="popLayout">
              {isOpen ? (
                <motion.div
                  key="detail"
                  id={ids.detail}
                  role="region"
                  aria-labelledby={ids.header}
                  className="px-4 pb-4 text-sm leading-[1.4] text-text-secondary select-text"
                  {...detailMotion}
                >
                  {children}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export default GlassCard
