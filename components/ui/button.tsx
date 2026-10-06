"use client"

import { forwardRef, isValidElement, useCallback, useEffect, useLayoutEffect, useRef } from "react"
import type { ComponentProps, ReactNode, Ref, RefObject } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useReducedMotion } from "motion/react"
import type { TargetAndTransition, Variants } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

/* Press scale is driven by Motion (whileTap) alone, so transform never gets a CSS transition here.
   Anchors of floating layers never scale: the layer would measure a shrunken trigger. */
const buttonVariants = cva(
  [
    "relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border border-transparent px-4",
    "text-sm leading-body font-medium whitespace-nowrap [-webkit-tap-highlight-color:transparent]",
    "transition-[color,background,border-color,opacity,box-shadow] duration-160 ease-standard motion-reduce:transition-none",
    "disabled:cursor-not-allowed disabled:opacity-52 aria-busy:cursor-progress",
    "[&:is([aria-haspopup]:not([aria-haspopup=false]),[data-popup-open],[role=combobox])]:transform-none!",
  ],
  {
    variants: {
      variant: {
        primary:
          "border-foreground bg-foreground text-background pointer-fine:hover:not-disabled:opacity-91 pointer-fine:hover:not-disabled:shadow-resting active:not-disabled:opacity-84",
        secondary:
          "border-border bg-surface text-foreground pointer-fine:hover:not-disabled:bg-surface-muted pointer-fine:hover:not-disabled:shadow-resting active:not-disabled:bg-surface-muted",
        ghost:
          "bg-transparent text-text-secondary pointer-fine:hover:not-disabled:bg-surface-muted pointer-fine:hover:not-disabled:text-foreground active:not-disabled:bg-surface-muted active:not-disabled:text-foreground",
        danger:
          "border-border bg-surface text-danger pointer-fine:hover:not-disabled:border-danger pointer-fine:hover:not-disabled:bg-surface-muted active:not-disabled:border-danger active:not-disabled:bg-surface-muted",
      },
      size: {
        sm: "min-h-control-sm px-3",
        md: "min-h-control-md",
        lg: "min-h-control-lg px-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

export interface ButtonProps
  extends Omit<ComponentProps<"button">, "ref" | "onDrag" | "onDragEnd" | "onDragStart" | "onAnimationStart">,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

/** Icon buttons press a little deeper, wide buttons a little less, so every size reads as the same push. */
const pressVariants: Variants = {
  pressed: (button: RefObject<HTMLButtonElement | null>) => {
    const width = button.current?.offsetWidth ?? 0
    return {
      scale: width > 220 ? 0.985 : width && width <= 48 ? 0.96 : 0.97,
      transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
    }
  },
}

const rest: TargetAndTransition = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
/** Text rises about .3em out of a soft blur; the outgoing label lifts away a little faster. */
const textIn: TargetAndTransition = { opacity: 0, y: 4, filter: `blur(${motionTokens.blur.soft}px)` }
const textOut: TargetAndTransition = {
  opacity: 0,
  y: -3,
  filter: `blur(${motionTokens.blur.soft}px)`,
  transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
}
const iconIn: TargetAndTransition = { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }
const iconOut: TargetAndTransition = {
  opacity: 0,
  scale: 0.6,
  filter: `blur(${motionTokens.blur.subtle}px)`,
  transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
}
const fadeIn: TargetAndTransition = { ...rest, opacity: 0 }
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }
/** Scale rides the spring; opacity and blur tween so blur never overshoots below zero. */
const iconEnter = {
  ...motionTokens.spring.snappy,
  opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] },
  filter: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] },
} as const

/** A key for the label content: text plus element names, so a new label or icon crossfades while prop-only updates stay in place. */
function labelKey(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") return String(node)
  if (Array.isArray(node)) return node.map(labelKey).join("")
  if (!isValidElement(node)) return ""
  const type = node.type as string | { displayName?: string; name?: string }
  return `<${typeof type === "string" ? type : (type?.displayName ?? type?.name ?? "")}>${labelKey((node.props as { children?: ReactNode }).children)}`
}

/** Springs the slot to the natural width of the incoming label when it changes, so a new label never snaps the button's size.
 *  Other resizes (a late web font, a parent reflow) jump straight to the new width, so nothing wobbles on first paint. */
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

function LabelPhase({ children, icon, reduced, ref }: { children: ReactNode; icon: boolean; reduced: boolean; ref?: Ref<HTMLSpanElement> }) {
  const present = useIsPresent()
  return (
    <motion.span
      ref={ref}
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap [&_svg]:flex-none"
      aria-hidden={present ? undefined : true}
      initial={reduced ? fadeIn : icon ? iconIn : textIn}
      animate={rest}
      exit={reduced ? fadeOut : icon ? iconOut : textOut}
      transition={
        reduced
          ? { duration: motionTokens.duration.instant }
          : icon
            ? iconEnter
            : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
      }
    >
      {children}
    </motion.span>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading = false, disabled, children, onClick, ...props },
  ref,
) {
  const reduceMotion = useReducedMotion() ?? false
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const contentRef = useRef<HTMLSpanElement>(null)
  const key = labelKey(children)
  const width = useMorphWidth(contentRef, key, reduceMotion)
  const setRefs = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )
  // A trigger that anchors a menu, popover, or dialog keeps its rect still while pressed, so the layer never measures a scaled anchor.
  const popup = props["aria-haspopup"]
  const anchorsLayer = (popup !== undefined && popup !== false && popup !== "false") || props.role === "combobox"
  const inert = disabled || loading || props["aria-disabled"] === true || props["aria-disabled"] === "true"

  return (
    <ButtonPrimitive
      ref={setRefs}
      // Loading keeps the button focusable (a disabled button would drop keyboard focus mid-action) and swallows presses instead.
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={onClick}
      {...props}
      render={
        <motion.button
          custom={buttonRef}
          variants={pressVariants}
          whileTap={reduceMotion || anchorsLayer || inert ? undefined : "pressed"}
          transition={motionTokens.spring.snappy}
        />
      }
    >
      <AnimatePresence initial={false}>
        {loading ? (
          <motion.span
            key="loader"
            className="absolute top-1/2 left-1/2 -m-2 grid size-4"
            aria-hidden="true"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? fadeOut : { ...iconOut, scale: 0.8 }}
            transition={reduceMotion ? { duration: motionTokens.duration.instant } : iconEnter}
          >
            <span className="animate-spin rounded-full border-[1.5px] border-current border-r-transparent [animation-duration:.7s] motion-reduce:animate-none" />
          </motion.span>
        ) : null}
      </AnimatePresence>
      <motion.span
        className={cn(
          "relative inline-flex min-w-0 items-center justify-center transition-opacity duration-160 ease-standard",
          "data-morphing:[clip-path:inset(-50%_calc(var(--space-3)*-1))]",
          loading && "opacity-0",
        )}
        style={{ width }}
      >
        <span ref={contentRef} className="inline-flex flex-none items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <LabelPhase key={key} icon={!/\S/.test(key.replace(/<[^>]*>/g, ""))} reduced={reduceMotion}>
              {children}
            </LabelPhase>
          </AnimatePresence>
        </span>
      </motion.span>
    </ButtonPrimitive>
  )
})

Button.displayName = "Button"

export { buttonVariants }
export default Button
