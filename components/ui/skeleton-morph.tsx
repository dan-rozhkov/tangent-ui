"use client"

import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ElementType, ReactNode } from "react"
import { animate, motion, useMotionValue } from "motion/react"
import type { AnimationPlaybackControls } from "motion/react"

import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface SkeletonMorphProps {
  /** While true, blocks show their skeletons and the region is aria-busy. */
  loading: boolean
  /** The loaded layout, with each visible piece wrapped in a MorphBlock. */
  children: ReactNode
  /** Seconds between blocks as they crossfade in reading order. Keep it small so they fade nearly together. */
  stagger?: number
  /** Status text read by screen readers while loading. */
  loadingLabel?: string
  /** The root element. Style it as the card; it takes the content's height at once. */
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
}

const Region = createContext<RegionContext | null>(null)

const px = (value: number | string) => (typeof value === "number" ? `${value}px` : value)

/** Skeleton shapes share the muted surface, so they read as quiet slots in the card. */
const barTone = "bg-surface-muted"

/** Text bars are this tall, centred in a box of the text's own line height so the skeleton keeps the loaded line boxes. */
const BAR = 12

/** Seconds: the skeleton fades in and out a little faster than the content arrives; reduced motion shortens both. */
const SKELETON_FADE = 0.24
const CONTENT_FADE = 0.32
const REDUCED_FADE = 0.12

/**
 * A loading region whose skeleton blocks crossfade into the real content. Loading fades in with a slow pulse; on
 * resolve the content lands in the layout and fades in while each placeholder fades out in place, nearly together in
 * reading order. Nothing is stretched or moved; the card takes the content's height at once, so size the skeletons to
 * match the content.
 */
export function SkeletonMorph({ loading, children, stagger = 0.02, loadingLabel = "Loading", as, className, style }: SkeletonMorphProps) {
  const Root = (as ?? "div") as ElementType
  const reduce = useReducedMotion() ?? false
  const root = useRef<HTMLElement | null>(null)

  const value = useMemo<RegionContext>(() => ({ loading, stagger, reduce, root }), [loading, stagger, reduce])

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

type Phase = "skeleton" | "fading" | "done"

/**
 * One piece of the layout. It is a size-matched skeleton while loading. On resolve the real content lands in the
 * layout at once and fades in, while the placeholder fades out where it stands, at its own size, in reading order.
 * Only opacity animates; the block takes its content's size at once.
 */
export function MorphBlock({ children, width = "100%", height, radius = 6, lines, lineHeight = 20, as = "div", className, style }: MorphBlockProps) {
  const region = useContext(Region)
  const motionTokens = useMotionTokens()
  const Tag = as as ElementType
  const block = useRef<HTMLElement | null>(null)
  const loading = region?.loading ?? false
  const reduce = region?.reduce ?? false
  const [phase, setPhase] = useState<Phase>(loading ? "skeleton" : "done")
  // Going back to loading is immediate, so fast reloads never leave a block stuck halfway.
  const [wasLoading, setWasLoading] = useState(loading)
  /** Set once the block has left its first state, so a later return to loading fades in and the first mount does not. */
  const [fadeIn, setFadeIn] = useState(false)
  if (wasLoading !== loading) {
    setWasLoading(loading)
    if (loading) {
      setPhase("skeleton")
      setFadeIn(true)
    }
  }
  /** The skeleton's box, read just before it gives way to the content. */
  const [from, setFrom] = useState<{ width: number; height: number } | null>(null)
  /** This block's place among its region's blocks, which sets when its fades start. */
  const order = useRef(0)

  const contentOpacity = useMotionValue(loading ? 0 : 1)
  const overlayOpacity = useMotionValue(1)

  const lineCount = lines && lines > 0 ? Math.floor(lines) : 0
  const skeletonHeight = height ?? (lineCount ? lineCount * lineHeight : 12)
  const shape = radius === "circle" ? "9999px" : px(radius)

  // The content is hidden while loading, so it is already transparent when it lands.
  useLayoutEffect(() => {
    if (loading) contentOpacity.jump(0)
  }, [loading, contentOpacity])

  // Every block gives way in the same commit: measure the skeleton, then swap in the content.
  useLayoutEffect(() => {
    if (loading || phase !== "skeleton") return
    const node = block.current
    const all = region?.root.current ? Array.from(region.root.current.querySelectorAll("[data-morph-block]")) : []
    order.current = Math.max(0, node ? all.indexOf(node) : 0)
    const box = node?.getBoundingClientRect()
    setFrom(box ? { width: box.width, height: box.height } : null)
    setPhase("fading")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the phase only matters at the moment loading flips
  }, [loading])

  // The content is in the layout now: fade it in and the placeholder out.
  useLayoutEffect(() => {
    if (phase !== "fading") return
    const ease = [...motionTokens.ease.standard] as [number, number, number, number]
    overlayOpacity.jump(1)
    contentOpacity.jump(0)
    const delay = reduce ? 0 : order.current * (region?.stagger ?? 0)
    const runs: AnimationPlaybackControls[] = [
      animate(overlayOpacity, 0, { duration: reduce ? REDUCED_FADE : SKELETON_FADE, ease, delay }),
      animate(contentOpacity, 1, { duration: reduce ? REDUCED_FADE : CONTENT_FADE, ease, delay, onComplete: () => setPhase("done") }),
    ]
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
        // The fade-in sits on this wrapper, so it never fights the pulse on the bars inside.
        <motion.span
          aria-hidden="true"
          className="block size-full"
          initial={fadeIn ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? REDUCED_FADE : SKELETON_FADE, ease: [...motionTokens.ease.standard] }}
        >
          {skeleton}
        </motion.span>
      ) : (
        <>
          <motion.span className="block" style={{ opacity: contentOpacity }}>
            {children}
          </motion.span>
          {phase === "fading" && from && (
            <motion.span
              aria-hidden="true"
              // Capped to the block, so a skeleton taller or wider than its content never covers the next block.
              className="pointer-events-none absolute top-0 left-0 block max-h-full max-w-full overflow-hidden"
              style={{ width: from.width, height: from.height, opacity: overlayOpacity, borderRadius: shape }}
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
