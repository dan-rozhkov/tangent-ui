"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ElementType, ReactNode } from "react"
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import type { AnimationPlaybackControls } from "motion/react"

import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"

export interface SkeletonMorphProps {
  /** While true, blocks show their skeletons and the region is aria-busy. */
  loading: boolean
  /** The loaded layout, with each visible piece wrapped in a MorphBlock. */
  children: ReactNode
  /** Seconds between blocks as they resolve in reading order. */
  stagger?: number
  /** Status text read by screen readers while loading. */
  loadingLabel?: string
  /** The root element. Style it as the card so its border follows the eased height. */
  as?: ElementType
  className?: string
  style?: CSSProperties
}

export type MorphBlockElement = "div" | "span" | "p" | "li" | "section" | "article" | "header" | "footer" | "h2" | "h3" | "h4"

export interface MorphBlockProps {
  /** The loaded content. It is not rendered while loading. */
  children?: ReactNode
  /** Skeleton width. */
  width?: number | string
  /** Skeleton height. Defaults to 12px, or the height of the lines. */
  height?: number | string
  /** Skeleton corner radius. `circle` makes a round avatar placeholder. */
  radius?: number | string | "circle"
  /** Shows a text skeleton with this many lines, each a bar centred in its line box; the last of several is shorter. */
  lines?: number
  /** Line height of the text in px, so the skeleton is exactly as tall as the loaded text. */
  lineHeight?: number
  /** The block element. */
  as?: MorphBlockElement
  className?: string
  style?: CSSProperties
}

interface RegionContext {
  loading: boolean
  stagger: number
  reduce: boolean
  root: React.RefObject<HTMLElement | null>
  /** Pins the shell at its current height before a block changes size. */
  hold: () => void
  /** Springs the pinned shell to its new natural height. */
  release: () => void
}

const Region = createContext<RegionContext | null>(null)

const px = (value: number | string) => (typeof value === "number" ? `${value}px` : value)

/** Skeleton shapes share the muted surface, so they read as quiet slots in the card. */
const barTone = "bg-surface-muted"

/** Text bars are this tall, centred in a box of the text's own line height so the skeleton keeps the loaded line boxes. */
const BAR = 12

/** The shell eases to its new height, and placeholders stretch to their content, on one medium critically damped spring. */
const SHELL = { type: "spring", stiffness: 256, damping: 32 } as const
const STRETCH = { type: "spring", stiffness: 290, damping: 34 } as const
/** Placeholders fade on a much stiffer spring, so each one is gone well before the shell settles. */
const FADE = { type: "spring", stiffness: 900, damping: 60 } as const
/** The first placeholder starts to fade this long after the content lands; the rest follow it by `stagger`. */
const FADE_LEAD = 0.06

/** Pins the shell's height while blocks resolve and springs it to the new natural height, clipping while it moves so the card border never jumps. */
function useShellHeight(reduce: boolean) {
  const root = useRef<HTMLElement | null>(null)
  const height = useMotionValue(0)
  const controls = useRef<AnimationPlaybackControls | undefined>(undefined)
  const pinned = useRef(false)
  const target = useRef(0)

  const settle = useCallback(() => {
    pinned.current = false
    const node = root.current
    if (node) Object.assign(node.style, { height: "", overflow: "" })
  }, [])

  const hold = useCallback(() => {
    const node = root.current
    if (!node || reduce) return
    if (pinned.current) return
    pinned.current = true
    height.jump(node.getBoundingClientRect().height)
    Object.assign(node.style, { height: `${height.get()}px`, overflow: "hidden" })
  }, [height, reduce])

  const release = useCallback(() => {
    const node = root.current
    if (!node || !pinned.current) return
    // Read the natural height with the pin lifted, then pin again before this frame paints.
    const current = height.get()
    node.style.height = ""
    const next = node.getBoundingClientRect().height
    node.style.height = `${current}px`
    // Every block lands in the same commit, so later calls see the same target; leave a running ease alone.
    if (controls.current && Math.abs(target.current - next) < 0.5) return
    controls.current?.stop()
    if (Math.abs(next - current) < 0.5) {
      // Nothing to ease; later blocks may still change the height, so let go after this frame.
      controls.current = undefined
      requestAnimationFrame(() => {
        if (!controls.current) settle()
      })
      return
    }
    target.current = next
    // Keeps the velocity of a running ease, so a resize mid-flight retargets smoothly.
    controls.current = animate(height, next, {
      ...SHELL,
      onUpdate: value => {
        if (root.current) root.current.style.height = `${value}px`
      },
      onComplete: () => {
        controls.current = undefined
        settle()
      },
    })
  }, [height, settle])

  const reset = useCallback(() => {
    controls.current?.stop()
    controls.current = undefined
    settle()
  }, [settle])

  useEffect(() => () => controls.current?.stop(), [])
  return { root, hold, release, reset }
}

/**
 * A loading region whose skeleton blocks become the real content. Loading swaps in at once with a slow pulse; on
 * resolve the content lands underneath, each placeholder stretches to its content's measured box and fades in reading
 * order, and the shell eases to its new height.
 */
export function SkeletonMorph({ loading, children, stagger = 0.04, loadingLabel = "Loading", as, className, style }: SkeletonMorphProps) {
  const Root = (as ?? "div") as ElementType
  const reduce = useReducedMotion() ?? false
  const { root, hold, release, reset } = useShellHeight(reduce)

  // Going back to loading is immediate, so the shell drops any running ease with it.
  useLayoutEffect(() => {
    if (loading) reset()
  }, [loading, reset])

  const value = useMemo<RegionContext>(() => ({ loading, stagger, reduce, root, hold, release }), [loading, stagger, reduce, root, hold, release])

  return (
    <Root ref={root} className={cn("relative", className)} style={style} aria-busy={loading || undefined}>
      <Region.Provider value={value}>{children}</Region.Provider>
      <span role="status" className="absolute -m-px size-px overflow-hidden border-0 p-0 whitespace-nowrap [clip-path:inset(50%)]">
        {loading ? loadingLabel : ""}
      </span>
    </Root>
  )
}

function Bar({ className, style, reduce }: { className?: string; style?: CSSProperties; reduce: boolean }) {
  const motionTokens = useMotionTokens()
  /** One slow pulse, opacity 1 to .55 and back, shared by every shape so they all breathe in phase. */
  const PULSE = useMemo(() => ({ duration: 1.4, ease: [...motionTokens.ease.inOut], repeat: Infinity, repeatType: "mirror" }) as const, [motionTokens.ease.inOut])
  return (
    <motion.span
      className={cn("block", barTone, className)}
      style={style}
      initial={false}
      animate={reduce ? { opacity: 1 } : { opacity: [1, 0.55] }}
      transition={reduce ? { duration: 0 } : PULSE}
    />
  )
}

/** Text skeleton: one line box per line, each holding a 12px bar centred in it; the last of several lines is shorter. */
function Lines({ count, lineHeight, shape, reduce, pulse }: { count: number; lineHeight: number; shape: string; reduce: boolean; pulse: boolean }) {
  const bar = Math.min(BAR, lineHeight)
  return (
    <span className="flex size-full flex-col">
      {Array.from({ length: count }, (_, line) => {
        const style: CSSProperties = {
          top: `calc(50% - ${bar / 2}px)`,
          height: bar,
          borderRadius: shape,
          width: count > 1 && line === count - 1 ? "62%" : "100%",
        }
        return (
          <span key={line} className="relative block min-h-0 flex-1">
            {pulse ? (
              <Bar reduce={reduce} className="absolute left-0" style={style} />
            ) : (
              <span className={cn("absolute left-0 block", barTone)} style={style} />
            )}
          </span>
        )
      })}
    </span>
  )
}

type Phase = "skeleton" | "morphing" | "done"

type Box = { left: number; top: number; width: number; height: number }

/**
 * The box of what is actually drawn: text runs and media, not the full width of the blocks they sit in, so a short
 * name stretches its placeholder to the name and not to the end of the line. Falls back to the content's own box.
 */
function inkBox(root: HTMLElement): Box {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  const add = (rect: DOMRect) => {
    if (!rect.width || !rect.height) return
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }
  const range = document.createRange()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent?.trim()) continue
      range.selectNodeContents(node)
      for (const rect of Array.from(range.getClientRects())) add(rect)
    } else if (node instanceof HTMLElement || node instanceof SVGElement) {
      const media = /^(IMG|SVG|VIDEO|CANVAS|PICTURE|IFRAME|INPUT|BUTTON|TEXTAREA|SELECT)$/i.test(node.nodeName)
      if (media) add(node.getBoundingClientRect())
    }
  }
  if (left === Infinity) return root.getBoundingClientRect()
  return { left, top, width: right - left, height: bottom - top }
}

/**
 * One piece of the layout. It is a size-matched skeleton while loading. On resolve the real content lands at once
 * underneath, and the placeholder stretches in place to the content's measured box while it fades away, in reading
 * order.
 */
export function MorphBlock({ children, width = "100%", height, radius = 6, lines, lineHeight = 20, as = "div", className, style }: MorphBlockProps) {
  const region = useContext(Region)
  const Tag = as as ElementType
  const block = useRef<HTMLElement | null>(null)
  const content = useRef<HTMLSpanElement | null>(null)
  const loading = region?.loading ?? false
  const reduce = region?.reduce ?? false
  const [phase, setPhase] = useState<Phase>(loading ? "skeleton" : "done")
  // Going back to loading is immediate, so fast reloads never leave a block stuck halfway.
  const [wasLoading, setWasLoading] = useState(loading)
  if (wasLoading !== loading) {
    setWasLoading(loading)
    if (loading) setPhase("skeleton")
  }
  /** The skeleton's box, read just before it gives way to the content. */
  const from = useRef<{ width: number; height: number } | null>(null)
  /** This block's place among its region's blocks, which sets when its placeholder fades. */
  const order = useRef(0)

  const overlayLeft = useMotionValue(0)
  const overlayTop = useMotionValue(0)
  const overlayWidth = useMotionValue(0)
  const overlayHeight = useMotionValue(0)
  const overlayOpacity = useMotionValue(1)

  const lineCount = lines && lines > 0 ? Math.floor(lines) : 0
  const skeletonHeight = height ?? (lineCount ? lineCount * lineHeight : 12)
  const shape = radius === "circle" ? "9999px" : px(radius)

  // Every block gives way in the same commit: pin the shell at the skeleton's height, then swap in the content.
  useLayoutEffect(() => {
    if (loading || phase !== "skeleton") return
    const node = block.current
    const all = region?.root.current ? Array.from(region.root.current.querySelectorAll("[data-morph-block]")) : []
    order.current = Math.max(0, node ? all.indexOf(node) : 0)
    const box = node?.getBoundingClientRect()
    from.current = box ? { width: box.width, height: box.height } : null
    region?.hold()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the skeleton is measured and the shell pinned before the content replaces it
    setPhase("morphing")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the phase only matters at the moment loading flips
  }, [loading])

  // The content is in the layout now: measure it, let the shell ease, then stretch the placeholder over it and fade it out.
  useLayoutEffect(() => {
    if (phase !== "morphing") return
    const node = block.current
    const inner = content.current
    region?.release()
    const start = from.current
    if (!node || !inner || !start) {
      setPhase("done")
      return
    }
    const outer = node.getBoundingClientRect()
    const target = inkBox(inner)
    // Text keeps its line boxes: the bars stretch to the run's width but stay as tall as the lines they sit in.
    const lineBox = lineCount ? inner.getBoundingClientRect() : target
    const to = { left: target.left - outer.left, top: lineBox.top - outer.top, width: target.width, height: lineBox.height }

    overlayLeft.jump(0)
    overlayTop.jump(0)
    overlayWidth.jump(start.width)
    overlayHeight.jump(start.height)
    overlayOpacity.jump(1)
    const runs: AnimationPlaybackControls[] = []
    if (reduce) {
      // No stretch and no stagger: every placeholder crossfades off the content together.
      runs.push(animate(overlayOpacity, 0, { duration: 0.115, ease: [0, 0, 0.58, 1], onComplete: () => setPhase("done") }))
    } else {
      runs.push(
        animate(overlayLeft, to.left, STRETCH),
        animate(overlayTop, to.top, STRETCH),
        animate(overlayWidth, to.width, STRETCH),
        animate(overlayHeight, to.height, STRETCH),
        animate(overlayOpacity, 0, {
          ...FADE,
          delay: FADE_LEAD + order.current * (region?.stagger ?? 0),
          onComplete: () => setPhase("done"),
        }),
      )
    }
    return () => runs.forEach(run => run.stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per resolve
  }, [phase])

  const isSkeleton = phase === "skeleton"
  const skeleton = lineCount ? (
    <Lines count={lineCount} lineHeight={lineHeight} shape={shape} reduce={reduce} pulse />
  ) : (
    <Bar reduce={reduce} className="size-full" style={{ borderRadius: shape }} />
  )

  return (
    <Tag
      ref={block}
      data-morph-block=""
      className={cn("relative", isSkeleton && "max-w-full", className)}
      style={isSkeleton ? { ...style, width: px(width), height: px(skeletonHeight) } : style}
    >
      {isSkeleton ? (
        <span aria-hidden="true" className="block size-full">
          {skeleton}
        </span>
      ) : (
        <>
          <span ref={content} className="block">
            {children}
          </span>
          {phase === "morphing" && (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute block overflow-hidden"
              style={{ left: overlayLeft, top: overlayTop, width: overlayWidth, height: overlayHeight, opacity: overlayOpacity, borderRadius: shape }}
            >
              {lineCount ? (
                <Lines count={lineCount} lineHeight={lineHeight} shape={shape} reduce={reduce} pulse={false} />
              ) : (
                <span className={cn("block size-full", barTone)} />
              )}
            </motion.span>
          )}
        </>
      )}
    </Tag>
  )
}

export default SkeletonMorph
