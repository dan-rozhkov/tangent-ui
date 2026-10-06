"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import type { PanInfo, Transition } from "motion/react"
import { X } from "lucide-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

/** Mirrors the open state so the panel can stay mounted while it slides out, retarget mid-flight, and close itself after a drag. */
const DrawerContext = createContext<{
  open: boolean
  flung: boolean
  setOpen: (open: boolean) => void
  fling: () => void
  openedAt: RefObject<number>
} | null>(null)

type ChangeDetails = DialogPrimitive.Root.ChangeEventDetails

export interface DrawerProps extends Omit<DialogPrimitive.Root.Props, "onOpenChange"> {
  /** Called when the drawer opens or closes. A drag that dismisses the panel has no Base UI event, so it passes no details. */
  onOpenChange?: (open: boolean, eventDetails?: ChangeDetails) => void
}

export function Drawer({ open: openProp, defaultOpen = false, onOpenChange, ...props }: DrawerProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  // A drag that dismisses the panel hands its velocity to the exit spring; every other close uses the shorter tween.
  const [flung, setFlung] = useState(false)
  // When the drawer last opened, so a click that reopens it mid-close is not also read as a click outside the leaving panel.
  const openedAt = useRef(0)
  const open = openProp ?? uncontrolled
  const commit = useCallback(
    (next: boolean, details?: ChangeDetails) => {
      setFlung(false)
      if (next) openedAt.current = performance.now()
      if (openProp === undefined) setUncontrolled(next)
      onOpenChange?.(next, details)
    },
    [openProp, onOpenChange],
  )
  const onRootChange = useCallback(
    (next: boolean, details: ChangeDetails) => {
      // Base UI reads a press outside when it completes, so the press that reopens a closing drawer would dismiss it again.
      if (!next && details.reason === "outside-press" && details.event.timeStamp < openedAt.current) {
        details.cancel()
        return
      }
      commit(next, details)
    },
    [commit],
  )
  const setOpen = useCallback((next: boolean) => commit(next), [commit])
  const fling = useCallback(() => {
    setOpen(false)
    setFlung(true)
  }, [setOpen])
  const value = useMemo(() => ({ open, flung, setOpen, fling, openedAt }), [open, flung, setOpen, fling])
  return (
    <DrawerContext.Provider value={value}>
      <DialogPrimitive.Root {...props} open={open} onOpenChange={onRootChange} />
    </DrawerContext.Provider>
  )
}

export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close

export interface DrawerContentProps extends Omit<DialogPrimitive.Popup.Props, "title" | "children" | "className"> {
  title: string
  description?: string
  children: ReactNode
  className?: string
  side?: "left" | "right" | "top" | "bottom"
  /** Renders the drawer inside this element instead of the page body, anchored to its edges. The element needs position: relative and overflow: hidden. */
  container?: HTMLElement | null
}

const fade: Transition = { duration: motionTokens.duration.instant }
/* A click or Escape returns the panel quickly; a flick keeps its velocity in a spring of the same length. The shadow fades over the last stretch so it leaves with the panel instead of popping away at unmount. */
const shadowOut: Transition = { duration: motionTokens.duration.standard, times: [0, 0.65, 1], ease: "linear" }
const leave: Transition = { default: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] }, opacity: shadowOut }
const flingOut: Transition = { default: { ...motionTokens.spring.smooth, visualDuration: motionTokens.duration.standard }, opacity: shadowOut }

/** When the title or description changes while open, the new copy rises in and the old copy leaves upward. */
function SwapText({ text }: { text: string }) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={text}
        // The copy sets its own line height so a page-level heading rule cannot squeeze the title.
        className="block leading-body"
        initial={reduced ? false : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={
          reduced
            ? { opacity: 0, transition: { duration: 0 } }
            : {
                opacity: 0,
                y: "-0.3em",
                filter: `blur(${motionTokens.blur.subtle}px)`,
                transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
              }
        }
        transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  )
}

/* While a layer leaves it lets clicks through, so pressing the trigger again during the close reopens the drawer from wherever it is.
   Inside a container the layers anchor to that element instead of the viewport. */
const overlayClass = [
  "fixed inset-0 z-50 bg-[oklch(10%_0_0/.38)] backdrop-blur-[4px] data-closed:pointer-events-none!",
  "data-contained:absolute data-contained:z-1 data-contained:bg-[oklch(10%_0_0/.16)] data-contained:backdrop-blur-none",
].join(" ")

const contentClass = [
  "[--drawer-size:min(30rem,calc(100vw-var(--space-4)))] max-sm:[--drawer-size:calc(100vw-var(--space-3))]",
  "fixed z-51 flex w-(--drawer-size) max-w-screen max-h-dvh flex-col overflow-hidden",
  "border border-border bg-surface-raised text-foreground shadow-floating outline-none data-closed:pointer-events-none!",
  "data-[side=right]:inset-[0_0_0_auto] data-[side=right]:[border-width:1px_0_1px_1px] data-[side=right]:rounded-[22px_0_0_22px] max-sm:data-[side=right]:rounded-[18px_0_0_18px]",
  "data-[side=left]:inset-[0_auto_0_0] data-[side=left]:[border-width:1px_1px_1px_0] data-[side=left]:rounded-[0_22px_22px_0] max-sm:data-[side=left]:rounded-[0_18px_18px_0]",
  "data-[side=top]:inset-[0_0_auto] data-[side=top]:w-full data-[side=top]:max-w-none data-[side=top]:max-h-[min(32rem,100dvh)] data-[side=top]:[border-width:0_0_1px] data-[side=top]:rounded-[0_0_22px_22px] max-sm:data-[side=top]:rounded-[0_0_18px_18px]",
  "data-[side=bottom]:inset-[auto_0_0] data-[side=bottom]:w-full data-[side=bottom]:max-w-none data-[side=bottom]:max-h-[min(32rem,100dvh)] data-[side=bottom]:[border-width:1px_0_0] data-[side=bottom]:rounded-[22px_22px_0_0] max-sm:data-[side=bottom]:rounded-[18px_18px_0_0]",
  // A grabber on the bottom sheet.
  "data-[side=bottom]:before:absolute data-[side=bottom]:before:top-[9px] data-[side=bottom]:before:left-1/2 data-[side=bottom]:before:h-1 data-[side=bottom]:before:w-9",
  "data-[side=bottom]:before:-translate-x-1/2 data-[side=bottom]:before:rounded-pill data-[side=bottom]:before:bg-border-strong data-[side=bottom]:before:opacity-75 data-[side=bottom]:before:content-['']",
  // The container already draws the outer edges, so only the inner edge keeps a border.
  "data-contained:absolute data-contained:z-2 data-contained:max-h-full data-contained:shadow-none data-contained:[--drawer-size:min(22rem,calc(100%-var(--space-8)))]",
  "data-contained:data-[side=top]:max-h-[min(32rem,calc(100%-var(--space-8)))] data-contained:data-[side=bottom]:max-h-[min(32rem,calc(100%-var(--space-8)))]",
  "data-contained:data-[side]:border-0 data-contained:data-[side=right]:border-l data-contained:data-[side=left]:border-r data-contained:data-[side=top]:border-b data-contained:data-[side=bottom]:border-t",
].join(" ")

/* Motion springs the panel from its edge. These transitions only run when DrawerContent sits under a bare Base UI root. */
const overlayFallback = [
  "[transition:opacity_var(--duration-standard)_var(--ease-enter)] data-starting-style:opacity-0",
  "data-ending-style:opacity-0 data-ending-style:[transition:opacity_var(--duration-fast)_var(--ease-standard)]",
  "motion-reduce:[transition:opacity_var(--duration-instant)_linear]! motion-reduce:data-ending-style:[transition:opacity_100ms_linear]!",
].join(" ")
const contentFallback = [
  // Critically damped, like a sheet spring: it never overshoots past the edge it is anchored to.
  "[--drawer-from:translateX(100%)] data-[side=left]:[--drawer-from:translateX(-100%)] data-[side=top]:[--drawer-from:translateY(-100%)] data-[side=bottom]:[--drawer-from:translateY(100%)]",
  "[transition:transform_var(--duration-considered)_cubic-bezier(.32,.72,0,1)] data-starting-style:[transform:var(--drawer-from)]",
  // The late fade lets the floating shadow leave with the panel instead of popping away at unmount.
  "data-ending-style:[transform:var(--drawer-from)] data-ending-style:opacity-0",
  "data-ending-style:[transition:transform_var(--duration-standard)_var(--ease-standard),opacity_calc(var(--duration-standard)*.35)_linear_calc(var(--duration-standard)*.65)]",
  "motion-reduce:[transform:none]! motion-reduce:data-starting-style:opacity-0 motion-reduce:[transition:opacity_var(--duration-instant)_linear]! motion-reduce:data-ending-style:[transition:opacity_100ms_linear]!",
].join(" ")

/* Centered on the first line of the title rather than its top edge. */
const closeClass = [
  "mt-[calc((var(--text-lg)*var(--leading-body)-var(--space-8))/2)] grid size-8 flex-none cursor-pointer place-items-center",
  "rounded-control border border-border bg-[color-mix(in_oklab,var(--surface-muted)_65%,transparent)] text-text-secondary",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
  "pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
  "active:[transform:scale(.96)] active:[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)]",
  "motion-reduce:transition-none! motion-reduce:active:[transform:none]",
].join(" ")

export function DrawerContent({ title, description, children, side = "right", container, className, ...props }: DrawerContentProps) {
  const drawer = useContext(DrawerContext)
  const reduced = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const offset = useMotionValue<number | string>(0)
  const pan = useRef<number | null>(null)
  const axis = side === "left" || side === "right" ? "x" : "y"
  const sign = side === "right" || side === "bottom" ? 1 : -1
  const offscreen = { [axis]: `${sign * 100}%` }
  const classes = cn(contentClass, className)
  const draggable = drawer !== null && !reduced
  const contained = container ? "" : undefined

  const panelSize = () => (axis === "x" ? panelRef.current?.offsetWidth : panelRef.current?.offsetHeight) ?? 480

  // The header is the grab handle. It follows the pointer toward the edge and rubber-bands the other way.
  function panStart(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : null
    if (!draggable || target?.closest("button, a, input, select, textarea, [role='button']")) return
    // The entrance animates in percent of the panel, so a grab mid-flight converts it to pixels.
    const value = offset.get()
    pan.current = typeof value === "number" ? value : (parseFloat(value) / 100) * panelSize()
    offset.stop()
  }
  function panMove(_: PointerEvent, info: PanInfo) {
    if (pan.current === null) return
    const toward = (pan.current + info.offset[axis]) * sign
    offset.set(sign * (toward >= 0 ? toward : -Math.sqrt(-toward)))
  }
  // Past a third of the panel, or on a quick flick toward the edge, the drawer closes and keeps its velocity; otherwise it springs back.
  function panEnd(_: PointerEvent, info: PanInfo) {
    if (pan.current === null) return
    pan.current = null
    const toward = Number(offset.get()) * sign
    if (toward > panelSize() / 3 || (toward > 0 && info.velocity[axis] * sign > 500)) drawer?.fling()
    else animate(offset, 0, motionTokens.spring.snappy)
  }

  const inner = (
    <>
      {/* The header doubles as the drag handle, so touch drags move the panel instead of the page. */}
      <motion.div
        className={cn(
          "flex flex-none items-start justify-between gap-5 border-b border-border p-6 max-sm:p-5",
          draggable && "touch-none select-none in-data-[side=bottom]:cursor-grab in-data-[side=top]:cursor-grab",
        )}
        onPanStart={panStart}
        onPan={panMove}
        onPanEnd={panEnd}
      >
        <div>
          <DialogPrimitive.Title className="relative m-0 font-body text-lg leading-body font-medium tracking-body">
            <SwapText text={title} />
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="relative mt-2 mb-0 max-w-lg text-sm leading-body text-text-secondary">
              <SwapText text={description} />
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <DialogPrimitive.Close className={closeClass} aria-label="Close drawer">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </DialogPrimitive.Close>
      </motion.div>
      <div className="min-h-0 overflow-auto overscroll-contain p-6 text-sm leading-body [scrollbar-width:thin] max-sm:p-5">{children}</div>
    </>
  )

  // Under a bare Base UI root the open state is unknown here, so CSS transitions keyed off data-starting-style animate the layers instead.
  if (drawer === null) {
    return (
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Backdrop className={cn(overlayClass, overlayFallback)} data-contained={contained} />
        <DialogPrimitive.Popup {...props} data-side={side} data-contained={contained} className={cn(classes, contentFallback)}>
          {inner}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    )
  }

  // The panel springs fully opaque from its own edge and returns to it faster than it arrived, from wherever it is.
  // Base UI waits for the opacity keyframes of the exit before it hides the panel, so the portal stays mounted for the whole slide.
  return (
    <AnimatePresence custom={drawer.flung}>
      {drawer.open && (
        <DialogPrimitive.Portal key="drawer" keepMounted container={container}>
          <DialogPrimitive.Backdrop
            className={overlayClass}
            data-contained={contained}
            render={
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: reduced ? fade : { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
                }}
                transition={reduced ? fade : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
              />
            }
          />
          <DialogPrimitive.Popup
            {...props}
            ref={panelRef}
            className={classes}
            data-side={side}
            data-contained={contained}
            render={
              <motion.div
                style={{ [axis]: offset }}
                variants={{
                  exit: (flung: boolean) =>
                    reduced ? { opacity: 0, transition: fade } : { ...offscreen, opacity: [1, 1, 0], transition: flung ? flingOut : leave },
                }}
                initial={reduced ? { opacity: 0 } : { ...offscreen, opacity: 1 }}
                animate={reduced ? { opacity: 1 } : { [axis]: 0, opacity: 1 }}
                exit="exit"
                transition={reduced ? fade : motionTokens.spring.smooth}
              />
            }
          >
            {inner}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  )
}

export default Drawer
