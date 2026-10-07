"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { ButtonHTMLAttributes, ReactNode, Ref, PointerEvent as ReactPointerEvent } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AnimatePresence, animate, motion, useMotionValue, usePresence, useTransform } from "motion/react"
import type { MotionValue } from "motion/react"
import { CaretLeftIcon, XIcon } from "@phosphor-icons/react"

import { buttonVariants } from "@/components/ui/button"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"
import { axisVelocity, clamp, rubberBand, unRubberBand } from "@/lib/gesture"

export type DrillPresentation = "auto" | "sheet" | "dialog"

export interface DrillSheetsProps {
  /** Page content, triggers, and DrillSheet declarations. */
  children: ReactNode
  /** Controlled ids of the open levels, outermost first. Leave undefined for uncontrolled use. */
  path?: string[]
  /** Levels open at first when uncontrolled. */
  defaultPath?: string[]
  /** Called when a level is opened or left. */
  onPathChange?: (path: string[]) => void
  /** auto picks bottom sheets below breakpoint and centered dialogs above it. */
  presentation?: DrillPresentation
  /** Width in px of the viewport, or the host when inline, where auto switches to dialogs. */
  breakpoint?: number
  /** Fill the nearest positioned ancestor instead of the viewport. */
  inline?: boolean
}

export interface DrillSheetProps {
  /** Id used by open, backTo, DrillTrigger, and the path array. */
  id: string
  /** Heading and accessible name. */
  title: string
  /** A line under the title, wired as the dialog description. */
  subtitle?: string
  /** Scrolling body content. */
  children: ReactNode
  /** A row pinned under the scrolling body, such as the primary action. */
  actions?: ReactNode
  /** Label for the back button of a sheet opened from this one. Defaults to title. */
  returnLabel?: string
  /** Allow drag and fling to dismiss. */
  swipeable?: boolean
  className?: string
  ref?: Ref<HTMLDivElement>
}

export interface DrillTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Id of the sheet to open. */
  to: string
  ref?: Ref<HTMLButtonElement>
}

export interface DrillApi {
  path: string[]
  open: (id: string) => void
  back: () => void
  backTo: (id: string) => void
  dismiss: () => void
}

interface Meta {
  title: string
  backLabel?: string
}

/** Titles of declared sheets, so a child sheet can name the one its back button returns to. */
function createMetaStore() {
  const metas = new Map<string, Meta>()
  const listeners = new Set<() => void>()
  return {
    get: (id: string | undefined) => (id ? metas.get(id) : undefined),
    set(id: string, meta: Meta) {
      const previous = metas.get(id)
      if (previous?.title === meta.title && previous?.backLabel === meta.backLabel) return
      metas.set(id, meta)
      listeners.forEach(listener => listener())
    },
    delete(id: string) {
      if (metas.delete(id)) listeners.forEach(listener => listener())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}

interface StackContextValue {
  stack: string[]
  push: (id: string) => void
  pop: () => void
  popTo: (id: string) => void
  close: () => void
  layer: HTMLDivElement | null
  wide: boolean
  contained: boolean
  /** How far the top sheet has been dragged toward dismissal, 0 to 1. The sheets below ease back up with it. */
  pull: MotionValue<number>
  layerHeight: MotionValue<number>
  /** Height of the top sheet, springing when the top changes, so the sheets below always peek above it. */
  topHeight: MotionValue<number>
  heights: Map<string, MotionValue<number>>
  metas: ReturnType<typeof createMetaStore>
}

const StackContext = createContext<StackContextValue | null>(null)

/** Returns { path, open, back, backTo, dismiss } for buttons inside or beside the sheets. Throws outside DrillSheets. */
export function useDrill(): DrillApi {
  const context = useContext(StackContext)
  if (!context) throw new Error("useDrill must be used inside DrillSheets.")
  return { path: context.stack, open: context.push, back: context.pop, backTo: context.popTo, dismiss: context.close }
}

/** Room each level gives up so the sheet below can peek above it. */
const PEEK = { sheet: 10, dialog: 14 }
/** Space kept above the tallest sheet, and around a dialog. */
const TOP_GAP = 24
const DIALOG_MARGIN = 24
/** Each level below the top scales back this much. */
const SHRINK = 0.05
/** Past this share of its height, or a fling faster than FLICK px/s, a drag pops the sheet. */
const DISMISS = 0.35
const FLICK = 450
/** Upward drags approach this many px. */
const STRETCH = 40
/** Travel below the edge that hides the floating shadow as well as the sheet. */
const CLOSED_GAP = 40
/** A dialog rises this many px as it fades in, and sinks this far as it fades out. */
const DIALOG_LIFT = 18
/** A dialog starts slightly small and leaves slightly smaller, so the exit reads as falling back. */
const DIALOG_ENTER_SCALE = 0.98
const DIALOG_EXIT_SCALE = 0.97

type Bezier = [number, number, number, number]
/** Transitions derived from the motion tokens; recomputed only when the tokens change. */
function useSheetMotion() {
  const motionTokens = useMotionTokens()
  const motion = useMemo(
    () => ({
      motionTokens,
      leave: { ...motionTokens.spring.smooth, visualDuration: 0.3 },
      fade: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as Bezier },
      /** Dialogs vanish quickly; their transform keeps settling underneath the fade. */
      vanish: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] as Bezier },
    }),
    [motionTokens],
  )
  /** Effects and callbacks read this, so a retune changes later animations without re-running them. */
  const latest = useRef(motion)
  useLayoutEffect(() => {
    latest.current = motion
  }, [motion])
  return { ...motion, latest }
}

/** Holds the path of open levels and renders the layer they appear in. Declare every DrillSheet inside one DrillSheets. */
export function DrillSheets({ children, path: stackProp, defaultPath = [], onPathChange, presentation = "auto", breakpoint = 720, inline: contained = false }: DrillSheetsProps) {
  const { motionTokens, fade, latest } = useSheetMotion()
  const [inner, setInner] = useState(defaultPath)
  const stack = stackProp ?? inner
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const [layerWidth, setLayerWidth] = useState(0)
  const [metas] = useState(createMetaStore)
  const [heights] = useState(() => new Map<string, MotionValue<number>>())
  const openers = useRef(new Map<string, HTMLElement | null>())
  const pull = useMotionValue(0)
  const layerHeight = useMotionValue(0)
  const topHeight = useMotionValue(0)
  const wide = presentation === "dialog" || (presentation === "auto" && layerWidth >= breakpoint)

  // The layer is measured, not the window, so a contained stack switches on its own width.
  useLayoutEffect(() => {
    if (!layer) return
    layerHeight.set(layer.clientHeight)
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      setLayerWidth(layer.clientWidth)
      layerHeight.set(layer.clientHeight)
    })
    observer.observe(layer)
    return () => observer.disconnect()
  }, [layer, layerHeight])

  const commit = useCallback(
    (next: string[]) => {
      if (stackProp === undefined) setInner(next)
      onPathChange?.(next)
    },
    [onPathChange, stackProp],
  )

  /** Popping returns focus to whatever opened the sheet, once the sheet below is interactive again. */
  const restoreFocus = useCallback((id: string | undefined) => {
    const opener = id ? openers.current.get(id) : null
    if (!opener) return
    requestAnimationFrame(() => {
      if (opener.isConnected) opener.focus({ preventScroll: true })
    })
  }, [])

  const popTo = useCallback(
    (id: string) => {
      const at = stack.indexOf(id)
      if (at < 0 || at === stack.length - 1) return
      restoreFocus(stack[at + 1])
      commit(stack.slice(0, at + 1))
    },
    [commit, restoreFocus, stack],
  )
  const push = useCallback(
    (id: string) => {
      // Pushing an open id pops back to it.
      if (stack.includes(id)) return popTo(id)
      openers.current.set(id, document.activeElement instanceof HTMLElement ? document.activeElement : null)
      commit([...stack, id])
    },
    [commit, popTo, stack],
  )
  const pop = useCallback(() => {
    if (!stack.length) return
    restoreFocus(stack[stack.length - 1])
    commit(stack.slice(0, -1))
  }, [commit, restoreFocus, stack])
  const close = useCallback(() => {
    if (!stack.length) return
    restoreFocus(stack[0])
    commit([])
  }, [commit, restoreFocus, stack])

  const top = stack[stack.length - 1]
  // The sheets below read the top sheet's height. When the top changes it springs to the new one, then follows it.
  useLayoutEffect(() => {
    const height = top ? heights.get(top) : undefined
    if (!height) return
    let following = false
    let controls: ReturnType<typeof animate> | null = null
    const spring = () => {
      controls = animate(topHeight, height.get(), {
        ...latest.current.motionTokens.spring.smooth,
        onComplete: () => {
          following = true
          topHeight.set(height.get())
        },
      })
    }
    // A newly pushed sheet is measured a commit after it mounts (its popup portals in later), so spring once it has a height.
    if (height.get()) spring()
    const off = height.on("change", value => {
      if (following) topHeight.set(value)
      else if (value) {
        // Re-aim a running spring at the latest height; it keeps its velocity, so it bends rather than restarts.
        controls?.stop()
        spring()
      }
    })
    return () => {
      controls?.stop()
      off()
    }
  }, [heights, latest, top, topHeight])

  // Each sheet has already picked up the drag it was showing; the shared pull starts fresh for the new top.
  useLayoutEffect(() => {
    pull.jump(0)
  }, [pull, stack])

  const value = useMemo<StackContextValue>(
    () => ({ stack, push, pop, popTo, close, layer, wide, contained, pull, layerHeight, topHeight, heights, metas }),
    [close, contained, heights, layer, layerHeight, metas, pop, popTo, pull, push, stack, topHeight, wide],
  )

  return (
    <StackContext.Provider value={value}>
      {children}
      <div ref={setLayer} className={cn(contained ? "absolute" : "fixed", "pointer-events-none inset-0 z-50 overflow-hidden supports-[overflow:clip]:overflow-clip")} data-drill-layer="">
        <motion.div
          aria-hidden="true"
          className={cn(
            // Black at 56% in dark; lighter in light so white sheets do not sit in a hole.
            "absolute inset-0 bg-[oklch(0%_0_0/.32)] dark:bg-[oklch(0%_0_0/.56)]",
            !contained && "backdrop-blur-[4px]",
            stack.length ? "pointer-events-auto" : "pointer-events-none",
          )}
          initial={false}
          animate={{ opacity: stack.length ? 1 : 0 }}
          transition={stack.length ? { duration: 0.2, ease: [...motionTokens.ease.enter] } : fade}
        />
      </div>
    </StackContext.Provider>
  )
}

/** One level of the stack. Renders nothing until its id is pushed. */
export function DrillSheet(props: DrillSheetProps) {
  const context = useContext(StackContext)
  if (!context) throw new Error("DrillSheet must be used inside DrillSheets.")
  const { id, title, returnLabel: backLabel } = props
  const { metas } = context
  useLayoutEffect(() => {
    metas.set(id, { title, backLabel })
  }, [backLabel, id, metas, title])
  useEffect(() => () => metas.delete(id), [id, metas])

  const level = context.stack.indexOf(id)
  return (
    // The sheet stays mounted while it leaves, so a push caught mid-exit reverses from wherever it is.
    <AnimatePresence>
      {level >= 0 && context.layer ? <SheetPanel key={id} {...props} level={level} parent={level > 0 ? context.stack[level - 1] : undefined} /> : null}
    </AnimatePresence>
  )
}

const interactive = "button, a, input, select, textarea, label, summary, [role='button'], [role='slider'], [role='switch'], [contenteditable='true'], [data-drill-no-drag]"

/** Round 36px header buttons on the muted surface. */
const headerButton = [
  "h-9 flex-none cursor-pointer rounded-pill bg-surface-muted text-foreground [-webkit-tap-highlight-color:transparent]",
  "transition-[background-color,color] duration-160 ease-standard pointer-fine:hover:bg-border motion-reduce:transition-none",
].join(" ")

function SheetPanel({ id, title, subtitle: description, children, actions: footer, swipeable: dismissible = true, className, ref, level, parent }: DrillSheetProps & { level: number; parent?: string }) {
  const { latest } = useSheetMotion()
  const context = useContext(StackContext)!
  const { layerHeight, topHeight, pull, heights, wide } = context
  const [isPresent, safeToRemove] = usePresence()
  const reduced = useReducedMotion() ?? false
  const at = context.stack.indexOf(id)
  const isTop = isPresent && at === context.stack.length - 1
  const depth = isPresent && at >= 0 ? context.stack.length - 1 - at : 0
  const parentMeta = useSyncExternalStore(context.metas.subscribe, () => context.metas.get(parent), () => undefined)
  const parentLabel = parentMeta ? (parentMeta.backLabel ?? parentMeta.title) : undefined

  const panelRef = useRef<HTMLDivElement | null>(null)
  /** The popup mounts a commit after this component (the portal creates its node first), so effects that measure or
      listen to it wait for this instead of reading refs that are still empty on their first run. */
  const [panel, setPanelNode] = useState<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const height = useMotionValue(0)
  /** Displayed depth: springs between levels and keeps its velocity when interrupted. */
  const depthValue = useMotionValue(depth)
  /** Entrance, drag, and exit all move this one value, so each retargets from wherever the sheet is. */
  const offset = useMotionValue(wide ? DIALOG_LIFT : 2000)
  const presence = useMotionValue(0)
  /** The scale a dialog grows from on enter and shrinks toward on exit. */
  const edgeScale = useMotionValue(DIALOG_ENTER_SCALE)
  const flung = useRef<number | null>(null)
  const entered = useRef(false)
  const dragState = useRef<{ startY: number; origin: number; samples: { t: number; y: number }[]; moved: boolean } | null>(null)
  const peek = wide ? PEEK.dialog : PEEK.sheet

  const setPanel = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node
      setPanelNode(node)
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  useLayoutEffect(() => {
    heights.set(id, height)
    return () => {
      if (heights.get(id) === height) heights.delete(id)
    }
  }, [height, heights, id])

  // Height follows content on a spring; each level gives up room for the peek, and the body scrolls past that.
  useLayoutEffect(() => {
    const header = headerRef.current
    const content = contentRef.current
    if (!panel || !header || !content) return
    const fit = () => {
      const room = layerHeight.get()
      if (!room) return
      const limit = wide ? room - 2 * (DIALOG_MARGIN + level * peek) : room - TOP_GAP - level * peek
      const borders = panel.offsetHeight - panel.clientHeight
      const natural = header.offsetHeight + content.offsetHeight + (footerRef.current?.offsetHeight ?? 0) + borders
      const target = Math.max(0, Math.min(natural, limit))
      if (!height.get() || reduced) height.jump(target)
      else if (target !== height.get()) animate(height, target, latest.current.motionTokens.spring.smooth)
    }
    fit()
    const off = layerHeight.on("change", fit)
    if (typeof ResizeObserver === "undefined") return off
    const observer = new ResizeObserver(fit)
    observer.observe(header)
    observer.observe(content)
    if (footerRef.current) observer.observe(footerRef.current)
    return () => {
      off()
      observer.disconnect()
    }
  }, [height, latest, layerHeight, level, panel, peek, reduced, wide])

  // Depth changes start from what is on screen, including the drag pull the stack was showing.
  useLayoutEffect(() => {
    if (!isPresent) return
    const current = depthValue.get()
    if (current === depth) return
    depthValue.jump(current - pull.get() * clamp(current, 0, 1))
    if (reduced) depthValue.jump(depth)
    else animate(depthValue, depth, latest.current.motionTokens.spring.smooth)
  }, [depth, depthValue, isPresent, latest, pull, reduced])

  // Enter, leave, and a reopen caught mid-exit all retarget the same values from wherever they are.
  useLayoutEffect(() => {
    const closed = () => (wide ? DIALOG_LIFT : height.get() + CLOSED_GAP)
    if (isPresent) {
      // Wait for the popup and a measured height, so the entrance starts from the real height rather than from zero.
      if (!panel) return
      const enter = () => {
        entered.current = true
        flung.current = null
        if (reduced) {
          offset.jump(0)
          animate(presence, 1, latest.current.fade)
          return
        }
        // A sheet starts exactly one height below its resting place, so it is just out of view.
        if (offset.get() === 2000) offset.jump(height.get())
        if (wide) {
          if (presence.get() === 0) edgeScale.jump(DIALOG_ENTER_SCALE)
          animate(presence, 1, { duration: latest.current.motionTokens.duration.fast, ease: [...latest.current.motionTokens.ease.enter] })
          animate(offset, 0, latest.current.motionTokens.spring.smooth)
        } else {
          presence.jump(1)
          animate(offset, 0, latest.current.motionTokens.spring.smooth)
        }
      }
      if (height.get() > 0) return enter()
      const off = height.on("change", value => {
        if (value <= 0) return
        off()
        enter()
      })
      return off
    }
    // Never entered (removed before it was measured): there is nothing on screen to animate out.
    if (!entered.current) {
      safeToRemove()
      return
    }
    const velocity = flung.current ?? undefined
    if (reduced) {
      animate(presence, 0, { ...latest.current.fade, onComplete: safeToRemove })
      return
    }
    if (wide) {
      // A flung dialog keeps travelling with its velocity while it fades; otherwise it settles back a few pixels.
      const target = velocity ? offset.get() + Math.max(80, velocity * 0.2) : closed()
      edgeScale.jump(DIALOG_EXIT_SCALE)
      animate(offset, target, velocity ? { ...latest.current.leave, velocity } : latest.current.motionTokens.spring.smooth)
      animate(presence, 0, { ...latest.current.vanish, onComplete: safeToRemove })
      return
    }
    animate(offset, closed(), { ...latest.current.leave, ...(velocity === undefined ? null : { velocity }), onComplete: safeToRemove })
  }, [edgeScale, height, isPresent, latest, offset, panel, presence, reduced, safeToRemove, wide])

  /* Everything on screen is one function of the motion values, so drags and depth changes never re-render React. */
  const effective = useTransform(() => {
    const value = depthValue.get()
    return Math.max(0, value - pull.get() * clamp(value, 0, 1))
  })
  const y = useTransform(() => {
    const room = layerHeight.get()
    const own = height.get()
    const shown = reduced ? 0 : effective.get()
    const base = wide ? (room - own) / 2 : room - own
    // Below the top, the sheet moves so its top edge sits one peek above the top sheet's edge.
    const tuck = Math.min(shown, 1) * (own - topHeight.get()) * (wide ? 0.5 : 1) - shown * peek
    return base + (shown > 0 ? tuck : 0) + offset.get()
  })
  const scale = useTransform(() => {
    const depthScale = reduced ? 1 : 1 - SHRINK * effective.get()
    const edge = edgeScale.get()
    const enter = wide && !reduced ? edge + (1 - edge) * presence.get() : 1
    return depthScale * enter
  })
  const opacity = useTransform(() => (wide || reduced ? presence.get() : 1))
  const dim = useTransform(() => clamp(effective.get(), 0, 2) * 0.5)

  const draggable = isTop && dismissible && !reduced

  // A sheet that becomes the top one takes focus, unless focus already sits inside it (a pop restores the opener).
  useEffect(() => {
    if (!isTop || !panel) return
    const frame = requestAnimationFrame(() => {
      if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [isTop, panel])

  const beginDrag = useCallback(
    (clientY: number, time: number) => {
      offset.stop()
      dragState.current = { startY: clientY, origin: offset.get() < 0 ? -unRubberBand(-offset.get(), STRETCH) : offset.get(), samples: [{ t: time, y: clientY }], moved: false }
    },
    [offset],
  )
  const moveDrag = useCallback(
    (clientY: number, time: number) => {
      const state = dragState.current
      if (!state) return false
      const delta = clientY - state.startY
      if (!state.moved && Math.abs(delta) < 4) return false
      state.moved = true
      const raw = state.origin + delta
      // Down follows the pointer; up resists like a rubber band. The sheets below ease back as it goes.
      const next = raw >= 0 ? raw : -rubberBand(-raw, STRETCH)
      offset.set(next)
      pull.set(clamp(next / Math.max(height.get(), 1), 0, 1))
      state.samples.push({ t: time, y: clientY })
      if (state.samples.length > 10) state.samples.shift()
      return true
    },
    [height, offset, pull],
  )
  const endDrag = useCallback(
    (time: number) => {
      const state = dragState.current
      dragState.current = null
      if (!state?.moved) return
      const velocity = axisVelocity(state.samples, time, sample => sample.y, { window: 90 })
      const travelled = offset.get()
      if (travelled > height.get() * DISMISS || (travelled > 0 && velocity > FLICK)) {
        flung.current = Math.max(velocity, 0)
        context.pop()
        return
      }
      animate(offset, 0, { ...latest.current.motionTokens.spring.smooth, velocity: travelled < 0 ? 0 : velocity })
      animate(pull, 0, latest.current.motionTokens.spring.smooth)
    },
    [context, height, latest, offset, pull],
  )

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggable || event.button !== 0 || !event.isPrimary) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest(interactive)) return
    // A drag that starts in a scrolled body scrolls instead; touch drags in the body are handled by the touch listeners below.
    const body = bodyRef.current
    if (body && target && body.contains(target) && (body.scrollTop > 0 || event.pointerType === "touch")) return
    beginDrag(event.clientY, event.timeStamp)
    const panel = event.currentTarget
    const pointer = event.pointerId
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return
      if (moveDrag(next.clientY, next.timeStamp) && !panel.hasPointerCapture(pointer)) {
        try {
          panel.setPointerCapture(pointer)
        } catch {
          /* The pointer is already gone. */
        }
      }
    }
    const up = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      endDrag(next.timeStamp)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  // Touch in the body scrolls the content; only a pull down from its very top moves the sheet.
  useEffect(() => {
    const body = bodyRef.current
    if (!body || !draggable) return
    let gesture: { x: number; y: number; mode: "pending" | "sheet" | "native" } | null = null
    const start = (event: TouchEvent) => {
      const touch = event.touches[0]
      const target = event.target instanceof Element ? event.target : null
      gesture = event.touches.length === 1 && touch && !target?.closest("[data-drill-no-drag]") ? { x: touch.clientX, y: touch.clientY, mode: "pending" } : null
    }
    const move = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!gesture || !touch) return
      const dx = touch.clientX - gesture.x
      const dy = touch.clientY - gesture.y
      if (gesture.mode === "pending") {
        if (Math.hypot(dx, dy) < 4) return
        gesture.mode = Math.abs(dy) > Math.abs(dx) && dy > 0 && body.scrollTop <= 0 ? "sheet" : "native"
        if (gesture.mode === "sheet") beginDrag(gesture.y, event.timeStamp)
      }
      if (gesture.mode !== "sheet") return
      if (event.cancelable) event.preventDefault()
      moveDrag(touch.clientY, event.timeStamp)
    }
    const end = (event: TouchEvent) => {
      if (gesture?.mode === "sheet") endDrag(event.timeStamp)
      gesture = null
    }
    body.addEventListener("touchstart", start, { passive: true })
    body.addEventListener("touchmove", move, { passive: false })
    body.addEventListener("touchend", end)
    body.addEventListener("touchcancel", end)
    return () => {
      body.removeEventListener("touchstart", start)
      body.removeEventListener("touchmove", move)
      body.removeEventListener("touchend", end)
      body.removeEventListener("touchcancel", end)
    }
  }, [beginDrag, draggable, endDrag, moveDrag, panel])

  const onOpenChange = (next: boolean, details: DialogPrimitive.Root.ChangeEventDetails) => {
    if (next) return
    // Only the top sheet answers Escape and outside presses; the ones below wait their turn.
    if (!isTop) {
      details.cancel()
      return
    }
    if (details.reason === "close-press") return context.close()
    if (details.reason === "outside-press") {
      // Presses on the backdrop or the sheets below count; presses elsewhere on the page around a contained stack do not.
      const target = details.event.target
      if (!(target instanceof Node && context.layer?.contains(target))) {
        details.cancel()
        return
      }
    }
    if (details.reason === "escape-key" || details.reason === "outside-press") context.pop()
    else details.cancel()
  }

  const many = context.stack.length > 1

  return (
    <DialogPrimitive.Root
      open
      modal={isTop ? (context.contained ? "trap-focus" : true) : false}
      disablePointerDismissal={!isTop}
      onOpenChange={onOpenChange}
    >
      <DialogPrimitive.Portal container={context.layer}>
        <DialogPrimitive.Popup
          ref={setPanel}
          tabIndex={-1}
          // The panel itself takes focus first, so screen readers start from the title and Tab enters the controls.
          initialFocus={panelRef}
          finalFocus={false}
          inert={!isTop}
          aria-modal={isTop ? true : undefined}
          data-presentation={wide ? "dialog" : "sheet"}
          data-top={isTop ? "" : undefined}
          className={cn(
            "pointer-events-auto absolute inset-x-0 top-0 mx-auto flex origin-top flex-col bg-surface-raised text-foreground shadow-floating outline-none",
            wide ? "w-[min(calc(100%-2rem),27.5rem)] rounded-surface" : "w-full max-w-[42rem] rounded-t-surface",
            !isTop && "pointer-events-none",
            className,
          )}
          style={{ zIndex: level + 1 }}
          onPointerDown={pointerDown}
          render={<motion.div style={{ y, scale, opacity, height }} />}
        >
          {/* Extra surface below a sheet, so an upward stretch never shows a gap under it. */}
          {wide ? null : <span aria-hidden="true" className="absolute inset-x-0 top-full h-16 bg-surface-raised" />}
          <div ref={headerRef} className={cn("relative flex-none px-2.5 pt-1.5 pb-0.5", draggable && "touch-none select-none")}>
            {/* Back on the left, the title centered, close on the right. */}
            <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <div className="flex min-w-0 justify-start">
                {parentLabel ? (
                  <button
                    type="button"
                    className={cn(headerButton, "inline-flex min-w-0 items-center gap-0.5 pr-2.5 pl-1 text-sm font-medium")}
                    aria-label={`Back to ${parentLabel}`}
                    onClick={context.pop}
                  >
                    <CaretLeftIcon size={20} aria-hidden="true" className="flex-none" />
                    <span className="truncate">{parentLabel}</span>
                  </button>
                ) : null}
              </div>
              <DialogPrimitive.Title className="m-0 max-w-[16rem] min-w-0 truncate text-center text-base leading-body font-medium tracking-body">
                {title}
              </DialogPrimitive.Title>
              <div className="flex justify-end">
                <DialogPrimitive.Close className={cn(headerButton, "grid w-9 place-items-center")} aria-label={many ? "Close all" : "Close"}>
                  <XIcon size={18} aria-hidden="true" />
                </DialogPrimitive.Close>
              </div>
            </div>
            {description ? (
              <DialogPrimitive.Description className="mx-auto mt-0.5 mb-1 max-w-[22rem] px-2 text-center text-sm leading-body text-text-secondary">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <div ref={bodyRef} className="min-h-0 flex-1 touch-pan-y overflow-auto overscroll-contain [scrollbar-width:thin]">
            <div ref={contentRef} className={cn("grid gap-3.5 px-4 pt-2 text-sm leading-body", footer ? "pb-1" : "pb-4")}>
              {children}
            </div>
          </div>
          {footer ? (
            <div ref={footerRef} className={cn("flex flex-none items-center justify-end gap-2 px-4 pt-3 pb-4", draggable && "touch-none")}>
              {footer}
            </div>
          ) : null}
          {/* Sheets below the top dim as they recede. */}
          <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[oklch(0%_0_0/.34)]" style={{ opacity: dim }} />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** A button that opens a sheet on top of the path. Call preventDefault in onClick to skip it. */
export function DrillTrigger({ to, onClick, className, type = "button", ref, ...props }: DrillTriggerProps) {
  const { path, open } = useDrill()
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-haspopup="dialog"
      aria-expanded={path.includes(to)}
      className={cn(buttonVariants({ variant: "secondary" }), className)}
      onClick={event => {
        onClick?.(event)
        if (!event.defaultPrevented) open(to)
      }}
    />
  )
}

export default DrillSheets
