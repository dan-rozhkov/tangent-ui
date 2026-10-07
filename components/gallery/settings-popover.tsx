"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { FocusEvent, KeyboardEvent, ReactNode } from "react"
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue } from "motion/react"
import type { Transition, Variants } from "motion/react"
import { GearSixIcon } from "@phosphor-icons/react"

import { useThemeTransition } from "@/components/demos/theme-switch"
import { accents, motionSpeeds, setAccent, setMotionReduce, setMotionSpeed, useMotionSettings, type Accent } from "@/components/gallery/motion-settings"
import { iconButton, iconGlyph } from "@/components/gallery/icon-button"
import SegmentedControl from "@/components/ui/segmented-control"
import { Switch } from "@/components/ui/switch"
import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

const swatch: Record<Accent, string> = {
  neutral: "oklch(33% 0 0)",
  violet: "#7747ff",
  blue: "#0562ef",
  green: "#0db879",
  amber: "#f3ad20",
  orange: "#f48120",
  coral: "#f15f55",
  rose: "#ed4e9d",
}

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]
const speedOptions = motionSpeeds.map(value => ({ value: String(value), label: `${value}×` }))

type Face = "button" | "panel"
type Bezier = [number, number, number, number]
const enter = [...staticTokens.ease.enter] as Bezier
const standard = [...staticTokens.ease.standard] as Bezier
/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps the velocity it already has. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}

/** The button is 36px with a fully round 18px corner; the panel's 20px corner is its 8px control radius plus the 12px padding, so the two stay concentric. */
const SIZE = 36
const BUTTON_RADIUS = 18
const PANEL_RADIUS = 20
/** The trigger sits 8px past the header gutter (optical alignment, like the burger); the open panel pulls back onto the gutter. */
const PANEL_SHIFT = -8

function buildMotion(motionTokens: MotionTokens) {
  const { blur } = motionTokens
  /** Growing out of the button carries the morph spring's bounce; folding back never overshoots. */
  const GROW = physical(motionTokens.spring.morph.visualDuration ?? 0.42, motionTokens.spring.morph.bounce ?? 0.16)
  const FOLD = physical(motionTokens.spring.smooth.visualDuration ?? 0.4, motionTokens.spring.smooth.bounce ?? 0)
  /** Faces swap in place, as one shape holding different content: the old face blurs out fast, the new one sharpens in behind it. */
  const faceVariants: Variants = {
    hidden: { opacity: 0, scale: 0.97, filter: `blur(${blur.soft}px)` },
    shown: (delay: number) => ({
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        scale: { ...physical(0.32, 0), delay },
        opacity: { duration: 0.2, ease: enter, delay },
        filter: { duration: 0.24, ease: enter, delay },
      },
    }),
    gone: {
      opacity: 0,
      scale: 0.97,
      filter: `blur(${blur.soft}px)`,
      transition: { scale: physical(0.24, 0), opacity: { duration: 0.1, ease: standard }, filter: { duration: 0.12, ease: standard } },
    },
  }
  return { GROW, FOLD, faceVariants }
}

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
}

function FaceLayer({
  id,
  delay,
  reduced,
  onSize,
  className,
  children,
}: {
  id: Face
  delay: number
  reduced: boolean
  onSize: (id: Face, width: number, height: number) => void
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const present = useIsPresent()
  const motionTokens = useMotionTokens()
  const { faceVariants } = useMemo(() => buildMotion(motionTokens), [motionTokens])
  // Only the current face reports its size; the leaving one keeps whatever it had while it fades.
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
      custom={delay}
      variants={reduced ? fadeVariants : faceVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!present || undefined}
      // Pinned to the top-right corner, so the panel grows down and to the left.
      className={cn("absolute top-0 right-0 origin-top-right", className)}
    >
      {children}
    </motion.div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs leading-body text-text-muted">{title}</span>
      {children}
    </div>
  )
}

const fillSegments = "w-full [&>div]:flex-1 [&_button]:flex-1 [&_button]:px-0"

function AccentPicker({ value, onValueChange }: { value: string; onValueChange: (accent: Accent) => void }) {
  const selectedIndex = Math.max(0, accents.indexOf(value as Accent))
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = accents.length - 1
    const target =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? selectedIndex === last ? 0 : selectedIndex + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? selectedIndex === 0 ? last : selectedIndex - 1
          : event.key === "Home" ? 0 : event.key === "End" ? last : -1
    if (target < 0) return
    event.preventDefault()
    onValueChange(accents[target])
    event.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-accent="${accents[target]}"]`)?.focus({ preventScroll: true })
  }
  return (
    <div role="radiogroup" aria-label="Accent color" className="flex items-center justify-between">
      {accents.map((name, index) => {
        const selected = name === accents[selectedIndex]
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name[0].toUpperCase() + name.slice(1)}
            data-accent={name}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onValueChange(name)}
            onKeyDown={onKeyDown}
            className="group/swatch grid size-7 cursor-pointer place-items-center rounded-full outline-none [-webkit-tap-highlight-color:transparent]"
          >
            <span
              className={cn(
                "block size-5 rounded-full transition-[box-shadow,transform] duration-160 ease-standard motion-reduce:transition-none",
                "group-active/swatch:scale-95 pointer-fine:group-hover/swatch:scale-110",
                selected
                  ? "shadow-[0_0_0_2px_var(--surface-raised),0_0_0_3.5px_var(--foreground)]"
                  : "shadow-[inset_0_0_0_1px_oklch(0%_0_0/.08)]",
              )}
              style={{ background: swatch[name] }}
            />
          </button>
        )
      })}
    </div>
  )
}

/** A header icon button that morphs into a settings panel: theme, accent color, animation speed and reduced motion. */
export function SettingsPopover() {
  const reduced = useReducedMotion()
  const motionTokens = useMotionTokens()
  const { GROW, FOLD } = useMemo(() => buildMotion(motionTokens), [motionTokens])
  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const face: Face = open ? "panel" : "button"
  const current = useRef<Face>("button")
  const focusNext = useRef<string | null>(null)

  const { preference, setTheme, onThemeChange } = useThemeTransition()
  const { speed, accent } = useMotionSettings()

  /* The shape: one surface whose width, height, and corner radius follow the current face. */
  const width = useMotionValue(SIZE)
  const height = useMotionValue(SIZE)
  const radius = useMotionValue(BUTTON_RADIUS)
  const shift = useMotionValue(0)
  const target = useRef<{ id: Face; w: number; h: number } | null>(null)
  const onSize = useCallback(
    (id: Face, w: number, h: number) => {
      if (id !== current.current) return
      const previous = target.current
      if (previous && Math.abs(previous.w - w) < 0.5 && Math.abs(previous.h - h) < 0.5) return
      target.current = { id, w, h }
      const r = id === "button" ? BUTTON_RADIUS : PANEL_RADIUS
      if (!previous || reduced) {
        width.jump(w)
        height.jump(h)
        radius.jump(r)
        shift.jump(id === "button" ? 0 : PANEL_SHIFT)
        return
      }
      const spring = id === "button" ? FOLD : GROW
      animate(width, w, spring)
      animate(height, h, spring)
      animate(radius, r, spring)
      animate(shift, id === "button" ? 0 : PANEL_SHIFT, spring)
    },
    [FOLD, GROW, height, radius, reduced, shift, width],
  )

  const go = useCallback((next: Face, focus: string | null) => {
    if (next === current.current) return
    current.current = next
    focusNext.current = focus
    setOpen(next === "panel")
  }, [])

  // Focus moves into the panel once it mounts, and back to the button on close.
  useEffect(() => {
    const selector = focusNext.current
    focusNext.current = null
    if (!selector) return
    surfaceRef.current?.querySelector<HTMLElement>(`[data-face="${face}"] ${selector}`)?.focus({ preventScroll: true })
  }, [face])

  const openPanel = () => {
    go("panel", '[aria-pressed="true"]')
  }
  const close = useCallback((focusTrigger: boolean) => go("button", focusTrigger ? "[data-trigger]" : null), [go])

  // A press outside folds the panel. Focus goes wherever the press puts it, and falls back to the button when the press lands on nothing focusable.
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root || root.contains(event.target as Node)) return
      const hadFocus = root.contains(document.activeElement)
      close(false)
      if (!hadFocus) return
      requestAnimationFrame(() => {
        const active = document.activeElement
        if (!active || active === document.body) rootRef.current?.querySelector<HTMLElement>("[data-trigger]")?.focus({ preventScroll: true })
      })
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [close, open])

  // Tabbing out folds the panel too. Focus moving within the root (the open morph, a face swap) and focus lost to nothing are ignored.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null
    if (!open || !next || rootRef.current?.contains(next)) return
    close(false)
  }

  const onSurfaceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !open) return
    event.preventDefault()
    event.stopPropagation()
    close(true)
  }

  const changeTheme = (value: string) => {
    if (value === "system") setTheme("system")
    else if (themeRef.current) onThemeChange(value as "light" | "dark", "reveal", themeRef.current)
  }
  const changeReduce = (value: boolean) => {
    // Matching the system preference goes back to following it.
    setMotionReduce(value === window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : value)
  }

  return (
    <div ref={rootRef} onBlur={onBlur} className="relative z-50 -mr-2 size-9 flex-none touch-manipulation">
      <motion.div
        ref={surfaceRef}
        className={cn(
          "absolute top-0 right-0 z-50 overflow-hidden text-foreground ring-1 transition-[background-color,box-shadow] duration-160 ease-standard motion-reduce:transition-none",
          open ? "bg-surface-raised shadow-floating ring-border" : "bg-transparent shadow-none ring-transparent",
        )}
        style={{ width, height, borderRadius: radius, x: shift }}
        onKeyDown={onSurfaceKeyDown}
      >
        <AnimatePresence initial={false}>
          {!open && (
            <FaceLayer key="button" id="button" delay={0.12} reduced={reduced} onSize={onSize}>
              <button
                type="button"
                data-trigger=""
                aria-label="Settings"
                aria-haspopup="dialog"
                aria-expanded={false}
                onClick={openPanel}
                className={iconButton}
              >
                <GearSixIcon className={iconGlyph} aria-hidden="true" />
              </button>
            </FaceLayer>
          )}
          {open && (
            <FaceLayer key="panel" id="panel" delay={0.06} reduced={reduced} onSize={onSize} className="w-[min(17.5rem,calc(100vw-2rem))] p-3">
              <div role="dialog" aria-label="Settings" className="flex flex-col gap-4">
                <Section title="Theme">
                  <div ref={themeRef}>
                    <SegmentedControl
                      label="Theme"
                      options={themeOptions}
                      value={preference}
                      onValueChange={changeTheme}
                      className={fillSegments}
                    />
                  </div>
                </Section>
                <Section title="Accent">
                  <AccentPicker value={accent} onValueChange={setAccent} />
                </Section>
                <Section title="Motion">
                  <SegmentedControl
                    label="Animation speed"
                    options={speedOptions}
                    value={String(speed)}
                    onValueChange={value => setMotionSpeed(Number(value))}
                    className={cn(fillSegments, "[&_button]:text-xs")}
                  />
                  <div className="mt-1.5">
                    <Switch label="Reduce motion" checked={reduced} onCheckedChange={changeReduce} />
                  </div>
                </Section>
              </div>
            </FaceLayer>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
