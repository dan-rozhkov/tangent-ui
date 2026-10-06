"use client"

import { forwardRef, useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import type { InputHTMLAttributes } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import type { AnimationPlaybackControls, Transition, Variants } from "motion/react"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface PasswordRule {
  id: string
  label: string
  test: (password: string) => boolean
  /** Characters still missing. Shown as a rolling count beside the rule while it is unmet. */
  remaining?: (password: string) => number
}

export interface PasswordStrengthResult {
  level: 0 | 1 | 2 | 3 | 4
  label: string
  met: string[]
}

/**
 * A new password field that shows how strong the password is while it is typed: four segments fill and change tone,
 * each rule checks off with a drawn tick, and the strength word morphs in place. Use it when creating or changing a password;
 * use a plain password field for sign in. Scoring happens on the device, nothing is sent anywhere.
 */
export interface PasswordStrengthProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "children"
> {
  label: string
  value?: string
  defaultValue?: string
  onValueChange?: (value: string, strength: PasswordStrengthResult) => void
  /** Rules to check. Strength is the share of rules met, spread over four steps. */
  rules?: PasswordRule[]
  /** Error copy tied to the field. The field shakes once each time a new error appears. */
  error?: string
  revealed?: boolean
  onRevealedChange?: (revealed: boolean) => void
}

const count = (password: string) => Array.from(password).length
export const defaultPasswordRules: PasswordRule[] = [
  {
    id: "length",
    label: "At least 12 characters",
    test: password => count(password) >= 12,
    remaining: password => Math.max(0, 12 - count(password)),
  },
  { id: "case", label: "Upper and lowercase letters", test: password => /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password) },
  { id: "number", label: "At least one number", test: password => /\p{N}/u.test(password) },
  { id: "symbol", label: "At least one symbol", test: password => /[^\p{L}\p{N}\s]/u.test(password) },
]

const LEVELS = ["", "Weak", "Fair", "Good", "Strong"] as const
/** Below this length a password stays at the first step, however varied its characters are. */
const SHORT = 8

/** Scores a password on the device: one step per share of rules met, capped at the first step while it is shorter than eight characters. */
export function estimateStrength(password: string, rules: PasswordRule[] = defaultPasswordRules): PasswordStrengthResult {
  if (!password) return { level: 0, label: "", met: [] }
  const met = rules.filter(rule => rule.test(password)).map(rule => rule.id)
  if (count(password) < SHORT) return { level: 1, label: "Too short", met }
  const level = Math.min(4, Math.max(1, Math.round((met.length / Math.max(rules.length, 1)) * 4))) as 1 | 2 | 3 | 4
  return { level, label: LEVELS[level], met }
}

const enter = [...motionTokens.ease.enter] as [number, number, number, number]
const standard = [...motionTokens.ease.standard] as [number, number, number, number]
const subscribe = () => () => {}
/** False on the server and during hydration, so reduced motion never changes the first client render. */
const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

/** The word rises when strength improves and drops when it falls, so the direction reads without looking at the meter. */
const rise: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${0.3 * direction}em`, filter: `blur(${motionTokens.blur.soft}px)` }),
  center: { opacity: 1, y: "0em", filter: "blur(0px)", transition: { duration: motionTokens.duration.standard, ease: enter } },
  exit: (direction: number) => ({
    opacity: 0,
    y: `${-0.3 * direction}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: standard },
  }),
}
const fade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: motionTokens.duration.fast } },
  exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
}
/** Digits turn like a counter: a shrinking count drops in from above, a growing one rises from below. */
const roll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${0.45 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
  center: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: {
      y: motionTokens.spring.snappy,
      opacity: { duration: motionTokens.duration.fast },
      filter: { duration: motionTokens.duration.fast },
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    y: `${-0.45 * direction}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: standard },
  }),
}

function RollingNumber({ value, reduced }: { value: number; reduced: boolean }) {
  const [track, setTrack] = useState({ value, direction: 1 })
  if (track.value !== value) setTrack({ value, direction: value > track.value ? 1 : -1 })
  const digits = String(value).split("")
  // Columns are keyed by place value, so 10 → 9 lets the tens column narrow away while the ones column turns.
  return (
    <span className="inline-flex tabular-nums">
      <AnimatePresence initial={false} custom={track.direction}>
        {digits.map((digit, index) => (
          <motion.span
            key={digits.length - 1 - index}
            className="relative inline-block overflow-x-clip"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={
              reduced ? { duration: 0 } : { width: motionTokens.spring.morph, opacity: { duration: motionTokens.duration.fast } }
            }
          >
            <AnimatePresence mode="popLayout" initial={false} custom={track.direction}>
              <motion.span
                key={digit}
                className="inline-block"
                custom={track.direction}
                variants={reduced ? fade : roll}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {digit}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  )
}

/** One eye that a slash draws across, cutting the outline beneath it, instead of swapping two icons. */
function EyeMorph({ slashed, reduced }: { slashed: boolean; reduced: boolean }) {
  const maskId = `eye-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const slash = { pathLength: slashed ? 1 : 0, opacity: slashed ? 1 : 0 }
  const transition: Transition = reduced
    ? { duration: 0 }
    : {
        pathLength: { duration: motionTokens.duration.standard, ease: standard },
        opacity: { duration: motionTokens.duration.instant },
      }
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none" />
        <motion.path d="M3 3l18 18" stroke="black" strokeWidth={5} initial={false} animate={slash} transition={transition} />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </g>
      <motion.path d="M3 3l18 18" initial={false} animate={slash} transition={transition} />
    </svg>
  )
}

/** The tint grows under the tick while the tick draws from its short stroke; unchecking retracts it faster than it drew. */
function RuleMark({ met, delay, reduced }: { met: boolean; delay: number; reduced: boolean }) {
  return (
    <span
      className={cn(
        "relative block size-4 flex-none rounded-pill border-[1.25px] border-border-strong text-success transition-[border-color] duration-160 ease-standard motion-reduce:transition-none",
        met && "border-transparent"
      )}
      aria-hidden="true"
    >
      <motion.span
        className="absolute -inset-[1.25px] rounded-[inherit] bg-[color-mix(in_oklab,var(--success)_16%,transparent)]"
        initial={false}
        animate={{ scale: met ? 1 : 0.5, opacity: met ? 1 : 0 }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                scale: { ...motionTokens.spring.snappy, delay },
                opacity: { duration: met ? motionTokens.duration.fast : motionTokens.duration.instant, delay },
              }
        }
      />
      <svg
        className="absolute -inset-[1.25px] size-4"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M4.75 8.25 7 10.5l4.25-4.75"
          initial={false}
          animate={{ pathLength: met ? 1 : 0, opacity: met ? 1 : 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : met
                ? {
                    pathLength: { duration: motionTokens.duration.standard, ease: enter, delay: delay + 0.06 },
                    opacity: { duration: 0.05, delay: delay + 0.06 },
                  }
                : {
                    pathLength: { duration: motionTokens.duration.fast, ease: standard },
                    opacity: { duration: motionTokens.duration.fast, delay: 0.06 },
                  }
          }
        />
      </svg>
    </span>
  )
}

/** Error copy opens its row on a spring, then the words settle in. The row follows the measured copy, so a wrap never snaps. */
function ErrorRow({ id, text, reduced }: { id: string; text: string; reduced: boolean }) {
  const copy = useRef<HTMLSpanElement>(null)
  const [height, setHeight] = useState<number | "auto">("auto")
  useEffect(() => {
    const node = copy.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <motion.span
      className="block overflow-hidden"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height, opacity: 1 }}
      exit={{
        height: 0,
        opacity: 0,
        transition: reduced
          ? { duration: 0 }
          : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.instant } },
      }}
      transition={
        reduced ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }
      }
    >
      <span ref={copy} id={id} className="relative block pt-2 text-xs leading-body text-danger">
        <AnimatePresence mode="popLayout" initial={false} custom={1}>
          <motion.span
            key={text}
            className="block"
            custom={1}
            variants={reduced ? fade : rise}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.span>
  )
}

export const PasswordStrength = forwardRef<HTMLInputElement, PasswordStrengthProps>(function PasswordStrength(
  {
    label,
    value: valueProp,
    defaultValue = "",
    onValueChange,
    onChange,
    rules = defaultPasswordRules,
    error,
    revealed: revealedProp,
    onRevealedChange,
    id,
    className,
    ...props
  },
  ref
) {
  const generated = useId()
  const controlId = id ?? generated
  const rulesId = `${controlId}-rules`,
    errorId = `${controlId}-error`
  const hydrated = useHydrated()
  const prefersReduced = useReducedMotion()
  const reduced = hydrated && !!prefersReduced
  const [internal, setInternal] = useState(defaultValue)
  const value = valueProp ?? internal
  const [revealedInternal, setRevealedInternal] = useState(false)
  const revealed = revealedProp ?? revealedInternal
  const strength = estimateStrength(value, rules)
  const met = new Set(strength.met)

  // The previous level and rule states tell which way the word moves and which segments and ticks join a staggered wave.
  const rank = strength.label === "Too short" ? 0.5 : strength.level
  const metKey = strength.met.join(" ")
  const [track, setTrack] = useState({
    rank,
    level: strength.level,
    previousLevel: strength.level,
    direction: 1,
    metKey,
    previousMet: metKey,
  })
  if (track.rank !== rank || track.metKey !== metKey)
    setTrack({
      rank,
      level: strength.level,
      previousLevel: track.rank !== rank ? track.level : track.previousLevel,
      direction: track.rank === rank ? track.direction : rank > track.rank ? 1 : -1,
      metKey,
      previousMet: track.metKey !== metKey ? track.metKey : track.previousMet,
    })
  const previousMet = new Set(track.previousMet.split(" ").filter(Boolean))
  const changed = rules.filter(rule => met.has(rule.id) !== previousMet.has(rule.id)).map(rule => rule.id)

  // Only a change after mount resolves the text, so the field never blurs in on first paint.
  const [reveal, setReveal] = useState({ revealed, changed: false })
  if (reveal.revealed !== revealed) setReveal({ revealed, changed: true })

  // Dots and characters resolve into each other instead of snapping; the effect only runs after a reveal change, never on mount.
  const inputRef = useRef<HTMLInputElement | null>(null)
  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }
  useEffect(() => {
    if (!reveal.changed || reduced) return
    inputRef.current?.animate(
      [
        { opacity: 0.35, filter: "blur(2px)" },
        { opacity: 1, filter: "blur(0px)" },
      ],
      { duration: motionTokens.duration.standard * 1000, easing: `cubic-bezier(${enter.join(",")})` }
    )
  }, [revealed, reveal.changed, reduced])

  const shake = useMotionValue(0)
  const shaking = useRef<AnimationPlaybackControls | null>(null)
  const lastError = useRef(error)
  useEffect(() => {
    const previous = lastError.current
    lastError.current = error
    if (!error || error === previous || reduced) return
    // A spring released with sideways velocity rings out on its own, the way a refused field shakes on a phone.
    shaking.current?.stop()
    shaking.current = animate(shake, 0, { type: "spring", velocity: -240, stiffness: 900, damping: 15, restDelta: 0.1 })
  }, [error, reduced, shake])

  function toggleReveal() {
    if (revealedProp === undefined) setRevealedInternal(!revealed)
    onRevealedChange?.(!revealed)
  }

  const summary = strength.level ? `Strength: ${strength.label}. ${strength.met.length} of ${rules.length} requirements met.` : ""
  const describedBy = [props["aria-describedby"], error ? errorId : undefined, rulesId].filter(Boolean).join(" ")

  return (
    <div
      className="grid min-w-0 [--tone:var(--border-strong)] data-[level=1]:[--tone:var(--danger)] data-[level=2]:[--tone:var(--warning)] data-[level=3]:[--tone:var(--success)] data-[level=4]:[--tone:var(--success)]"
      data-level={strength.level}
    >
      <label className="mb-2 text-sm leading-body font-medium text-foreground" htmlFor={controlId}>
        {label}
      </label>
      <motion.div
        className={cn(
          "flex min-h-control-md items-center gap-1 rounded-control border border-border-strong bg-surface pr-[5px] pl-4",
          "transition-[border-color] duration-160 ease-standard motion-reduce:transition-none",
          "focus-within:border-foreground has-[input[aria-invalid=true]]:border-danger pointer-fine:hover:not-focus-within:border-text-muted"
        )}
        style={{ x: shake }}
      >
        <input
          autoComplete="new-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          {...props}
          ref={setRefs}
          id={controlId}
          type={revealed ? "text" : "password"}
          value={value}
          onChange={event => {
            const next = event.target.value
            if (valueProp === undefined) setInternal(next)
            onChange?.(event)
            onValueChange?.(next, estimateStrength(next, rules))
          }}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={describedBy}
          data-reveal={reveal.changed ? (revealed ? "shown" : "hidden") : undefined}
          className={cn(
            "h-[calc(var(--control-height-md)-2px)] w-full min-w-0 border-0 bg-transparent p-0 text-sm tracking-body text-foreground outline-none placeholder:text-text-muted pointer-coarse:text-base",
            className
          )}
        />
        <button
          type="button"
          className={cn(
            "grid size-[34px] flex-none cursor-pointer place-items-center rounded-[calc(var(--radius-control)-5px)] border-0 bg-transparent p-0 text-text-muted [-webkit-tap-highlight-color:transparent]",
            "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
            "aria-pressed:text-foreground pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
            "active:[transform:scale(.94)] active:[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_100ms_var(--ease-standard)]",
            "motion-reduce:transition-none motion-reduce:active:transform-none"
          )}
          onClick={toggleReveal}
          aria-label="Show password"
          aria-pressed={revealed}
          aria-controls={controlId}
        >
          <EyeMorph slashed={revealed} reduced={reduced} />
        </button>
      </motion.div>
      <AnimatePresence initial={false}>
        {error ? <ErrorRow key="error" id={errorId} text={error} reduced={reduced} /> : null}
      </AnimatePresence>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="grid min-w-0 flex-1 grid-cols-4 gap-[5px]"
          role="meter"
          aria-label="Password strength"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={strength.level}
          aria-valuetext={strength.level ? strength.label : "No password yet"}
        >
          {[0, 1, 2, 3].map(index => {
            const on = index < strength.level
            // A pasted password fills left to right; clearing empties right to left.
            const wave = on ? index - track.previousLevel : track.previousLevel - 1 - index
            return (
              <span key={index} className="relative isolate h-1 overflow-hidden rounded-pill bg-border">
                <motion.span
                  className="absolute inset-0 rounded-[inherit] bg-(--tone) transition-[background-color] duration-240 ease-standard motion-reduce:transition-none"
                  initial={false}
                  animate={{ x: on ? "0%" : "-101%" }}
                  transition={
                    reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, delay: Math.max(0, wave) * (on ? 0.05 : 0.03) }
                  }
                />
              </span>
            )
          })}
        </div>
        <span
          className="relative block h-[1.4em] flex-[0_0_4.5rem] text-right text-sm leading-body font-medium whitespace-nowrap text-foreground"
          aria-hidden="true"
        >
          <AnimatePresence mode="popLayout" initial={false} custom={track.direction}>
            {strength.level ? (
              <motion.span
                key={strength.label}
                className="inline-block"
                custom={track.direction}
                variants={reduced ? fade : rise}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {strength.label}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </div>
      <ul id={rulesId} className="m-0 mt-4 grid list-none gap-[6px] p-0" aria-label="Password requirements">
        {rules.map(rule => {
          const ok = met.has(rule.id)
          const remaining = value && !ok ? (rule.remaining?.(value) ?? 0) : 0
          const order = changed.indexOf(rule.id)
          return (
            <li
              key={rule.id}
              className="group/rule flex min-h-5 items-center gap-2.5 text-sm leading-body text-text-muted transition-colors duration-240 ease-standard data-[met]:text-foreground motion-reduce:transition-none"
              data-met={ok || undefined}
            >
              <RuleMark met={ok} delay={order > 0 ? order * 0.05 : 0} reduced={reduced} />
              <span className="min-w-0">
                {rule.label}
                <span className="sr-only">{ok ? ", met" : ", not met"}</span>
              </span>
              <span className="relative ml-auto block pl-2 text-xs whitespace-nowrap text-text-muted" aria-hidden="true">
                <AnimatePresence mode="popLayout" initial={false} custom={1}>
                  {remaining > 0 ? (
                    <motion.span
                      key="remaining"
                      className="inline-flex items-baseline gap-[.28em]"
                      custom={1}
                      variants={reduced ? fade : rise}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      <RollingNumber value={remaining} reduced={reduced} /> more
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </span>
            </li>
          )
        })}
      </ul>
      <span className="sr-only" role="status">
        {summary}
      </span>
    </div>
  )
})

PasswordStrength.displayName = "PasswordStrength"

export default PasswordStrength
