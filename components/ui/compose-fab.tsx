"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { FormEvent, KeyboardEvent, ReactNode } from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { AnimatePresence, LayoutGroup, animate, motion, useAnimationControls, useIsPresent, useMotionValue } from "motion/react"
import type { Transition, Variants } from "motion/react"
import { CaretLeftIcon, PlusIcon, XIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface ComposeFabForm {
  title: string
  placeholder: string
  multiline?: boolean
  chips?: { label: string; values: string[] }
  sendLabel: string
  doneLabel: string
  /** Shown when the form is sent blank. */
  blankHint?: string
}
export interface ComposeFabEntry {
  id: string
  label: string
  hint?: string
  icon: ReactNode
  /** One letter that opens this entry's form while the menu is open. */
  hotkey?: string
  form: ComposeFabForm
}
export interface ComposeFabCreated {
  entry: string
  text: string
  chip?: string
}
export interface ComposeFabProps {
  entries: ComposeFabEntry[]
  label?: string
  onCreate?: (created: ComposeFabCreated) => void | Promise<unknown>
  anchor?: "end" | "start"
  settleAfter?: number
  className?: string
}

type Face = "button" | "menu" | `composer:${string}`

type Bezier = [number, number, number, number]
const enter = [...staticTokens.ease.enter] as Bezier
const standard = [...staticTokens.ease.standard] as Bezier
const TRAVEL = 14
/** Duration springs restated as stiffness and damping, so a retarget mid-flight keeps the velocity it already has. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}
/** Menu rows rise 8px on a damped spring while the surface is still growing. */
const ROW = physical(0.3, 0)
const SLIDE = physical(0.36, 0.06)

/** Everything derived from the motion tokens, rebuilt when the tokens change. */
function buildMotion(motionTokens: MotionTokens) {
  const { blur } = motionTokens
  /** Growing carries the morph spring's bounce; folding uses the smooth spring and never overshoots. */
  const GROW = physical(motionTokens.spring.morph.visualDuration ?? 0.42, motionTokens.spring.morph.bounce ?? 0.16)
  const FOLD = physical(motionTokens.spring.smooth.visualDuration ?? 0.4, motionTokens.spring.smooth.bounce ?? 0)
  /** Panel to panel (menu and composer) resizes settle without overshoot; the new width follows the incoming face a beat late. */
  const RESIZE: Transition = { ...FOLD, delay: 0.04 }
  /** Deeper faces arrive from the right and push the old one left; going back reverses it. Blur is brief and small. */
  const faceVariants: Variants = {
    hidden: (direction: number) => ({ opacity: 0, x: direction * TRAVEL, scale: 0.98, filter: `blur(${blur.soft}px)` }),
    shown: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        x: SLIDE,
        scale: SLIDE,
        opacity: { duration: 0.2, ease: enter, delay: 0.04 },
        filter: { duration: 0.22, ease: enter, delay: 0.04 },
      },
    },
    gone: (direction: number) => ({
      opacity: 0,
      x: direction * -TRAVEL * 0.6,
      scale: 0.98,
      filter: `blur(${blur.soft}px)`,
      transition: { x: SLIDE, scale: SLIDE, opacity: { duration: 0.12, ease: standard }, filter: { duration: 0.12, ease: standard } },
    }),
  }
  return { GROW, FOLD, RESIZE, faceVariants }
}

const BUTTON = 56
const PANEL_RADIUS = 24

const subscribe = () => () => {}
/** Reduced motion only after hydration, so the server and first client render agree. */
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  return !!useReducedMotion() && hydrated
}

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
}

function FaceLayer({
  id,
  direction,
  reduced,
  anchor,
  onSize,
  className,
  children,
}: {
  id: Face
  direction: number
  reduced: boolean
  anchor: "end" | "start"
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
      custom={direction}
      variants={reduced ? fadeVariants : faceVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!present || undefined}
      className={cn("absolute bottom-0", anchor === "end" ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left", className)}
    >
      {children}
    </motion.div>
  )
}

/** A disc-free check that draws itself across the tinted button. */
function DrawnCheck({ reduced }: { reduced: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <motion.path
        d="M5.5 12.5 10 17 18.5 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.32, ease: enter, delay: 0.14 }}
      />
    </svg>
  )
}

export function ComposeFab({ entries, label = "Quick add", onCreate, anchor = "end", settleAfter = 1600, className }: ComposeFabProps) {
  const reduced = useReducedFlag()
  const motionTokens = useMotionTokens()
  const { blur } = motionTokens
  const { GROW, FOLD, RESIZE } = useMemo(() => buildMotion(motionTokens), [motionTokens])
  const uid = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  const [face, setFace] = useState<Face>("button")
  const [direction, setDirection] = useState(1)
  const [success, setSuccess] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const [active, setActive] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, { text: string; choice?: string }>>({})
  const [problem, setProblem] = useState<{ id: string; kind: "empty" | "failed" } | null>(null)
  const [sending, setSending] = useState(false)

  const current = useRef<Face>("button")
  const focusNext = useRef<string | null>(null)
  const run = useRef(0)

  /* The shape: one surface whose width, height, and corner radius follow the current face. */
  const width = useMotionValue<number | string>("100%")
  const height = useMotionValue<number | string>("100%")
  const radius = useMotionValue(BUTTON / 2)
  const target = useRef<{ w: number; h: number } | null>(null)
  const onSize = useCallback(
    (id: Face, w: number, h: number) => {
      if (id !== current.current) return
      const previous = target.current
      if (previous && Math.abs(previous.w - w) < 0.5 && Math.abs(previous.h - h) < 0.5) return
      target.current = { w, h }
      const r = id === "button" ? BUTTON / 2 : PANEL_RADIUS
      if (!previous || reduced) {
        width.jump(w)
        height.jump(h)
        radius.jump(r)
        return
      }
      const surface = surfaceRef.current
      if (typeof width.get() === "string" && surface) {
        width.jump(surface.offsetWidth)
        height.jump(surface.offsetHeight)
      }
      // Opening from the button carries the morph bounce, folding back never overshoots, panel swaps resize smoothly.
      const spring = id === "button" ? FOLD : previous.w <= BUTTON + 0.5 ? GROW : RESIZE
      animate(width, w, spring)
      animate(height, h, spring)
      animate(radius, r, spring)
    },
    [FOLD, GROW, RESIZE, height, radius, reduced, width],
  )

  const go = useCallback((next: Face, dir: number, focus: string | null) => {
    if (next === current.current) return
    current.current = next
    focusNext.current = focus
    setDirection(dir)
    setFace(next)
  }, [])

  // Focus moves into each new face once it mounts, and back to the button on close.
  useEffect(() => {
    const selector = focusNext.current
    focusNext.current = null
    if (!selector) return
    surfaceRef.current?.querySelector<HTMLElement>(`[data-face="${CSS.escape(face)}"] ${selector}`)?.focus({ preventScroll: true })
  }, [face])

  // After success the check holds for settleAfter, then the plus rotates back in.
  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(null), settleAfter)
    return () => window.clearTimeout(timer)
  }, [success, settleAfter])

  const close = useCallback(
    (focusButton: boolean) => {
      run.current++
      setSending(false)
      setProblem(null)
      go("button", -1, focusButton ? "[data-trigger]" : null)
    },
    [go],
  )

  // A press outside folds the surface without moving focus.
  useEffect(() => {
    if (face === "button") return
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [close, face])

  const openMenu = (index = 0) => {
    setSuccess(null)
    setActive(index)
    go("menu", 1, `[data-index="${index}"]`)
  }
  const openComposer = (action: ComposeFabEntry) => {
    setProblem(null)
    setActive(entries.indexOf(action))
    go(`composer:${action.id}`, 1, "[data-field]")
  }
  const backToMenu = (action: ComposeFabEntry) => {
    run.current++
    setSending(false)
    setProblem(null)
    const index = entries.indexOf(action)
    setActive(index)
    go("menu", -1, `[data-index="${index}"]`)
  }

  const draftFor = (action: ComposeFabEntry) => {
    const draft = drafts[action.id]
    return { text: draft?.text ?? "", choice: draft?.choice ?? action.form.chips?.values[0] }
  }
  const setDraft = (id: string, patch: Partial<{ text: string; choice?: string }>) =>
    setDrafts(all => ({ ...all, [id]: { text: all[id]?.text ?? "", choice: all[id]?.choice, ...patch } }))

  const [shake, setShake] = useState(0)
  const submit = async (action: ComposeFabEntry) => {
    if (sending) return
    const { text, choice } = draftFor(action)
    if (!text.trim()) {
      setProblem({ id: action.id, kind: "empty" })
      setShake(count => count + 1)
      surfaceRef.current?.querySelector<HTMLElement>(`[data-face="composer:${CSS.escape(action.id)}"] [data-field]`)?.focus()
      return
    }
    const token = ++run.current
    setProblem(null)
    let result: void | Promise<unknown> | undefined
    try {
      result = onCreate?.({ entry: action.id, text: text.trim(), chip: action.form.chips ? choice : undefined })
      if (result && typeof (result as Promise<unknown>).then === "function") {
        setSending(true)
        await result
      }
    } catch {
      if (token !== run.current) return
      setSending(false)
      setProblem({ id: action.id, kind: "failed" })
      setAnnouncement("Not saved. Your draft is kept, try again.")
      return
    }
    if (token !== run.current) {
      // Left the composer while it was sending: the save still went through, so drop the unchanged draft rather than invite a duplicate.
      setDrafts(all => {
        if (all[action.id]?.text !== text) return all
        const next = { ...all }
        delete next[action.id]
        return next
      })
      setAnnouncement(action.form.doneLabel)
      return
    }
    setSending(false)
    setDrafts(all => {
      const next = { ...all }
      delete next[action.id]
      return next
    })
    setSuccess(action.form.doneLabel)
    setAnnouncement(action.form.doneLabel)
    go("button", -1, "[data-trigger]")
  }

  const onSurfaceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || face === "button") return
    event.preventDefault()
    event.stopPropagation()
    const composing = face.startsWith("composer:") ? entries.find(action => face === `composer:${action.id}`) : undefined
    if (composing) backToMenu(composing)
    else close(true)
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = entries.length - 1
    let next = -1
    if (event.key === "ArrowDown") next = active >= last ? 0 : active + 1
    else if (event.key === "ArrowUp") next = active <= 0 ? last : active - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const action = entries.find(item => item.hotkey?.toLowerCase() === event.key.toLowerCase())
      if (action) {
        event.preventDefault()
        openComposer(action)
      }
      return
    }
    if (next < 0) return
    event.preventDefault()
    setActive(next)
    event.currentTarget.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus()
  }

  const titleId = `${uid}-title`
  const resting = face === "button"
  const composing = entries.find(action => face === `composer:${action.id}`)

  return (
    <div ref={rootRef} className={cn("relative size-14 touch-manipulation", className)}>
      <motion.div
        ref={surfaceRef}
        className={cn(
          "absolute bottom-0 overflow-hidden",
          "transition-[background-color,color,box-shadow] duration-300 ease-standard motion-reduce:transition-none",
          anchor === "end" ? "right-0" : "left-0",
          resting
            ? success
              ? "bg-success text-background shadow-raised"
              : "bg-accent text-accent-foreground shadow-raised"
            : "bg-surface-raised text-foreground shadow-floating",
        )}
        style={{ width, height, borderRadius: radius }}
        whileTap={resting && !reduced ? { scale: 0.95 } : undefined}
        transition={motionTokens.spring.snappy}
        onKeyDown={onSurfaceKeyDown}
      >
        <AnimatePresence initial={false} custom={direction}>
          {resting && (
            <FaceLayer key="button" id="button" direction={direction} reduced={reduced} anchor={anchor} onSize={onSize}>
              <button
                type="button"
                data-trigger=""
                className="grid size-14 cursor-pointer place-items-center rounded-full outline-none [-webkit-tap-highlight-color:transparent]"
                aria-haspopup="menu"
                aria-expanded={false}
                aria-label={success ? `${label}. ${success}` : label}
                onClick={() => openMenu(0)}
                onKeyDown={event => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault()
                    openMenu(event.key === "ArrowUp" ? entries.length - 1 : 0)
                  }
                }}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {success ? (
                    <motion.span
                      key="check"
                      className="grid place-items-center"
                      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: `blur(${blur.subtle}px)` }}
                      transition={reduced ? { duration: motionTokens.duration.fast } : motionTokens.spring.snappy}
                    >
                      <DrawnCheck reduced={reduced} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="plus"
                      className="grid place-items-center"
                      initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
                      transition={reduced ? { duration: motionTokens.duration.fast } : motionTokens.spring.snappy}
                    >
                      <PlusIcon className="size-[22px]" aria-hidden="true" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </FaceLayer>
          )}

          {face === "menu" && (
            <FaceLayer
              key="menu"
              id="menu"
              direction={direction}
              reduced={reduced}
              anchor={anchor}
              onSize={onSize}
              className="w-[min(16rem,calc(100vw-2rem))] p-1.5"
            >
              <div className="flex h-9 items-center gap-1 pl-2.5">
                <span id={titleId} className="min-w-0 flex-1 truncate text-sm leading-body font-medium">
                  {label}
                </span>
                <CloseButton onClick={() => close(true)} />
              </div>
              <LayoutGroup id={`${uid}-menu`}>
                <div role="menu" aria-labelledby={titleId} className="isolate mt-0.5 flex flex-col gap-0.5" onKeyDown={onMenuKeyDown}>
                  {entries.map((action, index) => (
                    <motion.button
                      key={action.id}
                      type="button"
                      role="menuitem"
                      data-index={index}
                      tabIndex={index === active ? 0 : -1}
                      aria-keyshortcuts={action.hotkey}
                      className="relative flex cursor-pointer items-center gap-3 rounded-[18px] px-2.5 py-[9px] text-left outline-none [-webkit-tap-highlight-color:transparent]"
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        reduced
                          ? { duration: motionTokens.duration.fast }
                          : {
                              y: { ...ROW, delay: 0.1 + index * motionTokens.stagger.item },
                              opacity: { duration: 0.2, ease: enter, delay: 0.1 + index * motionTokens.stagger.item },
                            }
                      }
                      onFocus={() => setActive(index)}
                      onPointerMove={event => {
                        if (event.pointerType === "mouse" && document.activeElement !== event.currentTarget) event.currentTarget.focus()
                      }}
                      onClick={() => openComposer(action)}
                    >
                      {index === active && (
                        <motion.span
                          layoutId="highlight"
                          className="absolute inset-0 -z-1 rounded-[inherit] bg-foreground/[0.065]"
                          transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
                          aria-hidden="true"
                        />
                      )}
                      <span className="grid size-5 flex-none place-items-center text-text-secondary [&_svg]:size-[18px]" aria-hidden="true">
                        {action.icon}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="truncate text-sm leading-body font-medium text-foreground">{action.label}</span>
                        {action.hint && <span className="truncate text-xs leading-body text-text-secondary">{action.hint}</span>}
                      </span>
                      {action.hotkey && (
                        <kbd className="grid h-[22px] min-w-[22px] flex-none place-items-center rounded-[7px] border border-border px-1.5 font-sans text-xs leading-none text-text-muted uppercase" aria-hidden="true">
                          {action.hotkey}
                        </kbd>
                      )}
                    </motion.button>
                  ))}
                </div>
              </LayoutGroup>
            </FaceLayer>
          )}

          {composing && (
            <FaceLayer
              key={face}
              id={face}
              direction={direction}
              reduced={reduced}
              anchor={anchor}
              onSize={onSize}
              className="w-[min(20rem,calc(100vw-2rem))]"
            >
              <Composer
                key={composing.id}
                uid={uid}
                action={composing}
                draft={draftFor(composing)}
                problem={problem?.id === composing.id ? problem.kind : null}
                sending={sending}
                shake={shake}
                reduced={reduced}
                onText={text => {
                  setDraft(composing.id, { text })
                  if (problem?.kind === "empty" && text.trim()) setProblem(null)
                }}
                onChoice={choice => setDraft(composing.id, { choice })}
                onBack={() => backToMenu(composing)}
                onClose={() => close(true)}
                onSubmit={() => void submit(composing)}
              />
            </FaceLayer>
          )}
        </AnimatePresence>
      </motion.div>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}

function Composer({
  uid,
  action,
  draft,
  problem,
  sending,
  shake,
  reduced,
  onText,
  onChoice,
  onBack,
  onClose,
  onSubmit,
}: {
  uid: string
  action: ComposeFabEntry
  draft: { text: string; choice?: string }
  problem: "empty" | "failed" | null
  sending: boolean
  shake: number
  reduced: boolean
  onText: (text: string) => void
  onChoice: (choice: string) => void
  onBack: () => void
  onClose: () => void
  onSubmit: () => void
}) {
  const motionTokens = useMotionTokens()
  const { form: composer } = action
  const titleId = `${uid}-${action.id}-title`
  const messageId = `${uid}-${action.id}-message`
  const choicesId = `${uid}-${action.id}-choices`
  const field = useAnimationControls()
  const shaken = useRef(shake)
  // An empty submit nudges the field sideways on a spring; reduced motion skips the shake and keeps the message.
  useEffect(() => {
    if (shaken.current === shake) return
    shaken.current = shake
    if (problem === "empty" && !reduced) void field.start({ x: [0, -7, 6, -4, 2, 0], transition: { duration: 0.36, ease: standard } })
  }, [field, problem, reduced, shake])

  const message =
    problem === "empty" ? (composer.blankHint ?? "Add a few words first.") : problem === "failed" ? "Not saved. Try again." : null
  const fieldClass = cn(
    "block w-full resize-none rounded-[18px] bg-surface-muted/80 px-3 py-2.5 text-base leading-body text-foreground outline-none ring-1 ring-border ring-inset placeholder:text-text-muted",
    "transition-[box-shadow] duration-160 ease-standard focus:ring-border-strong aria-invalid:ring-danger",
  )
  const onSubmitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  return (
    <form className="flex flex-col gap-3 p-1.5" aria-labelledby={titleId} aria-busy={sending || undefined} onSubmit={onSubmitForm} noValidate>
      <div className="flex h-9 items-center gap-1">
        <IconButton label="Back" onClick={onBack}>
          <CaretLeftIcon className="size-4" aria-hidden="true" />
        </IconButton>
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-sm leading-body font-medium">
          {composer.title}
        </h2>
        <CloseButton onClick={onClose} />
      </div>
      <motion.div animate={field}>
        {composer.multiline ? (
          <textarea
            data-field=""
            rows={4}
            className={fieldClass}
            placeholder={composer.placeholder}
            aria-label={composer.title}
            aria-invalid={problem ? true : undefined}
            aria-describedby={message ? messageId : undefined}
            value={draft.text}
            onChange={event => onText(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                onSubmit()
              }
            }}
          />
        ) : (
          <input
            data-field=""
            className={fieldClass}
            placeholder={composer.placeholder}
            aria-label={composer.title}
            aria-invalid={problem ? true : undefined}
            aria-describedby={message ? messageId : undefined}
            value={draft.text}
            onChange={event => onText(event.target.value)}
          />
        )}
      </motion.div>
      {composer.chips && (
        <div className="flex flex-col gap-1.5 px-0.5">
          <span id={choicesId} className="text-xs leading-body text-text-muted">
            {composer.chips.label}
          </span>
          <LayoutGroup id={`${uid}-${action.id}-choices`}>
            <RadioGroup
              aria-labelledby={choicesId}
              value={draft.choice}
              onValueChange={value => onChoice(String(value))}
              className="isolate grid auto-cols-fr grid-flow-col rounded-full bg-foreground/5 p-[3px]"
            >
              {composer.chips.values.map(option => (
                <Radio.Root
                  key={option}
                  value={option}
                  className={cn(
                    "relative inline-flex h-[30px] min-w-0 cursor-pointer items-center justify-center rounded-full px-2 text-xs font-medium text-text-secondary outline-none",
                    "transition-[color] duration-160 ease-standard motion-reduce:transition-none",
                    "pointer-fine:hover:text-foreground data-checked:text-foreground",
                  )}
                >
                  {draft.choice === option && (
                    <motion.span
                      layoutId="choice"
                      className="absolute inset-0 -z-1 rounded-full bg-surface-raised shadow-resting ring-1 ring-border"
                      transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{option}</span>
                </Radio.Root>
              ))}
            </RadioGroup>
          </LayoutGroup>
        </div>
      )}
      <div className="flex h-9 items-center justify-between gap-3 pl-1">
        <span id={messageId} className={cn("min-w-0 text-xs leading-body", problem ? "text-danger" : "text-text-muted")}>
          {message ?? (composer.multiline ? "⌘ Enter to send" : null)}
        </span>
        <Button
          type="submit"
          size="sm"
          loading={sending}
          className="min-h-9 flex-none rounded-full border-transparent bg-accent px-3.5 text-accent-foreground [&_.animate-spin]:motion-reduce:animate-[spin_1.6s_linear_infinite]"
        >
          {composer.sendLabel}
        </Button>
      </div>
    </form>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="grid size-8 flex-none cursor-pointer place-items-center rounded-full text-text-secondary outline-none transition-[background-color,color] duration-160 ease-standard pointer-fine:hover:bg-foreground/[0.065] pointer-fine:hover:text-foreground"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Close" onClick={onClick}>
      <XIcon className="size-4" aria-hidden="true" />
    </IconButton>
  )
}

export default ComposeFab
