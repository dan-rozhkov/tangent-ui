"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ElementType, ReactNode } from "react"
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import type { AnimationPlaybackControls } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
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

/** Bars are a quiet mix of the strong border into the surface, the same tone as Skeleton. */
const barTone = "bg-[color-mix(in_oklab,var(--border-strong)_38%,var(--surface))]"

/** Pins the shell's height while blocks resolve and springs it to the new natural height, clipping while it moves so the card border never jumps. */
function useShellHeight(reduce: boolean) {
  const root = useRef<HTMLElement | null>(null)
  const height = useMotionValue(0)
  const controls = useRef<AnimationPlaybackControls | undefined>(undefined)
  const pinned = useRef(false)

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
    controls.current?.stop()
    if (Math.abs(next - current) < 0.5) {
      // Nothing to ease; later blocks may still change the height, so let go after this frame.
      controls.current = undefined
      requestAnimationFrame(() => {
        if (!controls.current) settle()
      })
      return
    }
    // Keeps the velocity of a running ease, so a second block resolving mid-flight retargets smoothly.
    controls.current = animate(height, next, {
      ...motionTokens.spring.smooth,
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
 * A loading region whose skeleton blocks become the real content. Blocks resolve one after another in reading order,
 * each placeholder stretching to its content's measured box while the content sharpens in underneath, and the shell
 * eases to its new height.
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

/** A calm opacity pulse with a soft sweep riding across it. Both stop as soon as the block resolves. */
function Bar({ className, style, reduce, index }: { className?: string; style?: CSSProperties; reduce: boolean; index: number }) {
  return (
    <motion.span
      className={cn("relative block overflow-hidden", barTone, className)}
      style={style}
      animate={reduce ? undefined : { opacity: [1, 0.6, 1] }}
      transition={{ duration: 1.8, ease: [...motionTokens.ease.inOut], repeat: Infinity, delay: index * 0.09 }}
    >
      {!reduce && (
        <motion.span
          className="absolute inset-y-0 left-0 block w-full bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--surface)_55%,transparent),transparent)]"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.6, ease: [...motionTokens.ease.inOut], repeat: Infinity, repeatDelay: 0.6, delay: index * 0.09 }}
        />
      )}
    </motion.span>
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
 * One piece of the layout. It is a size-matched skeleton while loading; on resolve the placeholder stretches to the
 * content's measured box and fades while the content sharpens in, in place.
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

  const overlayLeft = useMotionValue(0)
  const overlayTop = useMotionValue(0)
  const overlayWidth = useMotionValue(0)
  const overlayHeight = useMotionValue(0)
  const overlayOpacity = useMotionValue(1)
  const contentOpacity = useMotionValue(1)
  const contentBlur = useMotionValue(`blur(0px)`)

  const lineCount = lines && lines > 0 ? Math.floor(lines) : 0
  const skeletonHeight = height ?? (lineCount ? lineCount * lineHeight : 12)
  const shape = radius === "circle" ? "9999px" : px(radius)

  useLayoutEffect(() => {
    if (loading || phase !== "skeleton") return
    const node = block.current
    // Resolve in DOM order: this block's place among its region's blocks sets its delay.
    const all = region?.root.current ? Array.from(region.root.current.querySelectorAll("[data-morph-block]")) : []
    const order = Math.max(0, node ? all.indexOf(node) : 0)
    const timer = window.setTimeout(() => {
      const box = block.current?.getBoundingClientRect()
      from.current = box ? { width: box.width, height: box.height } : null
      region?.hold()
      setPhase("morphing")
    }, order * (region?.stagger ?? 0) * 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the phase only matters at the moment loading flips
  }, [loading])

  // The content is in the layout now: measure it, let the shell ease, then stretch the placeholder over it.
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
    const to = { left: target.left - outer.left, top: target.top - outer.top, width: target.width, height: target.height }

    const runs: AnimationPlaybackControls[] = []
    if (reduce) {
      overlayLeft.jump(0)
      overlayTop.jump(0)
      overlayWidth.jump(start.width)
      overlayHeight.jump(start.height)
      overlayOpacity.jump(1)
      contentOpacity.jump(0)
      contentBlur.jump("blur(0px)")
      const fade = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } as const
      runs.push(animate(overlayOpacity, 0, fade), animate(contentOpacity, 1, { ...fade, onComplete: () => setPhase("done") }))
    } else {
      overlayLeft.jump(0)
      overlayTop.jump(0)
      overlayWidth.jump(start.width)
      overlayHeight.jump(start.height)
      overlayOpacity.jump(1)
      contentOpacity.jump(0)
      contentBlur.jump(`blur(${motionTokens.blur.soft}px)`)
      const stretch = motionTokens.spring.smooth
      runs.push(
        animate(overlayLeft, to.left, stretch),
        animate(overlayTop, to.top, stretch),
        animate(overlayWidth, to.width, stretch),
        animate(overlayHeight, to.height, stretch),
        animate(overlayOpacity, 0, { duration: motionTokens.duration.standard + 0.08, ease: [...motionTokens.ease.standard] }),
        animate(contentOpacity, 1, { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], delay: 0.04 }),
        animate(contentBlur, "blur(0px)", {
          duration: motionTokens.duration.considered * 0.75,
          ease: [...motionTokens.ease.enter],
          onComplete: () => setPhase("done"),
        }),
      )
    }
    return () => runs.forEach(run => run.stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per resolve
  }, [phase])

  const isSkeleton = phase === "skeleton"
  const bars = lineCount
    ? Array.from({ length: lineCount }, (_, line) => (
        <span key={line} className="flex flex-1 items-center" style={{ minHeight: 0 }}>
          <Bar
            reduce={reduce}
            index={line}
            className="w-full"
            style={{
              height: Math.max(6, Math.round(lineHeight * 0.55)),
              borderRadius: shape,
              width: lineCount > 1 && line === lineCount - 1 ? "62%" : "100%",
            }}
          />
        </span>
      ))
    : null

  const skeleton = lineCount ? (
    <span className="flex size-full flex-col">{bars}</span>
  ) : (
    <Bar reduce={reduce} index={0} className="size-full" style={{ borderRadius: shape }} />
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
          <motion.span
            ref={content}
            className="block"
            style={phase === "done" ? undefined : { opacity: contentOpacity, filter: contentBlur }}
          >
            {children}
          </motion.span>
          {phase === "morphing" && (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute block overflow-hidden"
              style={{ left: overlayLeft, top: overlayTop, width: overlayWidth, height: overlayHeight, opacity: overlayOpacity, borderRadius: shape }}
            >
              {lineCount ? (
                <span className="flex size-full flex-col">
                  {Array.from({ length: lineCount }, (_, line) => (
                    <span key={line} className="flex flex-1 items-center">
                      <span
                        className={cn("block", barTone)}
                        style={{
                          height: Math.max(6, Math.round(lineHeight * 0.55)),
                          borderRadius: shape,
                          width: lineCount > 1 && line === lineCount - 1 ? "62%" : "100%",
                        }}
                      />
                    </span>
                  ))}
                </span>
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
