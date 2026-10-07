"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from "react"
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "motion/react"
import type { MotionValue, PanInfo, Transition, Variants } from "motion/react"
import { CaretDownIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "@phosphor-icons/react"

import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { ReducedMotionConfig, useReducedMotion } from "@/lib/reduced-motion"

export interface MiniPlayerTrack {
  id: string
  title: string
  performer: string
  /** Length in seconds. */
  duration: number
  artwork: string
  /** Describes the artwork. Without it the artwork is decorative. */
  artworkAlt?: string
}

export interface MiniPlayerProps {
  queue: MiniPlayerTrack[]
  index?: number
  defaultIndex?: number
  /** Called when the track changes by skip or when a track ends. The queue wraps at both ends. */
  onTrackChange?: (index: number) => void
  running?: boolean
  defaultRunning?: boolean
  onRunningChange?: (running: boolean) => void
  /** Starts as the full player. */
  defaultExpanded?: boolean
  /** Accessible name of the player section. */
  label?: string
  className?: string
}

export interface MiniPlayerLevelsProps {
  running: boolean
  className?: string
}

const BARS = 54
/** Previous restarts the track after this many seconds instead of skipping back. */
const RESTART_AFTER = 3
/** A pull on the expanded artwork past this distance, or a flick, closes the player. */
const PULL_CLOSE = 70
const FLICK = 550
/** Pull distance over which the full player previews its fold into the mini bar. */
const PULL_RANGE = 220
/** Full-player artwork height, and how short a full pull makes it. */
const ARTWORK_HEIGHT = 192
const ARTWORK_FOLDED = 96
/** Height of the mini bar the pull folds toward. */
const MINI_HEIGHT = 64

const fadeInOf = (motionTokens: MotionTokens): Transition => ({ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] })
const leaveOf = (motionTokens: MotionTokens): Transition => ({ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] })

const wrap = (value: number, length: number) => ((value % length) + length) % length
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

/** A stable, seeded waveform per track, so the same song always draws the same shape. */
function waveformOf(id: string) {
  let seed = 2166136261
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619)
  const random = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296
  }
  let previous = 0.5
  return Array.from({ length: BARS }, (_, i) => {
    // Smoothed noise with a gentle swell, so it reads as music rather than static.
    const swell = 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI * 1.6 + 0.4)
    previous = previous * 0.45 + random() * 0.55
    // Bars run from about a fifth to six sixths of the lane, so even quiet passages read as bars.
    const level = clamp(0.18 + previous * swell * 0.9, 0.16, 1)
    return 0.21 + ((level - 0.16) / 0.84) * 0.65
  })
}

/** Three small level bars that dance while a track plays and rest while paused. */
export function MiniPlayerLevels({ running: playing, className }: MiniPlayerLevelsProps) {
  const motionTokens = useMotionTokens()
  const reduced = useReducedMotion() ?? false
  const moving = playing && !reduced
  return (
    <span
      className={cn(
        "inline-flex h-3.5 flex-none items-end gap-0.5 transition-opacity duration-240 ease-standard motion-reduce:transition-none",
        !playing && "opacity-55",
        className,
      )}
      aria-hidden="true"
    >
      {[0, 1, 2].map(bar => (
        <motion.span
          key={bar}
          className="h-full w-[3px] origin-bottom rounded-[1px] bg-current"
          initial={false}
          animate={moving ? { scaleY: [0.35, 1, 0.55, 0.85, 0.35] } : { scaleY: playing ? 0.6 : 0.35 }}
          transition={
            moving
              ? { duration: 0.82 + bar * 0.17, repeat: Infinity, ease: "easeInOut", delay: bar * 0.08 }
              : reduced
                ? { duration: 0 }
                : motionTokens.spring.smooth
          }
        />
      ))}
    </span>
  )
}

/** Title and performer swap with a short rise when the track changes, in step with the artwork and without blur. */
function SwapText({ text, className }: { text: string; className?: string }) {
  const motionTokens = useMotionTokens()
  const fadeIn = fadeInOf(motionTokens)
  const leave = leaveOf(motionTokens)
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={text}
        className={cn("block truncate", className)}
        initial={{ opacity: 0, y: "0.3em" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "-0.3em", transition: leave }}
        transition={fadeIn}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  )
}

/** Artwork slides, shrinks a little and blurs in the direction you skip; old and new overlap mid-slide. */
const slideOf = (motionTokens: MotionTokens): Variants => ({
  enter: (direction: number) => ({ x: `${direction * 24}%`, scale: 0.96, opacity: 0, filter: `blur(${motionTokens.blur.soft}px)` }),
  center: { x: 0, scale: 1, opacity: 1, filter: "blur(0px)" },
  exit: (direction: number) => ({ x: `${direction * -21}%`, scale: 0.96, opacity: 0, filter: `blur(${motionTokens.blur.soft}px)` }),
})
const slideTransitionOf = (motionTokens: MotionTokens): Transition => ({
  x: motionTokens.spring.smooth,
  scale: motionTokens.spring.smooth,
  opacity: { duration: 0.22, ease: [...motionTokens.ease.standard] },
  filter: { duration: 0.36, ease: [...motionTokens.ease.standard] },
})

function Artwork({ track, direction, layoutId, className, radius }: { track: MiniPlayerTrack; direction: number; layoutId: string; className?: string; radius: number }) {
  const motionTokens = useMotionTokens()
  const slide = useMemo(() => slideOf(motionTokens), [motionTokens])
  const slideTransition = useMemo(() => slideTransitionOf(motionTokens), [motionTokens])
  return (
    <motion.div
      layoutId={layoutId}
      // The same image on both faces: hand it over outright, since a crossfade under the leaving face's fade dips to nothing.
      layoutCrossfade={false}
      className={cn("relative flex-none overflow-hidden bg-surface-muted", className)}
      style={{ borderRadius: radius }}
    >
      {/* The image stays square and centered, so the wide full-player frame crops it rather than stretching it. */}
      <AnimatePresence initial={false} custom={direction}>
        <motion.img
          key={track.id}
          src={track.artwork}
          alt={track.artworkAlt ?? ""}
          aria-hidden={track.artworkAlt ? undefined : true}
          draggable={false}
          className="absolute inset-x-0 top-1/2 aspect-square w-full -translate-y-1/2 object-cover select-none"
          custom={direction}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
        />
      </AnimatePresence>
    </motion.div>
  )
}

interface WaveformProps {
  track: MiniPlayerTrack
  elapsed: MotionValue<number>
  scrubbingRef: RefObject<boolean>
  onSeek: (seconds: number) => void
}

/** A slider drawn as a waveform: the played part is filled, and the bars stretch while you scrub. */
function Waveform({ track, elapsed, scrubbingRef, onSeek }: WaveformProps) {
  const motionTokens = useMotionTokens()
  const ref = useRef<HTMLDivElement>(null)
  const bars = useMemo(() => waveformOf(track.id), [track.id])
  const stretch = useSpring(1, motionTokens.spring.snappy)
  const clip = useTransform(elapsed, value => `inset(0 ${(1 - clamp(value / track.duration, 0, 1)) * 100}% 0 0)`)
  const total = formatTime(track.duration)
  const shown = useRef(-1)

  // Collapsing mid scrub unmounts the slider before its pointerup arrives; without this the clock would stay paused.
  useEffect(
    () => () => {
      scrubbingRef.current = false
    },
    [scrubbingRef],
  )

  // The slider value follows the clock without re-rendering: only whole seconds touch the DOM.
  useMotionValueEvent(elapsed, "change", value => {
    const second = Math.floor(value)
    const node = ref.current
    if (!node || second === shown.current) return
    shown.current = second
    node.setAttribute("aria-valuenow", String(second))
    node.setAttribute("aria-valuetext", `${formatTime(value)} of ${total}`)
  })

  function seekTo(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    onSeek(clamp((event.clientX - rect.left) / rect.width, 0, 1) * track.duration)
  }
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    scrubbingRef.current = true
    stretch.set(1.35)
    seekTo(event)
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (scrubbingRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) seekTo(event)
  }
  function up(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    scrubbingRef.current = false
    stretch.set(1)
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const now = elapsed.get()
    const steps: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -30, PageUp: 30 }
    let next: number | null = null
    if (event.key in steps) next = now + steps[event.key]
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = track.duration
    if (next === null) return
    event.preventDefault()
    onSeek(clamp(next, 0, track.duration))
  }

  const initial = Math.floor(elapsed.get())
  const lane = (className: string) => (
    <span className={cn("absolute inset-0 flex items-center justify-between", className)}>
      {bars.map((height, i) => (
        <span key={i} className="w-[3.6px] rounded-[2px] bg-current" style={{ height: `${height * 100}%` }} />
      ))}
    </span>
  )

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Position"
      aria-valuemin={0}
      aria-valuemax={Math.floor(track.duration)}
      aria-valuenow={initial}
      aria-valuetext={`${formatTime(initial)} of ${total}`}
      className="relative h-9 cursor-pointer touch-pan-y outline-none select-none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <motion.span className="absolute inset-0 block" style={{ scaleY: stretch }}>
        {lane("text-foreground/16")}
        <motion.span className="absolute inset-0 block text-foreground" style={{ clipPath: clip }}>
          {lane("")}
        </motion.span>
      </motion.span>
    </div>
  )
}

const iconButton = [
  "relative z-1 grid flex-none cursor-pointer place-items-center rounded-pill text-foreground [-webkit-tap-highlight-color:transparent]",
  "transition-[background-color,opacity] duration-160 ease-standard pointer-fine:hover:bg-surface-muted motion-reduce:transition-none",
].join(" ")
const press = { scale: 0.92 }

/**
 * A small player bar that unfolds into a full-screen-style player through a single shared-layout morph,
 * with a waveform seek strip and cover art that slides toward the side you skip to.
 * Playback runs on an internal clock; wire onRunningChange and onTrackChange to a real audio element when needed.
 */
export function MiniPlayer({
  queue,
  index: indexProp,
  defaultIndex = 0,
  onTrackChange,
  running: playingProp,
  defaultRunning = false,
  onRunningChange,
  defaultExpanded = false,
  label = "Listening queue",
  className,
}: MiniPlayerProps) {
  const motionTokens = useMotionTokens()
  const fadeIn = fadeInOf(motionTokens)
  const leave = leaveOf(motionTokens)
  const reduced = useReducedMotion() ?? false
  const group = useId()
  const [innerIndex, setInnerIndex] = useState(defaultIndex)
  const [innerPlaying, setInnerPlaying] = useState(defaultRunning)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [direction, setDirection] = useState(1)
  const count = Math.max(queue.length, 1)
  const index = wrap(indexProp ?? innerIndex, count)
  const playing = playingProp ?? innerPlaying
  const track = queue[index] as MiniPlayerTrack | undefined
  const elapsed = useMotionValue(0)
  const scrubbingRef = useRef(false)
  const pull = useMotionValue(0)
  // The pull previews the fold: the shell shortens, the artwork shrinks toward the bar, and the rest fades out.
  // On release the shared-layout morph starts from exactly this preview, so the drag hands off without a jump.
  const fold = useTransform(pull, [0, PULL_RANGE], [0, 1], { clamp: true })
  const foldSpan = useRef(0)
  const faceRef = useRef<HTMLDivElement>(null)
  const shellShrink = useTransform(fold, value => -value * foldSpan.current)
  // The artwork shortens in layout rather than scaling, so the title rides up with it instead of slipping under the shell's edge.
  const artworkHeight = useTransform(fold, [0, 1], [ARTWORK_HEIGHT, ARTWORK_FOLDED])
  const detailOpacity = useTransform(fold, [0, 0.3], [1, 0])
  const chipOpacity = useTransform(fold, [0, 0.25], [1, 0])
  const expandRef = useRef<HTMLButtonElement>(null)
  const collapseRef = useRef<HTMLButtonElement>(null)
  const focusAfter = useRef<"expand" | "collapse" | null>(null)

  const elapsedText = useTransform(elapsed, value => formatTime(value))
  const remainingText = useTransform(elapsed, value => `\u2212 ${formatTime((track?.duration ?? 0) - value)}`)
  const progress = useTransform(elapsed, value => clamp(value / Math.max(track?.duration ?? 1, 1), 0, 1))

  const trackId = track?.id
  // A new track, from a skip or from the parent, always starts from the top.
  useEffect(() => {
    elapsed.set(0)
  }, [elapsed, trackId])

  const goTo = useCallback(
    (next: number, step: number) => {
      const target = wrap(next, count)
      setDirection(step)
      elapsed.set(0)
      if (indexProp === undefined) setInnerIndex(target)
      onTrackChange?.(target)
    },
    [count, elapsed, indexProp, onTrackChange],
  )
  const setPlaying = useCallback(
    (next: boolean) => {
      if (playingProp === undefined) setInnerPlaying(next)
      onRunningChange?.(next)
    },
    [onRunningChange, playingProp],
  )

  // The internal clock: it returns early while paused or scrubbing but stays registered.
  useAnimationFrame((_, delta) => {
    if (!playing || !track || scrubbingRef.current) return
    const next = elapsed.get() + delta / 1000
    if (next >= track.duration) goTo(index + 1, 1)
    else elapsed.set(next)
  })

  // Focus follows the morph: into the collapse button on open, back to the mini bar on close.
  useEffect(() => {
    const target = focusAfter.current
    focusAfter.current = null
    if (target === "collapse") collapseRef.current?.focus({ preventScroll: true })
    if (target === "expand") expandRef.current?.focus({ preventScroll: true })
  }, [expanded])

  if (!track) return null

  function expand() {
    focusAfter.current = "collapse"
    pull.jump(0)
    setExpanded(true)
  }
  function collapse() {
    focusAfter.current = "expand"
    // The pull is left where it is: the leaving face keeps its preview while the morph carries on from it.
    setExpanded(false)
  }
  function previous() {
    if (elapsed.get() > RESTART_AFTER) elapsed.set(0)
    else goTo(index - 1, -1)
  }

  // Pulling the expanded artwork down folds the player along with the finger; an upward pull rubber-bands.
  function panStart() {
    const face = faceRef.current?.offsetHeight ?? MINI_HEIGHT
    foldSpan.current = Math.max(face - MINI_HEIGHT - (ARTWORK_HEIGHT - ARTWORK_FOLDED), 0) * 0.6
  }
  function panMove(_: PointerEvent, info: PanInfo) {
    const raw = info.offset.y
    pull.set(raw >= 0 ? raw : -Math.sqrt(-raw) * 2.4)
  }
  function panEnd(_: PointerEvent, info: PanInfo) {
    if (pull.get() > PULL_CLOSE || info.velocity.y > FLICK) collapse()
    else animate(pull, 0, motionTokens.spring.snappy)
  }

  const ids = { artwork: "artwork", title: "title", performer: "performer", play: "play", next: "next" }
  // Height and radius move in lock-step on one critically damped curve both ways; only the height changes, never the width.
  const shellTransition = motionTokens.spring.smooth
  const announcement = `${track.title} by ${track.performer}, ${playing ? "playing" : "paused"}`
  const appear = {
    initial: { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    // Full-only parts wait until the shell has mostly grown.
    transition: { ...fadeIn, delay: 0.14 },
  }

  const playButton = (big: boolean) => (
    <motion.button
      layoutId={ids.play}
      type="button"
      aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
      className={cn(
        iconButton,
        big
          ? "size-13 bg-foreground text-background pointer-fine:hover:bg-foreground pointer-fine:hover:opacity-90"
          : "size-10 bg-surface-muted pointer-fine:hover:bg-border",
      )}
      whileTap={press}
      onClick={() => setPlaying(!playing)}
    >
      {playing ? (
        <PauseIcon weight="fill" size={big ? 20 : 13} aria-hidden="true" />
      ) : (
        <PlayIcon weight="fill" size={big ? 20 : 13} aria-hidden="true" className="translate-x-px" />
      )}
    </motion.button>
  )
  const nextButton = (big: boolean) => (
    <motion.button
      layoutId={ids.next}
      type="button"
      aria-label="Next track"
      className={cn(iconButton, big ? "size-11" : "size-10 max-[360px]:hidden")}
      whileTap={press}
      onClick={() => goTo(index + 1, 1)}
    >
      <SkipForwardIcon weight="fill" size={big ? 18 : 15} aria-hidden="true" />
    </motion.button>
  )

  return (
    <ReducedMotionConfig>
      <LayoutGroup id={group}>
        <motion.section
          layout
          aria-label={label}
          className={cn("relative w-[min(100%,21rem)] overflow-hidden border border-border bg-surface-raised text-foreground shadow-floating", className)}
          initial={false}
          animate={{ borderRadius: expanded ? 30 : 22 }}
          transition={reduced ? { duration: motionTokens.duration.instant } : shellTransition}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {expanded ? (
              <motion.div
                key="full"
                ref={faceRef}
                layout
                className="relative grid gap-3 px-3 pt-3 pb-3.5"
                style={{ marginBottom: shellShrink }}
                exit={{ opacity: 0, transition: leave }}
                onKeyDown={event => {
                  if (event.key !== "Escape") return
                  event.stopPropagation()
                  collapse()
                }}
              >
                <motion.div className="absolute top-[22px] right-[22px] z-2" style={{ opacity: chipOpacity }}>
                  <motion.button
                    {...appear}
                    ref={collapseRef}
                    type="button"
                    aria-expanded="true"
                    aria-label="Collapse player"
                    // A dark glass chip over the artwork, white in both themes because it always sits on the image.
                    className={cn(
                      iconButton,
                      "size-[34px] bg-[color-mix(in_oklab,var(--neutral-11)_42%,transparent)] text-[var(--neutral-0)] pointer-fine:hover:bg-[color-mix(in_oklab,var(--neutral-11)_56%,transparent)]",
                    )}
                    onClick={collapse}
                  >
                    <CaretDownIcon size={18} aria-hidden="true" />
                  </motion.button>
                </motion.div>
                {/* The artwork is the grab handle: pull it down to close. */}
                <motion.div
                  className="cursor-grab touch-none active:cursor-grabbing"
                  style={{ height: artworkHeight }}
                  onPanStart={panStart}
                  onPan={panMove}
                  onPanEnd={panEnd}
                >
                  <Artwork track={track} direction={direction} layoutId={ids.artwork} radius={20} className="size-full" />
                </motion.div>
                <div className="grid min-w-0 px-1">
                  <motion.h3 layoutId={ids.title} layout="position" layoutCrossfade={false} className="m-0 block min-w-0 text-lg leading-[1.28] font-medium">
                    <SwapText text={track.title} />
                  </motion.h3>
                  <motion.span layoutId={ids.performer} layout="position" layoutCrossfade={false} className="block min-w-0 text-sm leading-[1.64] text-text-secondary">
                    <SwapText text={track.performer} />
                  </motion.span>
                </div>
                <motion.div style={{ opacity: detailOpacity }}>
                  <motion.div {...appear} className="grid gap-1 px-1">
                    <Waveform track={track} elapsed={elapsed} scrubbingRef={scrubbingRef} onSeek={seconds => elapsed.set(seconds)} />
                    <div className="flex justify-between text-xs text-text-muted tabular-nums" aria-hidden="true">
                      <motion.span>{elapsedText}</motion.span>
                      <motion.span>{remainingText}</motion.span>
                    </div>
                  </motion.div>
                </motion.div>
                <motion.div className="flex items-center justify-center gap-7" style={{ opacity: detailOpacity }}>
                  <motion.button
                    {...appear}
                    type="button"
                    aria-label="Previous track"
                    className={cn(iconButton, "size-11")}
                    whileTap={press}
                    onClick={previous}
                  >
                    <SkipBackIcon weight="fill" size={18} aria-hidden="true" />
                  </motion.button>
                  {playButton(true)}
                  {nextButton(true)}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div key="mini" layout className="relative flex items-center gap-2.5 px-2.5 py-[9px]" exit={{ opacity: 0, transition: leave }}>
                {/* The whole bar opens the player; play and next sit above it. */}
                <button
                  ref={expandRef}
                  type="button"
                  aria-expanded="false"
                  aria-label={`Expand player, ${track.title} by ${track.performer}`}
                  className="absolute inset-0 cursor-pointer rounded-[inherit] [-webkit-tap-highlight-color:transparent]"
                  onClick={expand}
                />
                <Artwork track={track} direction={direction} layoutId={ids.artwork} radius={12} className="pointer-events-none size-11" />
                <div className="pointer-events-none grid min-w-0 flex-1">
                  <motion.span layoutId={ids.title} layout="position" layoutCrossfade={false} className="block min-w-0 text-sm leading-body font-medium">
                    <SwapText text={track.title} />
                  </motion.span>
                  <motion.span layoutId={ids.performer} layout="position" layoutCrossfade={false} className="block min-w-0 text-xs text-text-secondary">
                    <SwapText text={track.performer} />
                  </motion.span>
                </div>
                <MiniPlayerLevels running={playing} className="pointer-events-none text-foreground" />
                {playButton(false)}
                {nextButton(false)}
                {/* A hairline of progress just inside the bottom edge. */}
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-[18px] bottom-0 h-0.5 overflow-hidden rounded-[1px] bg-foreground/10">
                  <motion.span className="block size-full origin-left rounded-[1px] bg-foreground" style={{ scaleX: progress }} />
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </motion.section>
      </LayoutGroup>
    </ReducedMotionConfig>
  )
}

export default MiniPlayer
