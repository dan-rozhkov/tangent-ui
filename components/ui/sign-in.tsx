"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useMotionValue,
  type Transition,
  type Variants,
} from "motion/react"
import { Check, Key } from "@mynaui/icons-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OtpInput } from "@/components/ui/otp-input"
import { avatar } from "@/lib/media"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

type Step = "email" | "code" | "done"
type Provider = "Google" | "Apple" | "GitHub"
export type SignInMethod = "Email code" | "Passkey" | Provider
export interface SignInAccount {
  name: string
  email: string
  photo?: string
}
export interface SignInProps {
  /** The code the simulated email contains. */
  demoCode?: string
  /** Called once the simulated sign in succeeds. */
  onSignIn?: (account: SignInAccount, method: SignInMethod) => void
}
type StepCustom = { direction: number; reduce: boolean; still?: boolean }

/* Container queries on the card itself, so the block adapts to the column it sits in rather than the viewport. */
const styles = {
  step: "grid min-w-0 p-8 [@container_sign-in_(max-width:380px)]:px-5 [@container_sign-in_(max-width:380px)]:py-6",
  heading: "mb-6 grid gap-2",
  title:
    "m-0 font-display text-(length:--text-3xl) leading-display font-normal tracking-display text-balance outline-none [@container_sign-in_(max-width:380px)]:text-(length:--text-2xl)",
  lead: "m-0 text-(length:--text-sm) leading-body text-pretty text-text-secondary",
  form: "grid gap-4",
  wide: "w-full",
  textButton:
    "cursor-pointer rounded-[4px] border-0 bg-transparent p-0 font-medium text-foreground underline decoration-border-strong underline-offset-3 transition-[text-decoration-color] duration-160 ease-standard pointer-fine:hover:decoration-current motion-reduce:transition-none",
  providerMark: "flex-none",
  /* Both steps render the large photo and size it here, so the morph never waits on a second image. */
  avatarFill: "size-full text-[length:inherit]",
  detailRow: "flex justify-between gap-4 border-b border-border py-3 text-(length:--text-sm) leading-body",
}

const RESEND_SECONDS = 30
const providers: Provider[] = ["Google", "Apple", "GitHub"]
/** The official four-colour Google "G"; Apple and GitHub ship monochrome marks, drawn in currentColor below. */
function GoogleLogo() {
  return (
    <svg className={styles.providerMark} width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
const providerMarks: Record<Provider, string> = {
  Google:
    "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
  Apple:
    "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701",
  GitHub:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
}
const people: SignInAccount[] = [
  { name: "Emma Collins", email: "emma@northwind.studio", photo: avatar("emma-collins") },
  { name: "Marcus Johnson", email: "marcus@northwind.studio", photo: avatar("marcus-johnson") },
  { name: "Ava Mitchell", email: "ava@northwind.studio", photo: avatar("ava-mitchell") },
  { name: "Jasmine Brooks", email: "jasmine@northwind.studio", photo: avatar("jasmine-brooks") },
  { name: "Sofia Ramirez", email: "sofia@northwind.studio", photo: avatar("sofia-ramirez") },
]
const domainFixes: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmial.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
  "yaho.com": "yahoo.com",
}

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
function suggestionFor(value: string) {
  const [local, domain, extra] = value.trim().toLowerCase().split("@")
  return local && domain && extra === undefined && domainFixes[domain] ? `${local}@${domainFixes[domain]}` : ""
}
/** Known teammates keep their photo; anyone else gets a name from their address and an initials avatar. */
function accountFor(value: string): SignInAccount {
  const email = value.trim().toLowerCase()
  const parts = email.split("@")[0].split(/[._+-]+/).filter(Boolean)
  const known = people.find((person) => person.name.toLowerCase().split(" ")[0] === parts[0])
  if (known) return { ...known, email }
  return {
    name:
      parts
        .slice(0, 2)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" ") || "Tangent member",
    email,
  }
}

const stepMotion: Variants = {
  enter: ({ direction, reduce, still }: StepCustom) =>
    still
      ? { opacity: 1, x: 0, filter: "blur(0px)" }
      : reduce
        ? { opacity: 0 }
        : { opacity: 0, x: direction * 28, filter: `blur(${motionTokens.blur.soft}px)` },
  center: ({ reduce }: StepCustom) => ({
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: reduce
      ? { duration: motionTokens.duration.instant }
      : {
          x: motionTokens.spring.smooth,
          opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], delay: 0.05 },
          filter: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
        },
  }),
  exit: ({ direction, reduce }: StepCustom) =>
    reduce
      ? { opacity: 0, transition: { duration: 0 } }
      : {
          opacity: 0,
          x: direction * -20,
          filter: `blur(${motionTokens.blur.soft}px)`,
          transition: {
            x: motionTokens.spring.smooth,
            opacity: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] },
            filter: { duration: motionTokens.duration.exit },
          },
        },
}
/** Seconds roll down while the timer runs and back up when a new code restarts it. */
const roll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${-0.7 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: (direction: number) => ({ opacity: 0, y: `${0.7 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
}

function RollingTime({ seconds, reduce }: { seconds: number; reduce: boolean }) {
  const [shown, setShown] = useState({ seconds, direction: 1 })
  if (shown.seconds !== seconds) setShown({ seconds, direction: seconds < shown.seconds ? 1 : -1 })
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  const transition: Transition = reduce
    ? { duration: 0 }
    : {
        y: motionTokens.spring.snappy,
        opacity: { duration: motionTokens.duration.fast },
        filter: { duration: motionTokens.duration.fast },
      }
  return (
    <span className="inline-flex tabular-nums">
      {text.split("").map((character, index) => (
        <span key={index} className="relative inline-flex justify-center *:inline-block">
          <AnimatePresence initial={false} mode="popLayout" custom={shown.direction}>
            <motion.span
              key={character}
              custom={shown.direction}
              variants={roll}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              {character}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}

/** The card follows its content on a spring only while the step changes; otherwise it stays auto, so field messages open without lag. */
function useStepHeight(step: Step, reduce: boolean) {
  const track = useRef<HTMLDivElement>(null)
  const height = useMotionValue<number | "auto">("auto")
  const measured = useRef(0)
  const gliding = useRef(false)
  const lastStep = useRef(step)
  const glide = useCallback(
    (to: number) => {
      gliding.current = true
      animate(height, to, {
        ...motionTokens.spring.smooth,
        onComplete: () => {
          gliding.current = false
          height.jump("auto")
        },
      })
    },
    [height],
  )
  useEffect(() => {
    const node = track.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      measured.current = entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight
      if (gliding.current) glide(measured.current)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [glide])
  useLayoutEffect(() => {
    if (lastStep.current === step) return
    lastStep.current = step
    const current = height.get()
    const from = typeof current === "number" ? current : measured.current
    const to = track.current?.offsetHeight ?? 0
    if (reduce || !from || !to) {
      gliding.current = false
      height.jump("auto")
      return
    }
    if (current === "auto") height.jump(from)
    glide(to)
  }, [step, reduce, height, glide])
  return { track, height }
}

export function SignIn({ demoCode = "123456", onSignIn }: SignInProps) {
  const id = useId()
  const reduce = !!useReducedMotion()
  const [step, setStep] = useState<Step>("email")
  const [direction, setDirection] = useState(1)
  const [email, setEmail] = useState("")
  const [touched, setTouched] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState("")
  const [resendIn, setResendIn] = useState(RESEND_SECONDS)
  const [busy, setBusy] = useState<null | "email" | "code" | "passkey" | Provider>(null)
  const [account, setAccount] = useState<SignInAccount>(people[0])
  const [method, setMethod] = useState<SignInMethod>("Email code")
  const [status, setStatus] = useState("")
  const emailRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const focusNext = useRef<"email" | "done" | null>(null)
  const timers = useRef<number[]>([])
  const { track, height } = useStepHeight(step, reduce)

  const emailError =
    (touched || attempted) && !isEmail(email)
      ? email.trim()
        ? "Enter a full address, like name@example.com."
        : "Enter your email address."
      : ""
  const suggestion = touched || attempted ? suggestionFor(email) : ""
  const custom: StepCustom = { direction, reduce }
  const avatarTransition: Transition = reduce ? { duration: 0 } : motionTokens.spring.morph
  const rise = (index: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: `blur(${motionTokens.blur.soft}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: (reduce
      ? { duration: motionTokens.duration.instant }
      : {
          y: { ...motionTokens.spring.smooth, delay: 0.14 + index * motionTokens.stagger.line },
          opacity: {
            duration: motionTokens.duration.standard,
            ease: [...motionTokens.ease.enter],
            delay: 0.14 + index * motionTokens.stagger.line,
          },
          filter: { duration: motionTokens.duration.standard, delay: 0.14 + index * motionTokens.stagger.line },
        }) as Transition,
  })

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(window.clearTimeout)
  }, [])
  useEffect(() => {
    if (step !== "code" || resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [step, resendIn])
  useEffect(() => {
    const target = focusNext.current
    focusNext.current = null
    if (target === "email") {
      emailRef.current?.focus()
      emailRef.current?.select()
    }
    if (target === "done") doneRef.current?.focus()
  }, [step])

  function later(run: () => void, ms: number) {
    timers.current.push(window.setTimeout(run, ms))
  }
  function go(next: Step, towards: number, focus: "email" | "done" | null = null) {
    focusNext.current = focus
    setDirection(towards)
    setStep(next)
  }
  const focusCode = () => codeRef.current?.querySelector("input")?.focus()

  function complete(next: SignInAccount, how: SignInMethod) {
    setBusy(null)
    setAccount(next)
    setMethod(how)
    go("done", 1, "done")
    setStatus(`Signed in with ${how === "Email code" ? "an email code" : how}`)
    onSignIn?.(next, how)
  }

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setAttempted(true)
    if (!isEmail(email)) {
      emailRef.current?.focus()
      return
    }
    setBusy("email")
    setStatus("Sending a code")
    later(() => {
      setBusy(null)
      setAccount(accountFor(email))
      setCode("")
      setCodeError("")
      setResendIn(RESEND_SECONDS)
      go("code", 1)
      setStatus("Code sent")
    }, 800)
  }

  function applySuggestion() {
    setEmail(suggestion)
    setStatus(`Email changed to ${suggestion}`)
    emailRef.current?.focus()
  }

  function verify(value: string) {
    if (busy) return
    if (value.length < 6) {
      setCodeError("Enter all 6 digits.")
      focusCode()
      return
    }
    setBusy("code")
    setStatus("Checking code")
    later(() => {
      if (value === demoCode) {
        complete(account, "Email code")
        return
      }
      setBusy(null)
      setCode("")
      setCodeError("That code didn't match. Check the latest email and try again.")
      setStatus("Code didn't match")
      focusCode()
    }, 700)
  }

  function changeCode(value: string) {
    if (busy) return
    setCode(value)
    if (codeError && value) setCodeError("")
    if (value.length === 6) verify(value)
  }

  function resend() {
    if (busy || resendIn > 0) return
    setResendIn(RESEND_SECONDS)
    setCode("")
    setCodeError("")
    setStatus("New code sent")
    focusCode()
  }

  function changeEmail() {
    if (busy) return
    setAttempted(false)
    go("email", -1, "email")
    setStatus("Edit your email")
  }

  function signInWith(how: "passkey" | Provider) {
    if (busy) return
    setBusy(how)
    setStatus(how === "passkey" ? "Waiting for your passkey" : `Opening ${how}`)
    later(() => complete(people[0], how === "passkey" ? "Passkey" : how), how === "passkey" ? 1100 : 900)
  }

  function signOut() {
    setEmail(account.email)
    setTouched(false)
    setAttempted(false)
    setCode("")
    go("email", -1, "email")
    setStatus("Signed out")
  }

  return (
    <section
      className="@container/sign-in w-[min(100%,432px)] min-w-0 overflow-hidden rounded-surface border border-border bg-surface font-body tracking-body text-foreground max-[480px]:rounded-panel"
      aria-label="Sign in"
    >
      <LayoutGroup id={id}>
        {/* Clips the leaving step while the height glides. Steps carry their own padding, so focus rings never reach the clip. */}
        <motion.div className="overflow-hidden" style={{ height }}>
          {/* The leaving step pops out against this box. */}
          <div ref={track} className="relative">
            <AnimatePresence mode="popLayout" initial={false} custom={custom}>
              {step === "email" && (
                <motion.div key="email" className={styles.step} custom={custom} variants={stepMotion} initial="enter" animate="center" exit="exit">
                  <div className={styles.heading}>
                    <h2 className={styles.title}>Sign in to Tangent</h2>
                    <p className={styles.lead}>Enter your email and we will send you a 6 digit code.</p>
                  </div>
                  <form className={styles.form} onSubmit={submitEmail} noValidate>
                    {/* No gap inside: a closing suggestion row would otherwise leave a gap behind until it unmounts. */}
                    <div className="grid min-w-0">
                      <Input
                        ref={emailRef}
                        label="Email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="name@example.com"
                        value={email}
                        readOnly={busy === "email"}
                        error={emailError}
                        onChange={(event) => setEmail(event.target.value)}
                        onBlur={() => {
                          if (email.trim()) setTouched(true)
                        }}
                      />
                      <AnimatePresence initial={false}>
                        {suggestion && (
                          <motion.div
                            key="suggestion"
                            className="overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={
                              reduce
                                ? { duration: 0 }
                                : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }
                            }
                          >
                            <p className="m-0 pt-2 pb-1 text-(length:--text-xs) leading-body wrap-anywhere text-text-secondary">
                              Did you mean{" "}
                              <button
                                type="button"
                                className={styles.textButton}
                                aria-label={`Use ${suggestion}`}
                                onClick={applySuggestion}
                              >
                                {suggestion}
                              </button>
                              ?
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <Button type="submit" className={styles.wide} loading={busy === "email"}>
                      Continue
                    </Button>
                  </form>
                  <div className="my-5 flex items-center gap-3 text-(length:--text-xs) leading-none text-text-muted before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']">
                    or
                  </div>
                  <div className="grid gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className={styles.wide}
                      loading={busy === "passkey"}
                      onClick={() => signInWith("passkey")}
                    >
                      <Key size={16} strokeWidth={1.75} aria-hidden="true" />
                      Sign in with a passkey
                    </Button>
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Single sign-on">
                      {providers.map((provider) => (
                        <Button
                          key={provider}
                          type="button"
                          variant="secondary"
                          className="min-w-0 px-2 [@container_sign-in_(max-width:380px)]:gap-1.5 [@container_sign-in_(max-width:380px)]:text-(length:--text-xs)"
                          aria-label={`Continue with ${provider}`}
                          loading={busy === provider}
                          onClick={() => signInWith(provider)}
                        >
                          {provider === "Google" ? (
                            <GoogleLogo />
                          ) : (
                            <svg className={styles.providerMark} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d={providerMarks[provider]} />
                            </svg>
                          )}
                          {provider}
                        </Button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === "code" && (
                <motion.div key="code" className={styles.step} custom={custom} variants={stepMotion} initial="enter" animate="center" exit="exit">
                  <div className={styles.heading}>
                    <h2 className={styles.title}>Check your email</h2>
                    <p className={styles.lead}>Enter the 6 digit code we sent. It expires in 10 minutes.</p>
                  </div>
                  {/* The account being signed in to. Its avatar is the one that grows into the signed in state. */}
                  <div className="mb-6 flex min-w-0 items-center gap-3 rounded-control border border-border py-2 pr-2 pl-3 [@container_sign-in_(max-width:380px)]:gap-2 [@container_sign-in_(max-width:380px)]:pl-2">
                    <motion.span
                      layoutId="account-avatar"
                      className="relative z-1 inline-flex size-8 flex-none text-(length:--text-xs)"
                      transition={avatarTransition}
                    >
                      <Avatar name={account.name} src={account.photo} size="xl" className={styles.avatarFill} />
                    </motion.span>
                    <span className="min-w-0 flex-1 text-(length:--text-sm) leading-body wrap-anywhere">{account.email}</span>
                    <Button type="button" variant="ghost" size="sm" className="flex-none" aria-label="Change email" onClick={changeEmail}>
                      Change
                    </Button>
                  </div>
                  <form
                    className={styles.form}
                    onSubmit={(event) => {
                      event.preventDefault()
                      verify(code)
                    }}
                    noValidate
                  >
                    <div ref={codeRef}>
                      <OtpInput
                        label="Verification code"
                        description={`For this demo, the code is ${demoCode}.`}
                        value={code}
                        onChange={changeCode}
                        error={codeError}
                        autoFocus
                      />
                    </div>
                    <Button type="submit" className={styles.wide} loading={busy === "code"}>
                      Verify
                    </Button>
                  </form>
                  <button
                    type="button"
                    className={cn(
                      "relative mt-3 -mb-2 -ml-2 inline-flex min-h-control-sm cursor-pointer items-center justify-self-start rounded-pill border-0 bg-transparent px-2",
                      "text-(length:--text-sm) leading-body font-medium text-foreground",
                      "transition-[color,background-color] duration-160 ease-standard motion-reduce:transition-none",
                      "aria-disabled:cursor-default aria-disabled:font-normal aria-disabled:text-text-muted pointer-fine:hover:not-aria-disabled:bg-surface-muted",
                    )}
                    aria-disabled={resendIn > 0 || undefined}
                    aria-label={resendIn > 0 ? `Resend code, available in ${resendIn} seconds` : "Resend code"}
                    onClick={resend}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={resendIn > 0 ? "wait" : "ready"}
                        className="inline-flex items-baseline gap-[.3em] whitespace-nowrap"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.soft}px)` }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={
                          reduce
                            ? { opacity: 0, transition: { duration: 0 } }
                            : {
                                opacity: 0,
                                y: -4,
                                filter: `blur(${motionTokens.blur.subtle}px)`,
                                transition: { duration: motionTokens.duration.fast },
                              }
                        }
                        transition={
                          reduce
                            ? { duration: motionTokens.duration.instant }
                            : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
                        }
                      >
                        {resendIn > 0 ? (
                          <>
                            Resend code in <RollingTime seconds={resendIn} reduce={reduce} />
                          </>
                        ) : (
                          "Resend code"
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                </motion.div>
              )}

              {step === "done" && (
                <motion.div
                  key="done"
                  className={styles.step}
                  custom={{ ...custom, still: true }}
                  variants={stepMotion}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <div className="relative mb-6 -ml-1 size-24">
                    <svg className="absolute inset-0 size-full -rotate-90 overflow-visible text-success" viewBox="0 0 96 96" aria-hidden="true">
                      <motion.circle
                        cx="48"
                        cy="48"
                        r="47"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{
                          pathLength: {
                            duration: motionTokens.duration.considered * 1.25,
                            ease: [...motionTokens.ease.inOut],
                            delay: 0.22,
                          },
                          opacity: { duration: motionTokens.duration.instant, delay: 0.22 },
                        }}
                      />
                    </svg>
                    <motion.span
                      layoutId="account-avatar"
                      className="absolute inset-1 z-1 inline-flex flex-none text-(length:--text-2xl)"
                      initial={method === "Email code" || reduce ? false : { opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={avatarTransition}
                    >
                      <Avatar name={account.name} src={account.photo} size="xl" className={styles.avatarFill} />
                    </motion.span>
                    <motion.span
                      className="absolute right-0.5 bottom-1 z-2 grid size-[26px] place-items-center rounded-pill border-2 border-surface bg-success text-surface"
                      aria-hidden="true"
                      initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...motionTokens.spring.snappy, delay: 0.78 }}
                    >
                      <Check size={14} strokeWidth={2.25} />
                    </motion.span>
                  </div>
                  <motion.div className={styles.heading} {...rise(0)}>
                    <h2 ref={doneRef} tabIndex={-1} className={styles.title}>
                      Welcome back, {account.name.split(" ")[0]}
                    </h2>
                    <p className={cn(styles.lead, "wrap-anywhere")}>{account.email}</p>
                  </motion.div>
                  <motion.dl className="m-0 mb-6 grid border-t border-border p-0" {...rise(1)}>
                    <div className={styles.detailRow}>
                      <dt className="text-text-secondary">Signed in with</dt>
                      <dd className="m-0 text-right">{method}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt className="text-text-secondary">This browser</dt>
                      <dd className="m-0 text-right">Remembered for 30 days</dd>
                    </div>
                  </motion.dl>
                  <motion.div {...rise(2)}>
                    <Button type="button" variant="secondary" className={styles.wide} onClick={signOut}>
                      Sign out
                    </Button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </LayoutGroup>

      <footer className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-8 py-3 text-(length:--text-xs) leading-body text-text-muted [@container_sign-in_(max-width:380px)]:px-5">
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
        <span className="relative block min-w-0 flex-[1_1_12rem]" aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={status}
              className="block truncate"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.soft}px)` }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0, transition: { duration: 0 } }
                  : {
                      opacity: 0,
                      y: -4,
                      filter: `blur(${motionTokens.blur.subtle}px)`,
                      transition: { duration: motionTokens.duration.fast },
                    }
              }
              transition={
                reduce
                  ? { duration: motionTokens.duration.instant }
                  : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
              }
            >
              {status}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="whitespace-nowrap text-text-secondary">
          No account?{" "}
          <button type="button" className={cn(styles.textButton, "decoration-transparent")} onClick={() => setStatus("Sign up opens in your app")}>
            Sign up
          </button>
        </span>
      </footer>
    </section>
  )
}

export default SignIn
