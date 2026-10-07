"use client";

import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useTransform } from "motion/react";
import type { AnimationPlaybackControls, Transition, Variants } from "motion/react";
import { ArrowRight, ChevronDown, ChevronUp, Pause, Play, X } from "lucide-react";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

export interface AnnouncementAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface Announcement {
  /** Stable id, reported to callbacks. */
  id: string;
  message: ReactNode;
  action?: AnnouncementAction;
  /** Counts down to a moment, for example the end of a sale. */
  countdown?: { to: Date | string | number; label?: string };
}

/**
 * A slim bar for the top of a page. It can rotate several messages, each rising in from below while the bar springs to
 * the new height; rotation pauses on hover, focus, or a hidden tab, and `controls` adds previous, next, and a pause ring. Messages can carry a
 * call to action and a live countdown. Dismissing collapses the height smoothly so the page below eases up, and with an
 * `id` the dismissal is remembered in `localStorage`.
 */
export interface AnnouncementBarProps {
  messages: Announcement[];
  /** Remembers dismissal under this id. Change the id to show a new campaign to everyone again. */
  id?: string;
  /** Whether the bar is shown. Leave it out to let the component manage it. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Index of the visible message. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Milliseconds each message stays before the next one. Defaults to 6000. */
  interval?: number;
  /** Rotate automatically. Pauses on hover, focus, or a hidden tab, and is turned off when the visitor prefers reduced motion. Defaults to true. */
  autoPlay?: boolean;
  /** Show previous, next, and pause controls when there are several messages. Defaults to false: only the close button shows. */
  controls?: boolean;
  dismissible?: boolean;
  tone?: "neutral" | "inverted";
  onAction?: (announcement: Announcement) => void;
  onCountdownEnd?: (announcement: Announcement) => void;
  /** Accessible name of the region. */
  label?: string;
  className?: string;
}

const storageKey = (id: string) => `tg-announcement:${id}`;
/** Forgets a remembered dismissal so the bar with this id shows again. */
export function clearAnnouncementDismissal(id: string) {
  try { window.localStorage.removeItem(storageKey(id)); } catch { /* Storage can be blocked. */ }
}

type Bezier = [number, number, number, number];
const enter = [...motionTokens.ease.enter] as Bezier;
const standard = [...motionTokens.ease.standard] as Bezier;
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = 2 * Math.PI / (visualDuration * 1.2);
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 };
};
const RISE = physical(.46, .1), HEIGHT = physical(.42, 0), COLLAPSE = physical(.44, 0);

/** Next rises from below and leaves upward; previous runs the other way. */
const faceVariants: Variants = {
  hidden: (direction: number) => ({ opacity: 0, y: `${direction * 70}%`, filter: `blur(${motionTokens.blur.soft}px)` }),
  shown: { opacity: 1, y: "0%", filter: "blur(0px)", transition: { y: RISE, opacity: { duration: motionTokens.duration.standard, ease: enter }, filter: { duration: motionTokens.duration.standard, ease: enter } } },
  gone: (direction: number) => ({ opacity: 0, y: `${direction * -60}%`, filter: `blur(${motionTokens.blur.soft}px)`, transition: { y: RISE, opacity: { duration: motionTokens.duration.fast, ease: standard }, filter: { duration: motionTokens.duration.fast, ease: standard } } }),
};
const fadeVariants: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: motionTokens.duration.standard, ease: standard } }, gone: { opacity: 0, transition: { duration: motionTokens.duration.instant, ease: standard } } };

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(total / 86400), h: Math.floor(total % 86400 / 3600), m: Math.floor(total % 3600 / 60), s: total % 60 };
}
const pad = (value: number) => String(value).padStart(2, "0");

/**
 * One character cell. A changed digit drops in from above while the old one falls away, like a counter winding down.
 * The invisible sizer keeps the cell in the text flow, so it shares the baseline of the words around it.
 */
function Digit({ char, reduced }: { char: string; reduced: boolean }) {
  return <span className="relative inline-block overflow-clip text-center">
    <span className="invisible" aria-hidden="true">0</span>
    <AnimatePresence initial={false}>
      <motion.span key={char} className="absolute inset-0 block"
        initial={reduced ? { opacity: 0 } : { y: "-70%", opacity: 0 }} animate={{ y: "0%", opacity: 1 }} exit={reduced ? { opacity: 0 } : { y: "70%", opacity: 0 }}
        transition={reduced ? { duration: motionTokens.duration.instant } : { y: physical(.32, .08), opacity: { duration: motionTokens.duration.fast, ease: standard } }}>{char}</motion.span>
    </AnimatePresence>
  </span>;
}

function Countdown({ to, label, reduced, onEnd }: { to: Date | string | number; label?: string; reduced: boolean; onEnd?: () => void }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  const ended = useRef(false);
  const endRef = useRef(onEnd);
  useEffect(() => { endRef.current = onEnd; }, [onEnd]);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= target) {
        if (!ended.current) { ended.current = true; endRef.current?.(); }
        return;
      }
      // Wake just after each whole second so digits change on the beat.
      timer = window.setTimeout(tick, 1000 - (current % 1000) + 8);
    };
    timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, [target]);
  const { d, h, m, s } = parts(now === null ? 0 : target - now);
  const pending = now === null;
  const spoken = pending ? "" : `${d ? `${d} days ` : ""}${h} hours ${m} minutes`;
  const digits = (value: string, key: string) => value.split("").map((char, index) => <Digit key={`${key}${value.length - index}`} char={pending ? "0" : char} reduced={reduced} />);
  return <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-(color:--muted)">
    {label ? <span className="text-inherit">{label}</span> : null}
    <span role="timer" aria-live="off" aria-label={spoken} className="inline-flex items-baseline leading-[inherit] font-medium text-foreground tabular-nums data-pending:opacity-0 group-data-[tone=inverted]/bar:text-background" data-pending={pending || undefined}>
      {d ? <><span className="inline-flex items-baseline">{digits(String(d), "d")}<span className="ml-px font-normal text-(color:--muted)" aria-hidden="true">d</span></span><span className="inline-block w-[.4em]" aria-hidden="true" /></> : null}
      {digits(pad(h), "h")}<span className={`inline-block px-px font-normal text-(color:--muted) [font-feature-settings:"case"]`} aria-hidden="true">:</span>{digits(pad(m), "m")}<span className={`inline-block px-px font-normal text-(color:--muted) [font-feature-settings:"case"]`} aria-hidden="true">:</span>{digits(pad(s), "s")}
    </span>
  </span>;
}

function Face({ announcement, direction, reduced, position, total, onSize, onAction, onCountdownEnd }: { announcement: Announcement; direction: number; reduced: boolean; position: number; total: number; onSize: (height: number) => void; onAction?: (announcement: Announcement) => void; onCountdownEnd?: (announcement: Announcement) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !present) return;
    const report = () => onSize(node.offsetHeight);
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onSize, present]);
  const { action, countdown } = announcement;
  const cta = action ? action.href
    ? <a className={ctaClass} href={action.href} onClick={() => { action.onClick?.(); onAction?.(announcement); }}>{action.label}<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" /></a>
    : <button type="button" className={ctaClass} onClick={() => { action.onClick?.(); onAction?.(announcement); }}>{action.label}<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" /></button> : null;
  return <motion.div ref={ref} className="absolute inset-x-0 top-0 flex min-h-8 items-center justify-center @max-[560px]:justify-start" custom={direction} variants={reduced ? fadeVariants : faceVariants} initial="hidden" animate="shown" exit="gone"
    role={total > 1 ? "group" : undefined} aria-roledescription={total > 1 ? "slide" : undefined} aria-label={total > 1 ? `${position} of ${total}` : undefined} inert={!present || undefined}>
    <p className="m-0 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-0.5 py-1.5 text-center text-(length:--text-sm) leading-body text-balance @max-[560px]:justify-start @max-[560px]:gap-x-2.5 @max-[560px]:text-left">
      <span className="min-w-0">{announcement.message}</span>
      {countdown ? <Countdown to={countdown.to} label={countdown.label} reduced={reduced} onEnd={() => onCountdownEnd?.(announcement)} /> : null}
      {cta}
    </p>
  </motion.div>;
}

const RING = 2 * Math.PI * 8;

const ctaClass = "inline-flex cursor-pointer items-center gap-1 border-0 bg-none p-0 font-[family-name:inherit] text-[length:inherit] leading-[inherit] font-medium whitespace-nowrap text-inherit no-underline [-webkit-tap-highlight-color:transparent] [&_svg]:transition-[translate] [&_svg]:duration-160 [&_svg]:ease-standard motion-reduce:[&_svg]:transition-none pointer-fine:hover:[&_svg]:translate-x-0.5";
const iconButton = "relative grid size-(--icon) flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-(color:--muted) transition-[color,background-color] duration-160 ease-standard [-webkit-tap-highlight-color:transparent] active:bg-[color-mix(in_oklab,currentColor_12%,transparent)] active:text-inherit motion-reduce:transition-none pointer-fine:hover:bg-[color-mix(in_oklab,currentColor_10%,transparent)] pointer-fine:hover:text-foreground group-data-[tone=inverted]/bar:pointer-fine:hover:text-background";

export const AnnouncementBar = forwardRef<HTMLElement, AnnouncementBarProps>(function AnnouncementBar({
  messages, id, open: openProp, defaultOpen = true, onOpenChange, index: indexProp, defaultIndex = 0, onIndexChange,
  interval = 6000, autoPlay = true, controls = false, dismissible = true, tone = "neutral", onAction, onCountdownEnd, label = "Announcements", className,
}, ref) {
  const reduced = !!useReducedMotion();
  const uid = useId();
  const total = messages.length;

  /* Open state: controlled, or internal and hidden at once when this id was dismissed before. */
  const [openInternal, setOpenInternal] = useState(defaultOpen);
  const [remembered, setRemembered] = useState(false);
  useLayoutEffect(() => {
    if (!id || openProp !== undefined) return;
    let stored = false;
    try { stored = window.localStorage.getItem(storageKey(id)) === "dismissed"; } catch { /* Storage can be blocked. */ }
    // Storage is only readable on the client; hide before paint so a dismissed bar never flashes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setRemembered(true);
  }, [id, openProp]);
  const open = openProp ?? (openInternal && !remembered);

  const dismiss = () => {
    if (id) { try { window.localStorage.setItem(storageKey(id), "dismissed"); } catch { /* Storage can be blocked. */ } }
    if (openProp === undefined) setOpenInternal(false);
    onOpenChange?.(false);
  };

  /* Rotation. */
  const [indexInternal, setIndexInternal] = useState(defaultIndex);
  const current = total ? ((indexProp ?? indexInternal) % total + total) % total : 0;
  const [direction, setDirection] = useState(1);
  const go = useCallback((step: number) => {
    if (total < 2) return;
    const next = ((current + step) % total + total) % total;
    setDirection(step > 0 ? 1 : -1);
    if (indexProp === undefined) setIndexInternal(next);
    onIndexChange?.(next);
  }, [current, indexProp, onIndexChange, total]);

  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const read = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);
  const rotating = autoPlay && !reduced && total > 1;
  const running = rotating && open && !userPaused && !hovered && !focused && !hidden;

  /* The ring is the clock: its progress runs to one, then advances. Pausing stops it where it is; resuming finishes the rest. */
  const progress = useMotionValue(0);
  const dash = useTransform(progress, value => RING * (1 - value));
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; }, [go]);
  useEffect(() => { progress.jump(0); }, [current, progress]);
  useEffect(() => {
    if (!running) return;
    let controls: AnimationPlaybackControls | null = animate(progress, 1, {
      duration: interval / 1000 * (1 - progress.get()), ease: "linear",
      onComplete: () => { controls = null; goRef.current(1); },
    });
    return () => controls?.stop();
  }, [running, current, interval, progress]);

  /* The viewport springs to the height of the current message, which can wrap on narrow screens. */
  const height = useMotionValue<number | "auto">("auto");
  const measured = useRef(0);
  const onSize = useCallback((next: number) => {
    if (Math.abs(next - measured.current) < .5) return;
    const first = measured.current === 0;
    measured.current = next;
    if (first || reduced) height.jump(next);
    else animate(height, next, HEIGHT);
  }, [height, reduced]);

  const announcement = messages[current];
  if (!announcement) return null;
  const navigable = controls && total > 1;
  const controlCount = (navigable ? 2 + (rotating ? 1 : 0) : 0) + (dismissible ? 1 : 0);

  return <AnimatePresence initial={false}>
    {open ? <motion.section key="bar" ref={ref} className={cn("@container overflow-hidden font-body tracking-body", className)} aria-label={label}
      aria-roledescription={total > 1 ? "carousel" : undefined}
      initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
      exit={reduced ? { opacity: 0, transition: { duration: motionTokens.duration.fast } } : { height: 0, opacity: 0, transition: { height: COLLAPSE, opacity: { duration: motionTokens.duration.exit, ease: standard } } }}
      transition={reduced ? { duration: motionTokens.duration.fast } : { height: COLLAPSE, opacity: { duration: motionTokens.duration.standard, ease: enter } }}
      onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
      <div className={cn("group/bar grid items-center gap-3 border-b border-border bg-surface-muted py-1.5 pr-2 pl-4 text-foreground [--control-gap:2px] [--icon:32px] [--muted:var(--text-secondary)]","grid-cols-[calc(var(--controls,0)*var(--icon)_+_max(var(--controls,0)_-_1,0)*var(--control-gap))_minmax(0,1fr)_auto]","data-[tone=inverted]:border-b-transparent data-[tone=inverted]:bg-foreground data-[tone=inverted]:text-background data-[tone=inverted]:[--muted:color-mix(in_oklab,var(--background)_66%,transparent)]",
        // Narrow bars drop the mirror column and read from the start edge.
        "@max-[560px]:grid-cols-[0_minmax(0,1fr)_auto] @max-[560px]:gap-x-2 @max-[560px]:gap-y-0 @max-[560px]:pl-3.5")} data-tone={tone} style={{ "--controls": controlCount } as CSSProperties}>
        {/* The side column mirrors the controls, so the message stays centered on the page rather than in the leftover space. */}
        <div className="min-w-0" aria-hidden="true" />
        <motion.div className="relative min-h-8 overflow-hidden" style={{ height }} id={`${uid}-slides`} aria-live={running ? "off" : "polite"} aria-atomic="false">
          <AnimatePresence initial={false} custom={direction}>
            <Face key={announcement.id} announcement={announcement} direction={direction} reduced={reduced} position={current + 1} total={total}
              onSize={onSize} onAction={onAction} onCountdownEnd={onCountdownEnd} />
          </AnimatePresence>
        </motion.div>
        <div className="flex items-center gap-(--control-gap)">
          {navigable ? <>
            <button type="button" className={iconButton} aria-label="Previous announcement" aria-controls={`${uid}-slides`} onClick={() => go(-1)}><ChevronUp size={16} strokeWidth={1.75} aria-hidden="true" /></button>
            {rotating ? <button type="button" className={iconButton} aria-label={userPaused ? "Resume announcements" : "Pause announcements"} aria-pressed={userPaused} onClick={() => setUserPaused(paused => !paused)}>
              <svg className="size-5 -rotate-90 overflow-visible" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="8" className="fill-none stroke-current stroke-[1.75] [stroke-opacity:.22]" />
                <motion.circle cx="10" cy="10" r="8" className="fill-none stroke-current stroke-[1.75] [stroke-linecap:round]" strokeDasharray={RING} style={{ strokeDashoffset: dash }} />
              </svg>
              <span className="absolute inset-0 grid place-items-center">{userPaused ? <Play size={9} strokeWidth={2.4} className="fill-current" aria-hidden="true" /> : <Pause size={9} strokeWidth={2.4} className="fill-current" aria-hidden="true" />}</span>
            </button> : null}
            <button type="button" className={iconButton} aria-label="Next announcement" aria-controls={`${uid}-slides`} onClick={() => go(1)}><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></button>
          </> : null}
          {dismissible ? <button type="button" className={iconButton} aria-label="Dismiss" onClick={dismiss}><X size={16} strokeWidth={1.75} aria-hidden="true" /></button> : null}
        </div>
      </div>
    </motion.section> : null}
  </AnimatePresence>;
});

export default AnnouncementBar;
