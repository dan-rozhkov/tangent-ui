"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import type { Variants } from "motion/react";
import { ArrowRight } from "lucide-react";
import AnimatedCounter from "@/components/ui/animated-counter";
import SegmentedControl from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { newsletterCopy, newsletterPublication, newsletterReaders } from "./newsletter-signup-data";
import type { NewsletterIssue, NewsletterPublication } from "./newsletter-signup-data";
import { useReducedMotion } from "@/lib/reduced-motion";

export type { NewsletterIssue, NewsletterPublication, NewsletterStory } from "./newsletter-signup-data";

const textLink = "text-foreground underline decoration-border-strong underline-offset-[3px] transition-[text-decoration-color] duration-160 ease-standard motion-reduce:transition-none pointer-fine:hover:decoration-current";
export type NewsletterVariant = "inline" | "card";

export interface NewsletterSignupProps {
  /** `inline` puts the copy and form beside the issue stack; `card` is a self-contained card with the stack in a tray on top. */
  variant?: NewsletterVariant;
  title?: string;
  description?: string;
  placeholder?: string;
  buttonLabel?: string;
  /** Short line under the form about frequency and privacy. */
  privacyNote?: ReactNode;
  /** Link after the privacy note. Pass null to hide it. */
  privacyLink?: { label: string; href: string } | null;
  /** Reader count and up to three faces. The count ticks up by one when someone subscribes. Pass null to hide it. */
  readers?: { count: number; faces: string[] } | null;
  /** The issue stack. On success the upcoming issue, addressed to the new reader, lands on top. Pass null for a form without the stack. */
  publication?: NewsletterPublication | null;
  /** Called with a valid, trimmed email. Reject to show an error and keep the email; resolve to show the success state. */
  onSubscribe?: (email: string) => void | Promise<void>;
  className?: string;
}

type Phase = "idle" | "sending" | "done";
type Problem = { kind: "invalid" | "failed"; text: string };
type Bezier = [number, number, number, number];
const enter = [...motionTokens.ease.enter] as Bezier;
const standard = [...motionTokens.ease.standard] as Bezier;
const MESSAGES = {
  empty: "Enter your email address",
  format: "Enter an email like name@company.com",
  failed: "That didn't go through. Your email is kept, so try again.",
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** How far each issue behind the front one peeks out above it. */
const STEP = 12;

function validate(value: string): Problem | null {
  const email = value.trim();
  if (!email) return { kind: "invalid", text: MESSAGES.empty };
  if (!EMAIL.test(email)) return { kind: "invalid", text: MESSAGES.format };
  return null;
}

const swapIn = { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` };
const swapShown = { opacity: 1, y: 0, filter: "blur(0px)" };
const swapOut = { opacity: 0, y: -6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: standard } };
const fadeIn = { opacity: 0 };
const fadeOut = { opacity: 0, transition: { duration: motionTokens.duration.instant } };

/** A line that swaps in place: the old text lifts away and the new one rises out of a soft blur. */
function Swap({ id, children, reduced, className, live }: { id: string; children: ReactNode; reduced: boolean; className?: string; live?: "polite" }) {
  return <div className={className} aria-live={live}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div key={id} initial={reduced ? fadeIn : swapIn} animate={swapShown} exit={reduced ? fadeOut : swapOut} transition={{ duration: reduced ? motionTokens.duration.instant : motionTokens.duration.standard, ease: enter }}>{children}</motion.div>
    </AnimatePresence>
  </div>;
}

/** One issue: masthead, recipient line, subject, and three stories with thumbnails. */
function IssueCard({ issue, name, to }: { issue: NewsletterIssue; name: string; to?: string }) {
  return <>
    <header className="flex items-baseline justify-between gap-3">
      <span className="font-display text-(length:--text-xl) font-medium tracking-display leading-display">{name}</span>
      <span className="text-(length:--text-xs) leading-body text-text-muted tabular-nums">Issue {issue.number}</span>
    </header>
    {/* The recipient matters more than the date once the issue is addressed and the container is narrow. */}
    <p className="mx-0 mt-0.5 mb-0 flex min-w-0 gap-1.5 text-(length:--text-xs) leading-body whitespace-nowrap text-text-muted tabular-nums [&>span:last-child]:min-w-0 [&>span:last-child]:overflow-hidden [&>span:last-child]:text-ellipsis @max-[400px]/newsletter:[&:has([data-recipient])>:not([data-recipient])]:hidden">
      <span>{issue.date}</span>
      {to && <><span aria-hidden="true">&middot;</span><span data-recipient="" className="text-text-secondary">To <span className="text-foreground">{to}</span></span></>}
    </p>
    <h3 className="mt-5 mb-4 box-content min-h-[calc(2em*var(--leading-display))] border-t border-border pt-5 font-display text-(length:--text-2xl) font-medium tracking-display leading-display text-balance group-data-[compact]/stack:text-(length:--text-xl) @max-[520px]/newsletter:text-(length:--text-xl)">{issue.subject}</h3>
    <ul className="m-0 grid list-none gap-2.5 p-0">
      {issue.stories.slice(0, 3).map(story => <li key={story.title} className="grid min-h-11 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 @max-[400px]/newsletter:grid-cols-[44px_minmax(0,1fr)]">
        <Image className="block size-11 rounded-[10px] bg-surface-muted object-cover" src={story.image} alt="" width={88} height={88} sizes="44px" />
        <span className="line-clamp-2 text-(length:--text-sm) leading-body text-text-secondary text-pretty">{story.title}</span>
        <span className="text-(length:--text-xs) whitespace-nowrap text-text-muted tabular-nums @max-[400px]/newsletter:hidden">{story.minutes} min</span>
      </li>)}
    </ul>
  </>;
}

/** Every issue shares one grid cell, so the stack is as tall as one issue and nothing shifts when they trade places. */
const issueClass = cn(
  "grid min-w-0 content-start [grid-area:1/1] origin-[50%_0] rounded-[22px] border border-border bg-(--paper) px-[22px] pt-[22px] pb-[18px] shadow-(--paper-shadow)",
  "transition-[background-color] duration-480 ease-standard motion-reduce:transition-none",
  "data-[depth='1']:bg-(--paper-back) data-[depth='1']:shadow-none data-[depth='2']:bg-(--paper-far) data-[depth='2']:shadow-none [.tray_&]:shadow-none",
  "@max-[520px]/newsletter:rounded-[20px] @max-[520px]/newsletter:px-[18px] @max-[520px]/newsletter:pt-[18px] @max-[520px]/newsletter:pb-4",
);

type Placement = { depth: number; upcoming: boolean };
/** The front issue sits flat; each one behind steps up and shrinks a little so its top edge shows. */
const stackVariants: Variants = {
  placed: ({ depth }: Placement) => ({ opacity: 1, y: -depth * STEP, scale: 1 - depth * .045 }),
  // The upcoming issue arrives from below, where the form is; older ones slide in from behind.
  away: ({ upcoming }: Placement) => upcoming ? { opacity: 0, y: 56, scale: 1 } : { opacity: 0, y: -3 * STEP, scale: 1 - 3 * .045 },
};
/** Position rides the no-overshoot spring; opacity resolves fast so two issues never read through each other. */
const settle = { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.instant, ease: standard } };
/** Reduced motion: issues take their places at once and only fade. */
const still = { duration: 0, opacity: { duration: motionTokens.duration.fast } };

/**
 * A stack of recent issues. When someone subscribes, the upcoming issue, addressed to them, lands on the front
 * and the older ones step back; the oldest drops away.
 */
function IssueStack({ publication, delivered, to, reduced, compact }: { publication: NewsletterPublication; delivered: boolean; to: string; reduced: boolean; compact?: boolean }) {
  const issues = (delivered ? [publication.upcoming, ...publication.recent] : publication.recent).slice(0, 3);
  return <div className="group/stack grid w-full max-w-[440px] pt-6 [.tray_&]:h-full [.tray_&]:[mask-image:linear-gradient(to_bottom,#000_calc(100%-64px),transparent)]" data-compact={compact ? "" : undefined}>
    {/* An unseen copy of the upcoming issue keeps the stack as tall as the tallest issue it will ever hold. */}
    <div className={cn(issueClass, "invisible shadow-none")} aria-hidden="true"><IssueCard issue={publication.upcoming} name={publication.name} to={to || " "} /></div>
    <AnimatePresence initial={false}>
      {issues.map((issue, depth) => {
        const upcoming = issue === publication.upcoming;
        const placement: Placement = { depth, upcoming };
        return <motion.article
          key={issue.number}
          className={issueClass}
          data-depth={depth}
          aria-hidden={depth > 0 ? true : undefined}
          aria-label={depth === 0 ? `${publication.name}, issue ${issue.number}` : undefined}
          custom={placement}
          variants={stackVariants}
          initial="away"
          animate="placed"
          exit="away"
          transition={reduced ? still : settle}
          style={{ zIndex: 3 - depth }}
        >
          <IssueCard issue={issue} name={publication.name} to={upcoming ? to : undefined} />
        </motion.article>;
      })}
    </AnimatePresence>
  </div>;
}

/** Faces and a reader count that ticks up by one when you join. */
function Readers({ readers, done, reduced }: { readers: { count: number; faces: string[] }; done: boolean; reduced: boolean }) {
  return <div className="flex items-center gap-3 text-(length:--text-sm) leading-body text-text-secondary @max-[400px]/newsletter:gap-2 @max-[360px]/newsletter:items-start [.card_&]:mt-5 [.card_&]:border-t [.card_&]:border-border-subtle [.card_&]:pt-5">
    <span className="flex flex-none pl-1.5 [&_img]:-ml-1.5 [&_img]:block [&_img]:size-7 [&_img]:rounded-full [&_img]:border-2 [&_img]:border-background [&_img]:object-cover [.card_&_img]:border-surface @max-[400px]/newsletter:[&_img]:size-6" aria-hidden="true">
      {readers.faces.slice(0, 3).map(src => <Image key={src} src={src} alt="" width={56} height={56} sizes="28px" />)}
    </span>
    <span className="min-w-0 whitespace-nowrap tabular-nums @max-[360px]/newsletter:min-h-[calc(2*1.4em)] @max-[360px]/newsletter:whitespace-normal">
      <span className="inline-block text-foreground [&>span]:align-bottom [&>span]:font-medium [&>span]:[color:inherit] [&>span]:[font-family:inherit] [&>span]:[font-size:inherit] [&>span]:[letter-spacing:inherit] [&>span]:[line-height:inherit]"><AnimatedCounter value={readers.count + (done ? 1 : 0)} /></span>
      {" "}readers
      <AnimatePresence initial={false}>
        {/* The phrase opens its own width on the no-overshoot spring, so the centred line glides instead of jumping sideways. */}
        {done && <motion.span key="you" className="inline-block overflow-hidden align-bottom whitespace-nowrap text-text-secondary"
          initial={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, width: "auto" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
          transition={reduced ? { duration: motionTokens.duration.instant } : { width: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: enter, delay: .12 } }}>, including you</motion.span>}
      </AnimatePresence>
    </span>
  </div>;
}

/**
 * A newsletter signup framed by the newsletter itself: a stack of recent issues. Subscribing drops the next issue,
 * addressed to the new reader, onto the front of the stack and ticks the reader count up by one.
 * Comes as an inline page section or a self-contained card.
 */
export const NewsletterSignup = forwardRef<HTMLElement, NewsletterSignupProps>(function NewsletterSignup({
  variant = "inline",
  title,
  description,
  placeholder = "you@company.com",
  buttonLabel = "Subscribe",
  privacyNote = newsletterCopy.privacy,
  privacyLink = newsletterCopy.privacyLink,
  readers = newsletterReaders,
  publication = newsletterPublication,
  onSubscribe,
  className,
}, ref) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [tried, setTried] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sentTo, setSentTo] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const again = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const refocus = useRef(false);
  const [pill, animatePill] = useAnimate<HTMLDivElement>();
  const copy = newsletterCopy[variant];

  useEffect(() => {
    if (phase === "idle" && refocus.current) { refocus.current = false; input.current?.focus(); }
    if (phase === "done") again.current?.focus();
  }, [phase]);

  function shake() {
    if (reduced || !pill.current) return;
    animatePill(pill.current, { x: [0, -6, 5, -3, 1, 0] }, { duration: .36, ease: "easeOut" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || phase !== "idle") return;
    setTried(true);
    const found = validate(email);
    setProblem(found);
    if (found) { shake(); input.current?.focus(); return; }
    const value = email.trim();
    busy.current = true;
    setPhase("sending");
    try {
      await (onSubscribe ? onSubscribe(value) : new Promise(resolve => setTimeout(resolve, 1100)));
      setSentTo(value);
      setPhase("done");
    } catch {
      setPhase("idle");
      setProblem({ kind: "failed", text: MESSAGES.failed });
      shake();
    } finally {
      busy.current = false;
    }
  }

  function reset() {
    setEmail("");
    setProblem(null);
    setTried(false);
    refocus.current = true;
    setPhase("idle");
  }

  const done = phase === "done";
  const sending = phase === "sending";
  const messageId = `${id}-message`;
  const labelKey = done ? "done" : sending ? "sending" : problem?.kind === "failed" ? "retry" : "idle";
  const labels: Record<string, ReactNode> = {
    idle: <>{buttonLabel}<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" /></>,
    retry: <>Try again<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" /></>,
    sending: <><span className="size-3.5 animate-[spin_700ms_linear_infinite] rounded-full border-2 border-[color-mix(in_oklab,currentColor_30%,transparent)] border-t-current motion-reduce:[animation-duration:1.6s]" aria-hidden="true" />Subscribing</>,
    done: <><span className="inline-flex size-4 [&_svg]:size-4" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .34, ease: enter, delay: .12 }} /></svg></span>Subscribed</>,
  };

  /** Two lines are reserved so the note, an error, and the confirmation never move what sits below. */
  const noteClass = "m-0 pl-[22px] text-(length:--text-sm) leading-body text-text-muted text-pretty @max-[520px]/newsletter:pl-1 @max-[300px]/signup:pl-1";
  const doneText = "Check your inbox to confirm.";
  const note = <>{privacyNote}{privacyLink && <> <a className={textLink} href={privacyLink.href}>{privacyLink.label}</a></>}</>;
  // Plain copies of the note and the confirmation, used only to reserve the line's height.
  const measures = [<>{privacyNote}{privacyLink && ` ${privacyLink.label}`}</>, `${doneText} Use a different email`, MESSAGES.empty, MESSAGES.format, MESSAGES.failed];
  const form = <form className="@container/signup grid min-w-0 gap-3 [.intro_&]:mt-10 [.card_&]:mt-6 @max-[520px]/newsletter:[.intro_&]:mt-8" onSubmit={submit} noValidate aria-label={title ?? copy.title}>
    <motion.div ref={pill} className="relative flex h-[58px] items-center gap-1.5 rounded-full border border-border-strong bg-surface py-[5px] pr-[5px] pl-[22px] transition-[border-color,background-color] duration-160 ease-standard motion-reduce:transition-none pointer-fine:not-data-[done]:hover:border-[color-mix(in_oklab,var(--foreground)_32%,var(--border-strong))] focus-within:border-foreground data-[invalid]:border-danger! data-[done]:border-[color-mix(in_oklab,var(--success)_45%,var(--border))]! @max-[300px]/signup:h-auto @max-[300px]/signup:flex-col @max-[300px]/signup:items-stretch @max-[300px]/signup:gap-2 @max-[300px]/signup:border-0 @max-[300px]/signup:bg-transparent @max-[300px]/signup:p-0 @max-[300px]/signup:data-[invalid]:[&_input]:border-danger @max-[300px]/signup:data-[done]:[&_input]:border-[color-mix(in_oklab,var(--success)_45%,var(--border))]" data-invalid={problem ? "" : undefined} data-done={done ? "" : undefined}>
      <label htmlFor={`${id}-email`} className="sr-only">Email address</label>
      <input
        ref={input}
        id={`${id}-email`}
        className="h-full w-full min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-(length:--text-base) tracking-[inherit] text-foreground outline-none transition-[color] duration-240 ease-standard placeholder:text-text-muted in-data-[done]:text-text-secondary motion-reduce:transition-none @max-[300px]/signup:h-[52px] @max-[300px]/signup:flex-none @max-[300px]/signup:rounded-full @max-[300px]/signup:border @max-[300px]/signup:border-border-strong @max-[300px]/signup:bg-surface @max-[300px]/signup:px-5 @max-[300px]/signup:focus:border-foreground"
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        enterKeyHint="send"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={placeholder}
        value={email}
        readOnly={phase !== "idle"}
        aria-invalid={problem?.kind === "invalid" ? true : undefined}
        aria-describedby={messageId}
        onBlur={() => { if (email.trim() && !tried && phase === "idle") { setTried(true); setProblem(validate(email)); } }}
        onChange={event => { setEmail(event.target.value); if (tried) setProblem(validate(event.target.value)); else if (problem) setProblem(null); }}
      />
      <motion.button
        type={done ? "button" : "submit"}
        className="relative inline-flex h-full min-h-11 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-foreground px-5 font-[inherit] text-(length:--text-sm) font-medium whitespace-nowrap text-background [-webkit-tap-highlight-color:transparent] transition-[background-color,color] duration-240 ease-standard motion-reduce:transition-none pointer-fine:data-[state='idle']:hover:bg-[color-mix(in_oklab,var(--foreground)_84%,var(--background))] pointer-fine:data-[state='retry']:hover:bg-[color-mix(in_oklab,var(--foreground)_84%,var(--background))] data-[state='sending']:cursor-progress data-[state='done']:cursor-default data-[state='done']:bg-[color-mix(in_oklab,var(--success)_13%,var(--surface))] data-[state='done']:text-success @max-[300px]/signup:h-12"
        data-state={labelKey}
        aria-busy={sending || undefined}
        aria-disabled={sending || done || undefined}
        tabIndex={done ? -1 : undefined}
        whileTap={{ scale: reduced || sending || done ? 1 : .97 }}
        transition={motionTokens.spring.snappy}
      >
        <span className="inline-grid place-items-center">
          {Object.keys(labels).map(key => <span key={key} className="invisible inline-flex items-center gap-2 [grid-area:1/1]" aria-hidden="true">{key === "done" ? <><span className="inline-flex size-4" />Subscribed</> : labels[key]}</span>)}
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={labelKey} className="inline-flex items-center gap-2 [grid-area:1/1]" initial={reduced ? fadeIn : swapIn} animate={swapShown} exit={reduced ? fadeOut : swapOut} transition={{ duration: reduced ? motionTokens.duration.instant : motionTokens.duration.standard, ease: enter }}>
              {labels[labelKey]}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.button>
    </motion.div>
    <div className="grid [&>*]:min-w-0 [&>*]:[grid-area:1/1]">
      {/* Every message the line can show sits here unseen, so the line is always as tall as the longest one and nothing below it moves. */}
      {measures.map((text, index) => <p key={index} className={cn(noteClass, "invisible block")} aria-hidden="true">{text}</p>)}
      <Swap id={problem ? `problem-${problem.text}` : done ? "done" : "note"} reduced={reduced} className="relative" live="polite">
        <p id={messageId} className={cn(noteClass, "data-[tone='error']:text-danger data-[tone='success']:text-text-secondary")} data-tone={problem ? "error" : done ? "success" : undefined} role={problem ? "alert" : undefined}>
          {problem?.text ?? (done
            ? <>{doneText}<span className="sr-only"> The link went to {sentTo}.</span> <button ref={again} type="button" className={cn(textLink, "cursor-pointer border-0 bg-transparent p-0 font-[inherit]")} onClick={reset}>Use a different email</button></>
            : note)}
        </p>
      </Swap>
    </div>
  </form>;

  const descriptionClass = "m-0 text-(length:--text-lg) leading-body text-text-secondary text-pretty";
  const root = cn(
    "@container/newsletter bg-background text-start font-body tracking-body text-foreground [--paper:var(--surface-raised)] [--paper-back:color-mix(in_oklab,var(--surface-raised),var(--surface-muted)_55%)] [--paper-far:var(--surface-muted)] [--paper-shadow:0_1px_1px_oklch(0%_0_0/.03),0_10px_28px_-6px_oklch(0%_0_0/.09)] [&_*]:box-border dark:[--paper:oklch(24.5%_0_0)] dark:[--paper-back:oklch(22.5%_0_0)] dark:[--paper-far:oklch(21%_0_0)] dark:[--paper-shadow:0_1px_1px_oklch(0%_0_0/.2),0_14px_32px_-6px_oklch(0%_0_0/.45)]",
    variant === "card" && "px-6 py-20 @max-[520px]/newsletter:px-4 @max-[520px]/newsletter:py-10",
    className,
  );

  const aside = !!(publication || readers);

  if (variant === "card") {
    return <section ref={ref} className={root} data-variant="card" aria-labelledby={`${id}-title`}>
      {/* The shell spans the section so a host layout can set its gutter without reaching into the card. */}
      <div className="grid w-full place-items-center">
      <div className="card grid w-[min(100%,460px)] overflow-hidden rounded-surface border border-border bg-surface shadow-resting @max-[520px]/newsletter:rounded-[28px]">
        {publication && <div className="tray grid h-[248px] grid-rows-[minmax(0,1fr)] justify-items-center overflow-hidden border-b border-border bg-surface-muted px-8 pt-5 pb-0 dark:bg-background @max-[520px]/newsletter:h-[232px] @max-[520px]/newsletter:px-5 @max-[520px]/newsletter:pt-4">
          <IssueStack publication={publication} delivered={done} to={sentTo} reduced={reduced} compact />
        </div>}
        <div className="grid p-8 @max-[520px]/newsletter:p-6">
          <h2 id={`${id}-title`} className="m-0 font-display text-(length:--text-2xl) font-medium tracking-display leading-display text-balance">{title ?? copy.title}</h2>
          <p className={cn(descriptionClass, "mt-2 text-(length:--text-base)")}>{description ?? copy.description}</p>
          {form}
          {readers && <Readers readers={readers} done={done} reduced={reduced} />}
        </div>
      </div>
      </div>
    </section>;
  }

  return <section ref={ref} className={root} data-variant="inline" aria-labelledby={`${id}-title`}>
    <div className={cn("mx-auto grid max-w-[1120px] grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-12 px-8 py-24 @max-[860px]/newsletter:grid-cols-[minmax(0,1fr)] @max-[860px]/newsletter:gap-12 @max-[860px]/newsletter:px-8 @max-[860px]/newsletter:py-16 @max-[520px]/newsletter:gap-10 @max-[520px]/newsletter:px-4 @max-[520px]/newsletter:py-12", aside ? "grid-cols-[minmax(0,1fr)_minmax(0,440px)] items-center" : "max-w-[720px]")}>
      <div className="intro grid max-w-[540px] @max-[860px]/newsletter:max-w-[600px]">
        <h2 id={`${id}-title`} className="m-0 font-display text-[length:clamp(2rem,1.1rem+3.2cqi,var(--text-4xl))] font-medium tracking-display leading-display text-balance">{title ?? copy.title}</h2>
        <p className={cn(descriptionClass, "mt-4 @max-[520px]/newsletter:text-(length:--text-base)")}>{description ?? copy.description}</p>
        {form}
      </div>
      {aside && <div className="grid min-w-0 justify-items-center gap-6">
        {publication && <IssueStack publication={publication} delivered={done} to={sentTo} reduced={reduced} />}
        {readers && <Readers readers={readers} done={done} reduced={reduced} />}
      </div>}
    </div>
  </section>;
});

NewsletterSignup.displayName = "NewsletterSignup";

const variantOptions = [{ value: "inline", label: "Inline" }, { value: "card", label: "Card" }];

/** Preview: both layouts. Subscribing is simulated and nothing is sent; the switch makes the next send fail. */
export function NewsletterSignupBlock() {
  const [variant, setVariant] = useState<NewsletterVariant>("inline");
  const [fail, setFail] = useState(false);
  const switchId = useId();
  const simulate = () => new Promise<void>((resolve, reject) => setTimeout(() => fail ? reject(new Error("Simulated failure")) : resolve(), 1100));
  return <div className="grid w-full justify-items-center gap-4">
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
      <SegmentedControl label="Newsletter layout" options={variantOptions} value={variant} onValueChange={next => setVariant(next as NewsletterVariant)} />
      <div className="inline-flex items-center gap-2.5 text-(length:--text-sm) text-text-secondary">
        <Switch id={switchId} checked={fail} onCheckedChange={setFail} />
        <label htmlFor={switchId} className="cursor-pointer">Fail the next send</label>
      </div>
    </div>
    <div className="w-full overflow-hidden rounded-[20px] border border-border bg-background">
      <NewsletterSignup key={variant} variant={variant} onSubscribe={simulate} />
    </div>
    <p className="m-0 text-center text-(length:--text-xs) leading-body text-text-muted">Subscribing is simulated in this preview. Nothing is sent.</p>
  </div>;
}

export default NewsletterSignupBlock;
