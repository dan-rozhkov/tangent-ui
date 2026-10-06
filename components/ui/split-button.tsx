"use client"

import { isValidElement, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties, ReactNode, RefObject } from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cva } from "class-variance-authority"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import type { TargetAndTransition } from "motion/react"
import { ChevronDown } from "lucide-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface SplitButtonAction {
  label: string
  onSelect?: () => void
  disabled?: boolean
  destructive?: boolean
  icon?: ReactNode
}
export interface SplitButtonProps {
  label: string
  actions: SplitButtonAction[]
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  variant?: "primary" | "secondary"
}

/* One pill, two actions. The whole pill presses in for the main action; the menu half answers in color only, because the
   positioner measures it on press to place the menu. */
const groupVariants = cva(
  [
    "inline-flex items-stretch border",
    "[transition:transform_var(--duration-spring)_var(--ease-spring)]",
    "has-[>[data-split-primary]:active:not(:disabled)]:[transform:scale(.97)] has-[>[data-split-primary]:active:not(:disabled)]:[transition-duration:var(--duration-instant)] has-[>[data-split-primary]:active:not(:disabled)]:[transition-timing-function:var(--ease-standard)]",
    "motion-reduce:transition-none motion-reduce:[transform:none]!",
  ],
  {
    variants: {
      variant: {
        primary: "rounded-control border-foreground bg-foreground",
        secondary: "rounded-pill border-border bg-surface",
      },
    },
    defaultVariants: { variant: "primary" },
  },
)

const halfBase = [
  "cursor-pointer border-0 [-webkit-tap-highlight-color:transparent]",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),opacity_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
  "disabled:cursor-not-allowed disabled:opacity-52",
].join(" ")

const primaryVariants = cva([halfBase, "relative inline-grid place-items-center font-medium"], {
  variants: {
    variant: {
      primary: [
        "min-h-control-md rounded-l-[calc(var(--radius-control)-1px)] bg-foreground px-4 text-sm text-background",
        "pointer-fine:hover:not-disabled:not-active:bg-[color-mix(in_oklab,var(--foreground)_88%,var(--background))]",
        "active:not-disabled:bg-[color-mix(in_oklab,var(--foreground)_80%,var(--background))]",
      ],
      secondary: [
        "min-h-control-sm min-w-[142px] rounded-l-pill bg-surface px-3 text-xs text-foreground",
        "pointer-fine:hover:not-disabled:not-active:bg-surface-muted",
        "active:not-disabled:bg-[color-mix(in_oklab,var(--surface-muted),var(--border)_55%)]",
      ],
    },
  },
  defaultVariants: { variant: "primary" },
})

const triggerVariants = cva([halfBase, "group/trigger grid place-items-center border-l border-solid"], {
  variants: {
    variant: {
      primary: [
        "min-h-control-md w-[38px] rounded-r-[calc(var(--radius-control)-1px)] border-l-[color-mix(in_oklab,var(--background)_18%,var(--foreground))] bg-foreground text-background",
        "pointer-fine:hover:not-disabled:not-active:not-data-popup-open:bg-[color-mix(in_oklab,var(--foreground)_88%,var(--background))]",
        "active:not-disabled:bg-[color-mix(in_oklab,var(--foreground)_80%,var(--background))] data-popup-open:bg-[color-mix(in_oklab,var(--foreground)_80%,var(--background))]",
      ],
      secondary: [
        "min-h-control-sm w-8 rounded-r-pill border-l-border-subtle bg-surface text-foreground",
        "pointer-fine:hover:not-disabled:not-active:not-data-popup-open:bg-surface-muted",
        "active:not-disabled:bg-[color-mix(in_oklab,var(--surface-muted),var(--border)_55%)] data-popup-open:bg-[color-mix(in_oklab,var(--surface-muted),var(--border)_55%)]",
      ],
    },
  },
  defaultVariants: { variant: "primary" },
})

/* The menu grows from the trigger edge: offset toward the trigger, scale from the positioner's origin, fade quickly; it leaves faster than it arrives.
   Transitions instead of keyframes, so a close that interrupts the open reverses from where the menu is instead of snapping to rest first.
   Base UI waits for the running transitions before it unmounts, so no timing keyframe is needed. */
const menuClass = [
  "[--menu-x:0px] [--menu-y:-5px] data-[side=top]:[--menu-y:5px]",
  "data-[side=left]:[--menu-x:5px] data-[side=left]:[--menu-y:0px] data-[side=right]:[--menu-x:-5px] data-[side=right]:[--menu-y:0px]",
  "max-w-(--available-width) min-w-[min(12rem,var(--available-width))] rounded-panel border border-border bg-surface-raised p-[5px] text-foreground shadow-floating outline-none",
  "origin-(--transform-origin) [transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-spring)_var(--ease-spring)]",
  "data-starting-style:[transform:translate(var(--menu-x),var(--menu-y))_scale(.97)] data-starting-style:opacity-0",
  "data-ending-style:pointer-events-none data-ending-style:[transform:translate(calc(var(--menu-x)*.5),calc(var(--menu-y)*.5))_scale(.985)] data-ending-style:opacity-0",
  "data-ending-style:[transition:opacity_130ms_var(--ease-standard),transform_130ms_var(--ease-standard)]",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_var(--duration-instant)_linear]!",
].join(" ")

/* Highlight follows the pointer and arrow keys instantly, like a native menu. */
const itemClass = [
  "flex min-h-control-sm cursor-pointer items-center gap-[10px] rounded-[calc(var(--radius-panel)-6px)] px-[11px] text-sm outline-none",
  "[transition:opacity_var(--duration-standard)_var(--ease-enter)_calc(min(var(--i,0),4)*35ms),transform_var(--duration-standard)_var(--ease-enter)_calc(min(var(--i,0),4)*35ms)]",
  "in-data-starting-style:[transform:translate(calc(var(--menu-x)*.4),calc(var(--menu-y)*.4))] in-data-starting-style:opacity-0",
  "data-highlighted:bg-surface-muted data-disabled:cursor-default data-disabled:opacity-45 motion-reduce:transition-none",
].join(" ")
const destructiveItemClass = "text-danger data-highlighted:bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))]"

const rest: TargetAndTransition = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
const fadeIn: TargetAndTransition = { ...rest, opacity: 0 }
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }
const glyphIn: TargetAndTransition = { opacity: 0, y: 5, filter: `blur(${motionTokens.blur.soft}px)` }
const glyphOut: TargetAndTransition = {
  opacity: 0,
  y: -4,
  filter: `blur(${motionTokens.blur.subtle}px)`,
  transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
}
const iconIn: TargetAndTransition = { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }
const iconOut: TargetAndTransition = {
  ...iconIn,
  transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
}
/** Scale rides the spring; opacity and blur tween so blur never overshoots below zero. */
const iconEnter = {
  ...motionTokens.spring.snappy,
  opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] },
  filter: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] },
} as const

/** Names the icon element, so swapping Copy for Check morphs while a re-render of the same icon stays still. */
function iconKey(node: ReactNode): string {
  if (!isValidElement(node)) return node == null || typeof node === "boolean" ? "" : String(node)
  const type = node.type as string | { displayName?: string; name?: string }
  return typeof type === "string" ? type : (type?.displayName ?? type?.name ?? "icon")
}

/** Springs the slot to the natural width of its content when the label changes; other resizes (a late web font) jump. */
function useMorphWidth(content: RefObject<HTMLElement | null>, key: string, reduced: boolean) {
  const width = useMotionValue<number | "auto">("auto")
  const lastKey = useRef(key)
  const armedUntil = useRef(0)
  useLayoutEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    armedUntil.current = performance.now() + 700
  }, [key])
  useEffect(() => {
    const node = content.current
    const slot = node?.parentElement
    if (!node || !slot || typeof ResizeObserver === "undefined") return
    let measured = false
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width
      if (!next || !measured || reduced || performance.now() > armedUntil.current) {
        measured = next > 0
        width.jump(next || "auto")
        delete slot.dataset.morphing
        return
      }
      slot.dataset.morphing = ""
      animate(width, next, { ...motionTokens.spring.morph, onComplete: () => void delete slot.dataset.morphing })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [content, reduced, width])
  return width
}

type Glyph = { id: string; char: string; order: number }
const toGlyphs = (chars: string[], seq: number): Glyph[] =>
  chars.map((char, order) => ({ id: `${seq}:${order}`, char, order }))

/** Shared leading and trailing characters keep their identity, so "Copy page" to "Copied" only replaces the changed letters. */
function useGlyphs(text: string) {
  const [state, setState] = useState(() => ({ text, seq: 0, glyphs: toGlyphs([...text], 0) }))
  if (state.text === text) return state.glyphs
  const prev = [...state.text]
  const next = [...text]
  let start = 0
  let end = 0
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++
  while (
    end < prev.length - start &&
    end < next.length - start &&
    prev[prev.length - 1 - end] === next[next.length - 1 - end]
  )
    end++
  if (start < 2) start = 0
  if (end < 2) end = 0
  const seq = state.seq + 1
  const glyphs = [
    ...state.glyphs.slice(0, start),
    ...toGlyphs(next.slice(start, next.length - end), seq),
    ...state.glyphs.slice(state.glyphs.length - end),
  ]
  setState({ text, seq, glyphs })
  return glyphs
}

function MorphText({ text, reduced }: { text: string; reduced: boolean }) {
  const glyphs = useGlyphs(text)
  return (
    <span className="relative inline-flex flex-none whitespace-pre">
      <AnimatePresence mode="popLayout" initial={false}>
        {glyphs.map(glyph => (
          <motion.span
            key={glyph.id}
            className="inline-block"
            layout={reduced ? false : "position"}
            layoutDependency={text}
            initial={reduced ? fadeIn : glyphIn}
            animate={rest}
            exit={reduced ? fadeOut : glyphOut}
            transition={
              reduced
                ? { duration: motionTokens.duration.instant }
                : {
                    duration: motionTokens.duration.standard,
                    ease: [...motionTokens.ease.enter],
                    delay: Math.min(glyph.order * motionTokens.stagger.char, 0.1),
                    layout: motionTokens.spring.morph,
                  }
            }
          >
            {glyph.char}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  )
}

/** The main action morphs its icon and label in place while its width follows on a spring; the menu half never scales, so the menu opens from a still anchor. */
export function SplitButton({ label, actions, onClick, disabled, icon, variant = "primary" }: SplitButtonProps) {
  const reduced = useReducedMotion() ?? false
  const contentRef = useRef<HTMLSpanElement>(null)
  const glyph = iconKey(icon)
  const width = useMorphWidth(contentRef, `${glyph}|${label}`, reduced)
  return (
    <MenuPrimitive.Root>
      <div className={groupVariants({ variant })}>
        <button
          className={primaryVariants({ variant })}
          data-split-primary=""
          type="button"
          onClick={onClick}
          disabled={disabled}
        >
          {/* The slot springs to the width of the next label; the content leads from the start edge and is clipped only while it morphs. */}
          <motion.span
            className="inline-flex min-w-0 items-center data-morphing:[clip-path:inset(-50%_calc(var(--space-2)*-1))]"
            style={{ width }}
            aria-hidden="true"
          >
            <span ref={contentRef} className="inline-flex flex-none items-center gap-2 whitespace-nowrap">
              {icon ? (
                <span className="inline-grid flex-none place-items-center">
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={glyph}
                      className="inline-flex items-center justify-center [grid-area:1/1]"
                      initial={reduced ? fadeIn : iconIn}
                      animate={rest}
                      exit={reduced ? fadeOut : iconOut}
                      transition={reduced ? { duration: motionTokens.duration.instant } : iconEnter}
                    >
                      {icon}
                    </motion.span>
                  </AnimatePresence>
                </span>
              ) : null}
              <MorphText text={label} reduced={reduced} />
            </span>
          </motion.span>
          <span className="sr-only" aria-live="polite">
            {label}
          </span>
        </button>
        <MenuPrimitive.Trigger
          className={triggerVariants({ variant })}
          type="button"
          aria-label={`${label} more actions`}
          disabled={disabled}
        >
          <ChevronDown
            className="[transition:rotate_var(--duration-spring)_var(--ease-spring)] group-data-popup-open/trigger:rotate-180 motion-reduce:transition-none"
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </MenuPrimitive.Trigger>
      </div>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner className="z-60" sideOffset={4} align="end" collisionPadding={12}>
          <MenuPrimitive.Popup className={menuClass}>
            {actions.map((action, index) => (
              <MenuPrimitive.Item
                key={action.label}
                className={cn(itemClass, action.destructive && destructiveItemClass)}
                style={{ "--i": index } as CSSProperties}
                disabled={action.disabled}
                onClick={action.onSelect}
              >
                {action.icon ? (
                  <span className="inline-flex" aria-hidden="true">
                    {action.icon}
                  </span>
                ) : null}
                {action.label}
              </MenuPrimitive.Item>
            ))}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

export default SplitButton
