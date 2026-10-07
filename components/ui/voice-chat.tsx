"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { AnimatePresence, LayoutGroup, animate, motion, useIsPresent, useMotionValue, useTransform } from "motion/react"
import type { Transition, Variants } from "motion/react"
import { CaretDownIcon, XIcon } from "@phosphor-icons/react"

import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface VoiceChatParticipant {
  id: string
  name: string
  avatar: string
  /** Shows a small live waveform on the avatar. */
  speaking?: boolean
}
export interface VoiceChatProps {
  participants: VoiceChatParticipant[]
  title?: string
  /** How many avatars the collapsed pill stacks. The rest appear only in the card. */
  stackSize?: number
  joinLabel?: string
  /** Small note under the button. Pass null to hide it. */
  caption?: ReactNode
  onJoin?: () => void
  className?: string
}

type Face = "pill" | "card"

type Bezier = [number, number, number, number]
const enter = [...staticTokens.ease.enter] as Bezier
const standard = [...staticTokens.ease.standard] as Bezier
/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps the velocity it already has. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}

/** The pill: 32px avatars in 8px of padding. The card's 20px corner sits concentric with its 12px padding and 8px button. */
const PILL_HEIGHT = 48
const PILL_RADIUS = PILL_HEIGHT / 2
const CARD_RADIUS = 20
const CARD_WIDTH = 230

/** Everything derived from the motion tokens, rebuilt when the tokens change. */
function buildMotion(motionTokens: MotionTokens) {
  const { blur, duration } = motionTokens
  /** Opening carries the morph spring's bounce; folding back never overshoots. */
  const GROW = physical(motionTokens.spring.morph.visualDuration ?? 0.42, motionTokens.spring.morph.bounce ?? 0.16)
  const FOLD = physical(motionTokens.spring.smooth.visualDuration ?? 0.4, motionTokens.spring.smooth.bounce ?? 0)
  /** Content that is not an avatar sharpens in a beat after the shape starts moving (custom is the delay) and leaves fast. */
  const revealVariants: Variants = {
    hidden: { opacity: 0, filter: `blur(${blur.soft}px)` },
    shown: (delay: number = 0) => ({
      opacity: 1,
      filter: "blur(0px)",
      transition: { opacity: { duration: 0.2, ease: enter, delay }, filter: { duration: duration.standard, ease: enter, delay } },
    }),
    gone: { opacity: 0, filter: `blur(${blur.soft}px)`, transition: { duration: duration.instant, ease: standard } },
  }
  /** Participants who are not in the stack grow out of nothing while the card opens. */
  const popVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8, filter: `blur(${blur.soft}px)` },
    shown: (delay: number = 0) => ({
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        scale: { ...physical(0.32, 0.1), delay },
        opacity: { duration: 0.2, ease: enter, delay },
        filter: { duration: duration.standard, ease: enter, delay },
      },
    }),
    gone: { opacity: 0, scale: 0.8, filter: `blur(${blur.soft}px)`, transition: { duration: 0.14, ease: standard } },
  }
  return { GROW, FOLD, revealVariants, popVariants }
}

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
}

/** Bars that bounce on their own beats. Still bars of different heights when motion is reduced. */
function Waveform({ bars, reduced, className }: { bars: number; reduced: boolean; className?: string }) {
  const beats = [
    [0.35, 1, 0.5, 0.8, 0.35],
    [0.9, 0.4, 1, 0.45, 0.9],
    [0.5, 0.85, 0.35, 1, 0.5],
    [1, 0.5, 0.8, 0.35, 1],
  ]
  return (
    <span aria-hidden="true" className={cn("flex h-full items-center justify-center gap-[1.5px]", className)}>
      {Array.from({ length: bars }, (_, index) => {
        const beat = beats[index % beats.length]
        return (
          <motion.span
            key={index}
            className="h-full w-[2px] rounded-full bg-current"
            initial={{ scaleY: beat[0] }}
            animate={reduced ? { scaleY: beat[0] } : { scaleY: beat }}
            transition={{ duration: 0.9 + index * 0.13, ease: "easeInOut", repeat: Infinity }}
          />
        )
      })}
    </span>
  )
}

function FaceLayer({
  id,
  onSize,
  cardRef,
  className,
  children,
  ...rest
}: {
  id: Face
  /** Also receives the face node, for focus. */
  cardRef?: React.RefObject<HTMLDivElement | null>
  onSize: (id: Face, width: number, height: number) => void
  className?: string
  children: ReactNode
} & Omit<React.ComponentProps<"div">, "id" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart">) {
  const ref = useRef<HTMLDivElement>(null)
  const present = useIsPresent()
  const setRef = useCallback((node: HTMLDivElement | null) => {
    ref.current = node
    if (cardRef) cardRef.current = node
  }, [cardRef])
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
    // No variants of its own: the labels pass down to the pieces inside, and the face stays mounted until they are done leaving.
    <motion.div
      ref={setRef}
      data-face={id}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!present || undefined}
      className={cn("absolute top-1/2 left-1/2 w-max -translate-x-1/2 -translate-y-1/2", className)}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/**
 * A pill of stacked avatars that morphs into a card of everyone in the voice chat. The first few avatars fly from the stack
 * to their places in the grid and back, the rest grow in around them.
 */
export function VoiceChat({
  participants,
  title = "Voice Chat",
  stackSize = 4,
  joinLabel = "Join Now",
  caption = "Mic will be muted initially.",
  onJoin,
  className,
}: VoiceChatProps) {
  const reduced = useReducedMotion()
  const motionTokens = useMotionTokens()
  const { GROW, FOLD, revealVariants, popVariants } = useMemo(() => buildMotion(motionTokens), [motionTokens])
  const uid = useId()
  const cardId = `${uid}-card`
  const titleId = `${uid}-title`
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [pillWidth, setPillWidth] = useState(168)
  const focusTrigger = useRef(false)

  const stacked = participants.slice(0, stackSize)
  const hidden = participants.length - stacked.length
  const speaking = participants.filter(person => person.speaking).length

  /* The shape: one surface whose width, height, and corner radius follow the current face. */
  const width = useMotionValue(168)
  const height = useMotionValue(PILL_HEIGHT)
  const radius = useMotionValue(PILL_RADIUS)
  // The surface grows from the pill's centre on both axes, on whole pixels so an odd card height never leaves its text blurry.
  const top = useTransform(height, h => PILL_RADIUS - Math.round(h / 2))
  const current = useRef<Face>("pill")
  const target = useRef<{ id: Face; w: number; h: number } | null>(null)
  const onSize = useCallback(
    (id: Face, w: number, h: number) => {
      if (id === "pill") setPillWidth(w)
      if (id !== current.current) return
      const previous = target.current
      if (previous && Math.abs(previous.w - w) < 0.5 && Math.abs(previous.h - h) < 0.5) return
      target.current = { id, w, h }
      const r = id === "pill" ? PILL_RADIUS : CARD_RADIUS
      if (!previous || reduced) {
        width.jump(w)
        height.jump(h)
        radius.jump(r)
        return
      }
      const spring = id === "pill" ? FOLD : GROW
      animate(width, w, spring)
      animate(height, h, spring)
      animate(radius, r, spring)
    },
    [FOLD, GROW, height, radius, reduced, width],
  )

  const toggle = useCallback((next: boolean, focus: boolean) => {
    current.current = next ? "card" : "pill"
    focusTrigger.current = !next && focus
    setOpen(next)
  }, [])

  // Focus moves into the card once it mounts, and back to the pill on close.
  useEffect(() => {
    if (open) cardRef.current?.focus({ preventScroll: true })
    else if (focusTrigger.current) triggerRef.current?.focus({ preventScroll: true })
    focusTrigger.current = false
  }, [open])

  // A press outside folds the card without moving focus.
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) toggle(false, false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open, toggle])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !open) return
    event.preventDefault()
    event.stopPropagation()
    toggle(false, true)
  }

  // Avatars fly between the stack and the grid on the shape's own spring, so they land together with it.
  const flight = reduced ? { duration: 0 } : open ? GROW : FOLD
  const variants = reduced ? { reveal: fadeVariants, pop: fadeVariants } : { reveal: revealVariants, pop: popVariants }
  const avatarClass = "block rounded-full bg-surface-muted object-cover ring-2 ring-surface-raised"

  return (
    <div ref={rootRef} className={cn("relative z-10 h-12 touch-manipulation", className)} style={{ width: pillWidth }}>
      <motion.div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 overflow-hidden bg-surface-raised text-foreground ring-1 ring-border",
          open ? "shadow-floating" : "shadow-raised",
        )}
        style={{ top, width, height, borderRadius: radius }}
        onKeyDown={onKeyDown}
      >
        <LayoutGroup id={uid}>
          <AnimatePresence initial={false}>
            {!open && (
              <FaceLayer key="pill" id="pill" onSize={onSize}>
                <button
                  ref={triggerRef}
                  type="button"
                  aria-label={`${title}, ${participants.length} participants, ${speaking} speaking`}
                  aria-expanded={false}
                  aria-controls={cardId}
                  className="flex h-12 cursor-pointer items-center gap-2 rounded-full py-2 pr-3.5 pl-2 outline-none [-webkit-tap-highlight-color:transparent]"
                  onClick={() => toggle(true, false)}
                >
                  <span className="flex -space-x-2.5" aria-hidden="true">
                    {stacked.map(person => (
                      <motion.img key={person.id} layoutId={person.id} src={person.avatar} alt="" className={cn(avatarClass, "size-8")} transition={flight} />
                    ))}
                  </span>
                  {hidden > 0 && (
                    <motion.span
                      aria-hidden="true"
                      className="flex items-center gap-0.5 text-sm leading-body font-medium text-text-secondary tabular-nums"
                      variants={variants.reveal}
                      custom={0.14}
                    >
                      +{hidden}
                      <CaretDownIcon className="size-4 text-text-muted" />
                    </motion.span>
                  )}
                </button>
              </FaceLayer>
            )}

            {open && (
              <FaceLayer
                key="card"
                id="card"
                onSize={onSize}
                cardRef={cardRef}
                role="dialog"
                aria-labelledby={titleId}
                tabIndex={-1}
                style={{ width: CARD_WIDTH }}
                className="outline-none"
              >
                <motion.div variants={variants.reveal} custom={0.12} className="relative flex h-10 items-center justify-center bg-surface-muted">
                  <h2 id={titleId} className="text-sm leading-body font-medium text-text-secondary">
                    {title}
                  </h2>
                  <button
                    type="button"
                    aria-label={`Close ${title.toLowerCase()}`}
                    className={cn(
                      "absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-text-muted outline-none [-webkit-tap-highlight-color:transparent]",
                      "transition-[color,background-color] duration-160 ease-standard motion-reduce:transition-none",
                      "focus-visible:ring-2 focus-visible:ring-focus-ring pointer-fine:hover:bg-foreground/[0.06] pointer-fine:hover:text-foreground",
                    )}
                    onClick={() => toggle(false, true)}
                  >
                    <XIcon className="size-3.5" aria-hidden="true" />
                  </button>
                </motion.div>

                <ul className="grid grid-cols-4 gap-y-3 px-3 pt-3 pb-3.5" aria-label="Participants">
                  {participants.map((person, index) => {
                    const inStack = index < stacked.length
                    return (
                      <motion.li
                        key={person.id}
                        className="flex min-w-0 flex-col items-center gap-1.5"
                        variants={inStack ? undefined : variants.pop}
                        custom={0.08 + (index - stacked.length) * 0.03}
                      >
                        <span className="relative size-10">
                          <motion.img layoutId={person.id} src={person.avatar} alt="" className={cn(avatarClass, "size-10")} transition={flight} />
                          {person.speaking && (
                            <motion.span
                              className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-surface-raised p-[3px] text-foreground shadow-raised ring-1 ring-border"
                              variants={variants.reveal}
                              custom={0.22}
                            >
                              <Waveform bars={3} reduced={reduced} />
                              <span className="sr-only">Speaking</span>
                            </motion.span>
                          )}
                        </span>
                        <motion.span
                          className="w-full truncate text-center text-xs leading-body text-text-muted"
                          variants={inStack ? variants.reveal : undefined}
                          custom={0.1}
                        >
                          {person.name.split(" ")[0]}
                        </motion.span>
                      </motion.li>
                    )
                  })}
                </ul>

                <motion.div variants={variants.reveal} custom={0.16} className="px-3 pb-3">
                  <button
                    type="button"
                    className={cn(
                      "h-9 w-full cursor-pointer rounded-[10px] bg-foreground text-sm leading-body font-medium text-background shadow-raised outline-none [-webkit-tap-highlight-color:transparent]",
                      "transition-[opacity,transform] duration-160 ease-standard motion-reduce:transition-none",
                      "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised pointer-fine:hover:opacity-90 active:scale-[0.98]",
                    )}
                    onClick={onJoin}
                  >
                    {joinLabel}
                  </button>
                  {caption != null && <p className="mt-2 text-center text-xs leading-body text-text-muted">{caption}</p>}
                </motion.div>
              </FaceLayer>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </motion.div>

      {/* The live badge sits on the pill's corner, outside the clipped surface, and leaves as the card opens. */}
      <AnimatePresence initial={false}>
        {!open && (
          <motion.span
            key="live"
            aria-hidden="true"
            className="pointer-events-none absolute -top-1.5 -left-1.5 z-10 grid size-5 place-items-center rounded-full bg-foreground p-[5px] text-background shadow-raised"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.2, ease: enter, delay: 0.18 } }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.12, ease: standard } }}
          >
            <Waveform bars={4} reduced={reduced} />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

export default VoiceChat
