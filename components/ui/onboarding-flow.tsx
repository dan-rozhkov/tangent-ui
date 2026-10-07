"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"
import { AnimatePresence, motion, useIsPresent } from "motion/react"
import type { Variants } from "motion/react"
import { BackspaceIcon, CaretLeftIcon, XIcon } from "@phosphor-icons/react"

import { Input } from "@/components/ui/input"
import { TextMorph } from "@/components/ui/text-morph"
import { OtpInput } from "@/components/ui/otp-input"
import { TimeWheel } from "@/components/ui/time-wheel"
import { motionTokens as staticTokens } from "@/lib/motion-tokens"
import { useMotionTokens } from "@/lib/motion-tokens-context"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface OnboardingData {
  /** E.164 number, such as "+15550123456". */
  phone: string
  code: string
  birthday: Date
  name: string
}

export interface OnboardingCopy {
  /** Accessible name of the whole flow. */
  label?: string
  introTitle?: string
  introBody?: string
  start?: string
  next?: string
  finish?: string
  restart?: string
  phoneTitle?: string
  phoneBody?: string
  phonePlaceholder?: string
  codeTitle?: string
  codeBody?: string
  birthdayTitle?: string
  birthdayBody?: string
  nameTitle?: string
  nameBody?: string
  nameLabel?: string
  /** Receives the name. */
  doneTitle?: (name: string) => string
  doneBody?: string
  back?: string
  close?: string
}

export interface OnboardingFlowProps {
  /** Called with everything collected when the last question is answered. */
  onComplete?: (data: OnboardingData) => void
  /** Today, for the birthday reels. Defaults to the start of the current day. */
  today?: Date
  /** Words for localization. */
  copy?: OnboardingCopy
  className?: string
}

const DEFAULT_COPY: Required<OnboardingCopy> = {
  label: "Sign up",
  introTitle: "Join us in\na minute",
  introBody: "A few quick questions and\nyou are ready to go.",
  start: "Get started",
  next: "Next",
  finish: "Finish",
  restart: "Start over",
  phoneTitle: "Enter your phone number",
  phoneBody: "We'll text a code to confirm\nit's you",
  phonePlaceholder: "(555) 012-3456",
  codeTitle: "Check your messages",
  codeBody: "Type the 6-digit code\nwe sent",
  birthdayTitle: "When's your birthday?",
  birthdayBody: "We use it to tailor\nwhat you see",
  nameTitle: "What should we call you?",
  nameBody: "This is how others\nwill see you",
  nameLabel: "Name",
  doneTitle: name => `You're in, ${name}`,
  doneBody: "Your account is ready.\nWelcome aboard.",
  back: "Back",
  close: "Close",
}

const STEPS = ["intro", "phone", "code", "birthday", "name", "done"] as const
type Step = (typeof STEPS)[number]

/** Intro, phone, code, birthday and name each get a dash; the finished screen keeps the last one. */
const DASHES = 5
const DASH_WIDTH = 24
const DASH_GAP = 6
const PHONE_LENGTH = 10
const CODE_LENGTH = 6
/** US numbers: "#" takes a typed digit, the rest are separators that appear once a digit follows them. */
const PHONE_MASK = "(###) ###-####"
const DEFAULT_BIRTHDAY = new Date(2000, 5, 15)
/** Height of the keypad tray; the button rides up by the tray height less the gap it keeps above it. */
const TRAY = 242
const BUTTON_LIFT = TRAY - 8

const KEYS: { digit: string; letters: string }[] = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
]

const enter = [...staticTokens.ease.enter] as [number, number, number, number]
const standard = [...staticTokens.ease.standard] as [number, number, number, number]

/** The typed part of the mask, such as "(555) 01" for "55501". */
function formatPhone(digits: string) {
  let out = ""
  let used = 0
  for (const char of PHONE_MASK) {
    if (char === "#") {
      if (used >= digits.length) break
      out += digits[used++]
    } else {
      if (used >= digits.length) break
      out += char
    }
  }
  return out
}

const startOfToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/** One screen of the flow. It slides in the direction of travel and hands focus to its heading (or the field marked data-autofocus). */
function Panel({ direction, reduced, focusOnMount, rootRef, children }: { direction: number; reduced: boolean; focusOnMount: boolean; rootRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const motionTokens = useMotionTokens()
  const ref = useRef<HTMLDivElement>(null)
  // A leaving panel is inert, so its stale fields cannot take keys or focus while it fades out.
  const present = useIsPresent()
  const variants = useMemo<Variants>(
    () => ({
      enter: (dir: number) =>
        reduced ? { opacity: 0 } : { opacity: 0, x: dir * 40, filter: `blur(${motionTokens.blur.soft}px)` },
      center: {
        opacity: 1,
        x: 0,
        filter: "blur(0px)",
        transition: reduced
          ? { duration: motionTokens.duration.fast }
          : { duration: 0.46, ease: enter, opacity: { duration: motionTokens.duration.considered, ease: enter } },
      },
      exit: (dir: number) =>
        reduced
          ? { opacity: 0, transition: { duration: motionTokens.duration.instant } }
          : {
              opacity: 0,
              x: dir * -40,
              filter: `blur(${motionTokens.blur.soft}px)`,
              transition: { duration: 0.3, ease: standard },
            },
    }),
    [motionTokens, reduced],
  )
  // Focus follows the step, but never on first load and never away from elsewhere on the page.
  useLayoutEffect(() => {
    if (!focusOnMount) return
    const root = rootRef.current
    if (!root || !(root.contains(document.activeElement) || document.activeElement === document.body)) return
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true })
  }, [focusOnMount, rootRef])
  return (
    <motion.div
      ref={ref}
      inert={!present}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      className="absolute inset-x-0 top-14 bottom-0 px-6"
    >
      {children}
    </motion.div>
  )
}

function StepHeading({ title, body, focus = true }: { title: string; body: string; focus?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <h2 data-autofocus={focus ? "" : undefined} tabIndex={-1} className="m-0 text-[17px] leading-tight font-semibold tracking-[-0.02em] text-foreground outline-none">
        {title}
      </h2>
      <p className="m-0 text-sm leading-[1.4] whitespace-pre-line text-text-secondary">{body}</p>
    </div>
  )
}

/** Title and line in the intro's big style, resting above the button. */
function Splash({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col justify-end gap-3 pb-[92px]">
      <h2 data-autofocus="" tabIndex={-1} className="m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.035em] whitespace-pre-line text-foreground outline-none">
        {title}
      </h2>
      <p className="m-0 text-[15px] leading-[1.4] whitespace-pre-line text-text-secondary">{body}</p>
    </div>
  )
}

/** The typed number in large digits. Each new character rises in; the rest of the mask stays as a muted guide. */
function PhoneReadout({ digits, placeholder, reduced }: { digits: string; placeholder: string; reduced: boolean }) {
  const motionTokens = useMotionTokens()
  const typed = formatPhone(digits)
  const guide = placeholder.slice(typed.length)
  return (
    <div role="group" aria-label="Phone number" className="mt-10 text-[30px] leading-none font-medium tracking-[-0.02em] whitespace-nowrap tabular-nums">
      <span className="sr-only">{digits ? `+1 ${typed}` : "Empty"}</span>
      <span aria-hidden="true" className="flex">
        <span className="text-foreground">+1&nbsp;</span>
        {Array.from(typed).map((char, index) => (
          <motion.span
            key={index}
            className="inline-block whitespace-pre text-foreground"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: reduced ? motionTokens.duration.instant : motionTokens.duration.standard, ease: enter }}
          >
            {char}
          </motion.span>
        ))}
        <span className="whitespace-pre text-text-muted">{guide}</span>
      </span>
    </div>
  )
}

const keyTile = cn(
  "relative grid h-12 cursor-pointer place-items-center rounded-[14px] border-0 bg-surface p-0 text-foreground outline-none [-webkit-tap-highlight-color:transparent]",
  "transition-[background-color] duration-160 ease-standard motion-reduce:transition-none",
  "pointer-fine:hover:bg-control-track/50 active:bg-control-track data-[flash=true]:bg-control-track",
)

/** iOS-style number pad: digits with their letters, an empty cell, zero and delete. */
function Keypad({ flash, onDigit, onDelete, reduced }: { flash: string | null; onDigit: (digit: string) => void; onDelete: () => void; reduced: boolean }) {
  const press = reduced ? undefined : { scale: 0.95 }
  return (
    // Pointer presses keep focus where it was, like a real keyboard, so Enter still advances after tapping a key.
    <div className="grid grid-cols-3 gap-x-1.5 gap-y-1.5 px-3 pt-3 pb-5" onMouseDown={event => event.preventDefault()}>
      {KEYS.map(({ digit, letters }) => (
        <motion.button
          key={digit}
          type="button"
          aria-label={digit}
          data-flash={flash === digit}
          className={keyTile}
          whileTap={press}
          transition={staticTokens.spring.snappy}
          onClick={() => onDigit(digit)}
        >
          <span className="grid justify-items-center gap-px" aria-hidden="true">
            <span className="text-[22px] leading-none font-normal tabular-nums">{digit}</span>
            <span className="h-2 text-[8px] leading-2 font-semibold tracking-[0.12em] text-text-muted">{letters}</span>
          </span>
        </motion.button>
      ))}
      <span aria-hidden="true" />
      <motion.button type="button" aria-label="0" data-flash={flash === "0"} className={keyTile} whileTap={press} transition={staticTokens.spring.snappy} onClick={() => onDigit("0")}>
        <span aria-hidden="true" className="text-[22px] leading-none font-normal tabular-nums">
          0
        </span>
      </motion.button>
      <motion.button
        type="button"
        aria-label="Delete"
        data-flash={flash === "Backspace"}
        className={cn(keyTile, "bg-transparent pointer-fine:hover:bg-control-track/50")}
        whileTap={press}
        transition={staticTokens.spring.snappy}
        onClick={onDelete}
      >
        <BackspaceIcon size={24} aria-hidden="true" />
      </motion.button>
    </div>
  )
}

/** The dashes sit in a row; one filled bar glides to the current one. */
function Progress({ index, label, reduced }: { index: number; label: string; reduced: boolean }) {
  const motionTokens = useMotionTokens()
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={DASHES}
      aria-valuenow={index + 1}
      aria-valuetext={`Step ${index + 1} of ${DASHES}`}
      className="relative flex"
      style={{ gap: DASH_GAP }}
    >
      {Array.from({ length: DASHES }, (_, i) => (
        <span key={i} className="h-1 rounded-pill bg-control-track" style={{ width: DASH_WIDTH }} />
      ))}
      <motion.span
        aria-hidden="true"
        className="absolute top-0 left-0 h-1 rounded-pill bg-foreground"
        style={{ width: DASH_WIDTH }}
        initial={false}
        animate={{ x: index * (DASH_WIDTH + DASH_GAP) }}
        transition={reduced ? { duration: motionTokens.duration.instant } : motionTokens.spring.smooth}
      />
    </div>
  )
}

/**
 * A phone-sized sign-up flow. One button serves every step: it rides up on the number pad, renames itself, and wakes once the field is
 * filled, while the screens slide past and a dash tracks progress. The number pad also answers the physical keyboard.
 */
export function OnboardingFlow({ onComplete, today, copy, className }: OnboardingFlowProps) {
  const reduced = useReducedMotion() ?? false
  const motionTokens = useMotionTokens()
  const words = { ...DEFAULT_COPY, ...Object.fromEntries(Object.entries(copy ?? {}).filter(([, value]) => value !== undefined)) }
  const [defaultToday] = useState(startOfToday)
  const todayDate = today ?? defaultToday
  const rootRef = useRef<HTMLDivElement>(null)
  const stepIndexRef = useRef(0)
  const completed = useRef(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [moved, setMoved] = useState(false)
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [birthday, setBirthday] = useState(DEFAULT_BIRTHDAY)
  const [name, setName] = useState("")
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const step: Step = STEPS[stepIndex]
  const keypad = step === "phone" || step === "code"
  const dash = Math.min(stepIndex, DASHES - 1)
  const stepLabel = `Step ${dash + 1} of ${DASHES}`
  const trimmedName = name.trim()
  const doneHeading = words.doneTitle(trimmedName)

  const valid =
    step === "phone" ? phone.length === PHONE_LENGTH : step === "code" ? code.length === CODE_LENGTH : step === "name" ? trimmedName.length > 0 : true

  const go = (next: number) => {
    setDirection(next >= stepIndexRef.current ? 1 : -1)
    stepIndexRef.current = next
    setStepIndex(next)
    setMoved(true)
  }

  const reset = () => {
    setPhone("")
    setCode("")
    setName("")
    setBirthday(DEFAULT_BIRTHDAY)
    completed.current = false
    go(0)
  }

  const advance = () => {
    if (!valid) return
    if (step === "done") return reset()
    if (step === "name") {
      if (completed.current) return
      completed.current = true
      onComplete?.({ phone: `+1${phone}`, code, birthday, name: trimmedName })
    }
    go(stepIndex + 1)
  }

  const back = () => {
    if (step === "done" || step === "intro") return reset()
    go(stepIndex - 1)
  }

  const pressDigit = (digit: string) => {
    if (step === "phone") setPhone(value => (value.length < PHONE_LENGTH ? value + digit : value))
    else if (step === "code") setCode(value => (value.length < CODE_LENGTH ? value + digit : value))
  }
  const pressDelete = () => {
    if (step === "phone") setPhone(value => value.slice(0, -1))
    else if (step === "code") setCode(value => value.slice(0, -1))
  }

  const handlers = useRef({ advance, pressDigit, pressDelete })
  useEffect(() => {
    handlers.current = { advance, pressDigit, pressDelete }
  })
  // Physical keys drive the pad too, but only from inside this flow (or from the bare page, where nothing else owns them). A focused field
  // (a code slot) already handles its own digits, so only Enter is shared with it.
  useEffect(() => {
    if (!keypad) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      const root = rootRef.current
      if (!root || !(target === document.body || (target instanceof Node && root.contains(target)))) return
      if (event.key === "Enter") {
        if (target instanceof HTMLElement && target.closest("button")) return
        event.preventDefault()
        handlers.current.advance()
        return
      }
      if (isTypingTarget(target)) return
      const flashKey = /^\d$/.test(event.key) ? event.key : event.key === "Backspace" ? "Backspace" : null
      if (!flashKey) return
      event.preventDefault()
      if (flashKey === "Backspace") handlers.current.pressDelete()
      else handlers.current.pressDigit(flashKey)
      setFlash(flashKey)
      clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlash(null), 140)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [keypad])
  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const ctaLabel = step === "intro" ? words.start : step === "done" ? words.restart : step === "name" ? words.finish : words.next
  const showBack = stepIndex > 0 && step !== "done"
  const slide = reduced ? { duration: motionTokens.duration.fast } : motionTokens.spring.smooth

  let content: ReactNode
  if (step === "intro") content = <Splash title={words.introTitle} body={words.introBody} />
  else if (step === "done") content = <Splash title={doneHeading} body={words.doneBody} />
  else if (step === "phone")
    content = (
      <>
        <StepHeading title={words.phoneTitle} body={words.phoneBody} />
        <PhoneReadout digits={phone} placeholder={words.phonePlaceholder} reduced={reduced} />
      </>
    )
  else if (step === "code")
    content = (
      <>
        <StepHeading title={words.codeTitle} body={words.codeBody} />
        <OtpInput className="mt-8" hideLabel label="Code" length={CODE_LENGTH} value={code} onChange={setCode} />
      </>
    )
  else if (step === "birthday")
    content = (
      <>
        <StepHeading title={words.birthdayTitle} body={words.birthdayBody} />
        <TimeWheel
          className="mt-4 -ml-4 w-[calc(100%+2rem)] rounded-none border-0 bg-transparent"
          mode="date"
          label="Birthday"
          today={todayDate}
          maxDate={todayDate}
          defaultValue={birthday}
          onChange={setBirthday}
          shortcuts={false}
        />
      </>
    )
  else
    content = (
      <>
        <StepHeading title={words.nameTitle} body={words.nameBody} focus={false} />
        <div className="mt-8">
          <Input
            data-autofocus=""
            label={words.nameLabel}
            value={name}
            autoComplete="given-name"
            enterKeyHint="done"
            className="text-base"
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault()
                if (stepIndexRef.current === STEPS.indexOf("name")) handlers.current.advance()
              }
            }}
          />
        </div>
      </>
    )

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={words.label}
      className={cn("relative h-[36rem] w-full max-w-[23rem] overflow-hidden rounded-surface border border-border bg-surface text-foreground", className)}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center px-3">
        <button
          type="button"
          aria-label={showBack ? words.back : words.close}
          className="relative grid size-10 flex-none cursor-pointer place-items-center rounded-pill border-0 bg-transparent text-foreground outline-none transition-colors duration-160 ease-standard [-webkit-tap-highlight-color:transparent] pointer-fine:hover:bg-surface-muted motion-reduce:transition-none"
          onClick={back}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={showBack ? "back" : "close"}
              className="grid place-items-center"
              initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: showBack ? 45 : -45, scale: 0.7, filter: `blur(${motionTokens.blur.subtle}px)` }}
              animate={{ opacity: 1, rotate: 0, scale: 1, filter: "blur(0px)" }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: motionTokens.duration.instant } }
                  : { opacity: 0, rotate: showBack ? -45 : 45, scale: 0.7, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.instant, ease: standard } }
              }
              transition={{ duration: reduced ? motionTokens.duration.instant : motionTokens.duration.standard, ease: enter }}
            >
              {showBack ? <CaretLeftIcon size={22} aria-hidden="true" /> : <XIcon size={22} aria-hidden="true" />}
            </motion.span>
          </AnimatePresence>
        </button>
        <div className="absolute left-1/2 -translate-x-1/2">
          <Progress index={dash} label={stepLabel} reduced={reduced} />
        </div>
      </div>

      <AnimatePresence initial={false} custom={direction}>
        <Panel key={step} direction={direction} reduced={reduced} focusOnMount={moved} rootRef={rootRef}>
          {content}
        </Panel>
      </AnimatePresence>

      <motion.div
        aria-hidden={!keypad}
        inert={!keypad}
        className="absolute inset-x-0 bottom-0 bg-surface-muted"
        style={{ height: TRAY }}
        initial={false}
        animate={{ opacity: keypad || !reduced ? 1 : 0, y: keypad || reduced ? 0 : TRAY }}
        transition={slide}
      >
        <Keypad flash={flash} onDigit={pressDigit} onDelete={pressDelete} reduced={reduced} />
      </motion.div>

      {/* One button for the whole flow: it only moves, renames itself and changes colour. */}
      <motion.div
        className="absolute inset-x-5 bottom-5 z-10"
        initial={false}
        animate={{ y: keypad ? -BUTTON_LIFT : 0 }}
        transition={reduced ? { duration: 0 } : slide}
      >
        <motion.button
          type="button"
          data-cta=""
          aria-disabled={!valid || undefined}
          className={cn(
            "grid h-12 w-full place-items-center rounded-pill border-0 text-[15px] font-medium outline-none [-webkit-tap-highlight-color:transparent]",
            "transition-[background-color,color] duration-240 ease-standard motion-reduce:transition-none",
            valid ? "cursor-pointer bg-foreground text-background" : "cursor-not-allowed bg-control-track text-text-muted",
          )}
          whileTap={reduced || !valid ? undefined : { scale: 0.98 }}
          transition={staticTokens.spring.snappy}
          onClick={advance}
        >
          <TextMorph>{ctaLabel}</TextMorph>
        </motion.button>
      </motion.div>

      <span role="status" aria-live="polite" className="sr-only">
        {moved ? stepLabel : ""}
      </span>
    </div>
  )
}

export default OnboardingFlow
