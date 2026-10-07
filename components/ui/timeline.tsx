"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Transition } from "motion/react";
import { ChevronDown } from "@mynaui/icons-react";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

export interface TimelineEvent {
  id: string;
  /** When it happened, as an ISO string or epoch milliseconds. */
  at: string | number;
  /** Who did it, shown first in the foreground color. */
  actor?: string;
  /** What happened, completing the actor: "merged Checkout redesign into main". */
  title: string;
  /** Short context under the title, such as a pull request or a build. */
  meta?: string;
  /** Revealed in place when the row is expanded. Rows without detail are not interactive. */
  detail?: ReactNode;
  /** Portrait for an event by a person. */
  avatar?: string;
  /** Icon for a system event, used when there is no avatar. */
  icon?: ReactNode;
  /** Status of a system event. Always say the outcome in the title too, so it never rests on color. */
  tone?: "neutral" | "success" | "danger";
}

/**
 * A vertical activity feed grouped by day, for project history, audit logs, and deploy streams. Use it when order and
 * recency matter; use a table when people need to sort or compare. Day labels stay pinned while their updates scroll,
 * the connecting line draws itself as rows come into view, rows expand in place, and new updates slide in at the top
 * while the rest glide down. Arrow keys move between rows, Enter or Space expands one.
 */
export interface TimelineProps {
  /** Updates in any order; the newest shows first. */
  events: TimelineEvent[];
  /** Reference time for relative labels and day groups, in epoch milliseconds. Pass a ticking clock to keep labels fresh. */
  now: number;
  /** Accessible name for the feed. */
  label: string;
  /** Time zone for day groups and clock times. Fixed by default so server and client agree. */
  timeZone?: string;
  locale?: string;
  /** Height of the scrolling area. Without it the feed grows with the page and reveals on page scroll. */
  maxHeight?: number | string;
  /** Scroll back to the top when a new update arrives while the feed is scrolled down. */
  scrollToNew?: boolean;
  defaultExpanded?: string[];
  /** Heading level for the day labels. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

type Row = TimelineEvent & { time: number; day: string };
type Group = { day: string; label: string; rows: Row[] };

const HOUR = 3_600_000;

/* The bottom feather animates a custom length, which has to be registered to interpolate. There is no stylesheet to hold an @property rule, so it registers once in the browser. */
if (typeof CSS !== "undefined" && "registerProperty" in CSS) {
  try {
    CSS.registerProperty({ name: "--timeline-feather", syntax: "<length>", inherits: false, initialValue: "0px" });
  } catch {
    /* Already registered, for example after a hot reload. */
  }
}

/* Geometry: a 28px marker column, the line centred under it, and rows whose first text line centres on the marker. */
const rootClass = "relative grid min-w-0 text-foreground [--line-gap:4px] [--marker-top:8px] [--marker:28px]";
/* Inserting at the top pushes the rows down instead of the browser holding the scroll position still. While more updates wait below, the last visible row fades into the edge instead of being cut. */
const scrollerClass =
  "min-w-0 [overflow-anchor:none] data-[scrolls]:max-h-(--timeline-height) data-[scrolls]:overflow-y-auto data-[scrolls]:overscroll-contain data-[scrolls]:[scrollbar-color:var(--border-strong)_transparent] data-[scrolls]:[scrollbar-width:thin] data-[scrolls]:[mask-image:linear-gradient(to_bottom,#000_calc(100%_-_var(--timeline-feather)),transparent)] data-[scrolls]:[transition:--timeline-feather_var(--duration-standard)_var(--ease-standard)] data-[scrolls]:not-data-[more]:[--timeline-feather:0px] data-[more]:[--timeline-feather:36px] motion-reduce:data-[scrolls]:[transition:--timeline-feather_var(--duration-instant)_var(--ease-standard)]";
/* Day labels stay pinned while their updates scroll under them. Set --timeline-surface when the feed sits on another surface. */
const dayClass =
  "sticky top-0 z-2 flex items-baseline justify-between gap-3 bg-[var(--timeline-surface,var(--surface))] py-2 pr-3 pl-0 text-sm leading-body font-medium text-foreground";
/* A person's portrait sits on a hairline ring; a system event is a quiet node with its icon. */
const markerClass =
  "absolute top-(--marker-top) left-0 z-1 grid size-(--marker) place-items-center rounded-pill text-text-secondary after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-[color-mix(in_oklab,var(--foreground)_10%,transparent)] after:content-[''] data-[tone]:bg-surface data-[tone=danger]:bg-[color-mix(in_oklab,var(--danger)_12%,var(--surface))] data-[tone=danger]:text-danger data-[tone=success]:bg-[color-mix(in_oklab,var(--success)_12%,var(--surface))] data-[tone=success]:text-success [&_img]:block [&_img]:size-full [&_img]:rounded-[inherit] [&_img]:object-cover [&_svg]:size-3.5 [&_svg]:stroke-2";
/* The line runs from just under this marker to just above the next one and draws downward from its top. */
const segmentClass =
  "absolute top-[calc(var(--marker-top)_+_var(--marker)_+_var(--line-gap))] bottom-[calc(var(--line-gap)_-_var(--marker-top))] left-[calc(var(--marker)_/_2_-_.5px)] w-px origin-[50%_0] bg-border-strong";
const triggerClass =
  "m-0 grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 rounded-control border-0 bg-transparent px-3 py-3 text-left text-inherit [-webkit-tap-highlight-color:transparent] transition-[background-color] duration-160 ease-standard data-[timeline-trigger]:cursor-pointer data-[timeline-trigger]:grid-cols-[minmax(0,1fr)_auto_16px] data-[timeline-trigger]:active:bg-surface-muted pointer-fine:data-[timeline-trigger]:hover:bg-surface-muted max-[420px]:gap-x-2 max-[420px]:px-2 motion-reduce:transition-none";
const enter = [...motionTokens.ease.enter] as [number, number, number, number];
const standard = [...motionTokens.ease.standard] as [number, number, number, number];
/** Seconds between rows revealed together, so the line reads as drawing downward. */
const STEP = .09;
const noopSubscribe = () => () => {};

/** Reduced motion only after hydration, so the server and the first client render agree. */
function useReducedMotionSafe() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const reduced = useReducedMotion();
  return hydrated && !!reduced;
}

/** Rows reveal against the viewport, which already clips by the scroll area, so they wait until they are visible in both. */
type Clock = { schedule: () => number; reduced: boolean; fresh: Set<string> };
const RevealClock = createContext<Clock | null>(null);

/** Text that changes in place: the new value rises in from a soft blur while the old one lifts away a little faster. */
function RiseText({ text, reduced, direction = 1 }: { text: string; reduced: boolean; direction?: number }) {
  return <span className="relative inline-flex" aria-hidden="true">
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.span key={text} className="inline-block whitespace-nowrap" custom={direction}
        variants={{
          from: (dir: number) => reduced ? { opacity: 0 } : { opacity: 0, y: `${.3 * dir}em`, filter: `blur(${motionTokens.blur.soft}px)` },
          to: { opacity: 1, y: "0em", filter: "blur(0px)" },
          gone: (dir: number) => reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: `${-.3 * dir}em`, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: standard } },
        }}
        initial="from" animate="to" exit="gone" transition={{ duration: reduced ? motionTokens.duration.instant : motionTokens.duration.standard, ease: enter }}>{text}</motion.span>
    </AnimatePresence>
  </span>;
}

/** The day's update count rolls digit by digit in the direction it moved. */
function RollingCount({ value, reduced }: { value: number; reduced: boolean }) {
  const [state, setState] = useState({ value, direction: 1 });
  if (state.value !== value) setState({ value, direction: value > state.value ? 1 : -1 });
  const chars = [...String(value)];
  return <span className="inline-flex" aria-hidden="true">
    {chars.map((char, index) => <span key={chars.length - index} className="relative inline-flex overflow-clip [overflow-clip-margin:.15em]"><RiseText text={char} reduced={reduced} direction={state.direction} /></span>)}
  </span>;
}

function dayKey(time: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(time));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function relative(time: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - time) / 60_000));
  if (minutes < 1) return { short: "Now", long: "just now" };
  if (minutes < 60) return { short: `${minutes}m`, long: `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago` };
  const hours = Math.floor(minutes / 60);
  return { short: `${hours}h`, long: `${hours} ${hours === 1 ? "hour" : "hours"} ago` };
}

/** A day's section. A new day opens from nothing and pushes the older days down; it clips only while it grows. */
function DaySection({ id, fresh, reduced, children }: { id: string; fresh: boolean; reduced: boolean; children: ReactNode }) {
  const [entering, setEntering] = useState(fresh);
  return <motion.section className="relative data-[entering]:overflow-clip" aria-labelledby={id} data-entering={entering || undefined}
    initial={fresh ? { height: 0, opacity: 0 } : false} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0, transition: { duration: reduced ? motionTokens.duration.instant : motionTokens.duration.exit, ease: standard } }}
    transition={reduced ? { duration: .15 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: enter } }}
    onAnimationComplete={() => setEntering(false)}>
    {children}
  </motion.section>;
}

function TimelineRow({ row, last, expanded, onToggle, timeLabel, timeFull }: { row: Row; last: boolean; expanded: boolean; onToggle: () => void; timeLabel: string; timeFull: string }) {
  const clock = useContext(RevealClock)!;
  const { reduced } = clock;
  const detailId = useId();
  // The row reveals once, the first time it scrolls into view: its marker pops, then its line draws toward the next row.
  const [revealDelay, setRevealDelay] = useState<number | null>(null);
  const fresh = clock.fresh.has(row.id);
  const [entering, setEntering] = useState(fresh);
  const shown = revealDelay !== null;
  const delay = (revealDelay ?? 0) + (fresh ? .12 : 0);
  const pop: Transition = reduced ? { duration: 0, opacity: { duration: .15 } } : { ...motionTokens.spring.morph, visualDuration: .36, bounce: .32, delay, opacity: { duration: motionTokens.duration.fast, ease: enter, delay } };
  const draw: Transition = reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, visualDuration: .34, delay: delay + .1 };
  const tone = row.avatar ? undefined : row.tone ?? "neutral";
  const Trigger = row.detail ? "button" : "div";

  return <motion.li className="relative pl-[calc(var(--marker)_+_var(--space-2))] data-[entering]:overflow-clip" data-entering={entering || undefined}
    initial={fresh ? { height: 0 } : false} animate={{ height: "auto" }} exit={{ height: 0, opacity: 0, transition: reduced ? { duration: .1 } : { height: { ...motionTokens.spring.smooth, visualDuration: .3 }, opacity: { duration: .12 } } }}
    transition={reduced ? { duration: 0 } : motionTokens.spring.smooth} onAnimationComplete={() => setEntering(false)}
    onViewportEnter={() => setRevealDelay(current => current ?? clock.schedule())} viewport={{ once: true, amount: .2 }}>
    <motion.span className={markerClass} data-tone={tone} aria-hidden="true" initial={{ scale: .4, opacity: 0 }} animate={shown ? { scale: 1, opacity: 1 } : undefined} transition={pop}>
      {/* eslint-disable-next-line @next/next/no-img-element -- registry components stay framework agnostic */}
      {row.avatar ? <img src={row.avatar} alt="" width={28} height={28} decoding="async" /> : row.icon}
    </motion.span>
    {!last && <motion.span className={segmentClass} aria-hidden="true" initial={{ scaleY: 0 }} animate={shown ? { scaleY: 1 } : undefined} transition={draw} />}
    <motion.div className="min-w-0" initial={fresh ? (reduced ? { opacity: 0 } : { opacity: 0, y: -10, filter: `blur(${motionTokens.blur.soft}px)` }) : false} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={reduced ? { duration: .15 } : { y: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: enter, delay: .05 }, filter: { duration: motionTokens.duration.standard, ease: enter, delay: .05 } }}>
      <Trigger className={triggerClass} {...(row.detail ? { type: "button" as const, "data-timeline-trigger": "", "aria-expanded": expanded, "aria-controls": expanded ? detailId : undefined, onClick: onToggle } : {})}>
        <span className="grid min-w-0 gap-0.5">
          <span className="text-sm leading-5 text-text-secondary">{row.actor && <span className="font-medium text-foreground">{row.actor}</span>}{row.actor ? " " : ""}{row.title}</span>
          {row.meta && <span className="text-xs leading-body text-text-muted">{row.meta}</span>}
        </span>
        <time className="flex min-w-11 justify-end text-xs leading-5 whitespace-nowrap text-text-muted tabular-nums" dateTime={new Date(row.time).toISOString()} title={timeFull}><RiseText text={timeLabel} reduced={reduced} /><span className="absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]">{timeFull}</span></time>
        {row.detail && <motion.span className="grid h-5 place-items-center text-text-muted" aria-hidden="true" initial={false} animate={{ rotate: expanded ? 180 : 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}><ChevronDown size={16} strokeWidth={1.75} /></motion.span>}
      </Trigger>
      <AnimatePresence initial={false}>
        {expanded && row.detail && <motion.div key="detail" id={detailId} className="overflow-clip [overflow-clip-margin:4px]"
          initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0, transition: reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, visualDuration: .28 } }}
          transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
          <motion.div className="px-3 pt-0 pb-4 text-sm leading-body text-text-secondary max-[420px]:px-2" initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant, ease: standard } }} transition={reduced ? { duration: .15 } : { duration: motionTokens.duration.standard, ease: enter, delay: .06 }}>{row.detail}</motion.div>
        </motion.div>}
      </AnimatePresence>
    </motion.div>
  </motion.li>;
}

export function Timeline({ events, now, label, timeZone = "UTC", locale = "en-US", maxHeight, scrollToNew = true, defaultExpanded = [], headingLevel = 3, className }: TimelineProps) {
  const reduced = useReducedMotionSafe();
  const id = useId();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded));

  // Rows added after the first render are fresh: they slide in and the rest glide down. Their titles are announced.
  const ids = events.map(event => event.id).join("|");
  const [known, setKnown] = useState(() => ({ ids, set: new Set(events.map(event => event.id)), fresh: new Set<string>(), announcement: "" }));
  if (known.ids !== ids) {
    const added = events.filter(event => !known.set.has(event.id));
    setKnown({ ids, set: new Set(events.map(event => event.id)), fresh: new Set([...known.fresh, ...added.map(event => event.id)]), announcement: added.length ? `New update: ${added.map(event => [event.actor, event.title].filter(Boolean).join(" ")).join(". ")}` : known.announcement });
  }
  // The bottom edge feathers while more updates wait below, and clears once the end is in view.
  const trackRef = useRef<HTMLDivElement>(null);
  const scrolls = maxHeight !== undefined;
  useEffect(() => {
    const scroller = scrollerRef.current, track = trackRef.current;
    if (!scrolls || !scroller || !track || typeof ResizeObserver === "undefined") return;
    const update = () => { if (scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > 2) scroller.dataset.more = ""; else delete scroller.dataset.more; };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    observer.observe(track);
    return () => { scroller.removeEventListener("scroll", update); observer.disconnect(); };
  }, [scrolls]);

  const newestId = events.reduce<TimelineEvent | null>((latest, event) => !latest || new Date(event.at).getTime() > new Date(latest.at).getTime() ? event : latest, null)?.id;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scrollToNew || !scroller || scroller.scrollTop < 1) return;
    scroller.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [newestId, scrollToNew, reduced]);

  const [initialDays] = useState(() => new Set(events.map(event => dayKey(new Date(event.at).getTime(), timeZone))));
  const groups = useMemo<Group[]>(() => {
    const today = dayKey(now, timeZone), yesterday = dayKey(now - 24 * HOUR, timeZone);
    const heading = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", timeZone });
    const byDay = new Map<string, Row[]>();
    [...events].map(event => ({ ...event, time: new Date(event.at).getTime() })).sort((a, b) => b.time - a.time).forEach(event => {
      const day = dayKey(event.time, timeZone);
      byDay.set(day, [...(byDay.get(day) ?? []), { ...event, day }]);
    });
    return [...byDay].map(([day, rows]) => ({ day, rows, label: day === today ? "Today" : day === yesterday ? "Yesterday" : heading.format(new Date(rows[0].time)) }));
  }, [events, now, timeZone, locale]);
  const formats = useMemo(() => ({
    clock: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }),
    full: new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }),
  }), [locale, timeZone]);

  // Rows that come into view together are spaced a beat apart, so the line reads as drawing down the feed.
  const nextReveal = useRef(0);
  const schedule = useCallback(() => {
    if (reduced) return 0;
    const current = performance.now() / 1000;
    const start = Math.min(Math.max(current, nextReveal.current), current + .45);
    nextReveal.current = start + STEP;
    return start - current;
  }, [reduced]);
  const clock = useMemo<Clock>(() => ({ schedule, reduced, fresh: known.fresh }), [schedule, reduced, known.fresh]);

  function toggle(id: string) {
    setExpanded(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const triggers = [...(scrollerRef.current?.querySelectorAll<HTMLElement>("[data-timeline-trigger]") ?? [])];
    const index = triggers.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? triggers.length - 1 : Math.min(Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0), triggers.length - 1);
    triggers[next]?.focus();
  }

  return <RevealClock.Provider value={clock}>
    <div className={cn(rootClass, className)} role="region" aria-label={label}>
      <div ref={scrollerRef} className={scrollerClass} data-scrolls={scrolls || undefined} style={scrolls ? { "--timeline-height": typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight } as CSSProperties : undefined} onKeyDown={onKeyDown}>
        {/* Presence starts enabled so markers keep their hidden first frame; rows and days present at mount opt out of entering themselves. */}
        <div ref={trackRef}><AnimatePresence>
          {groups.map(group => <DaySection key={group.day} id={`${id}-${group.day}`} fresh={!initialDays.has(group.day)} reduced={reduced}>
            <div className={dayClass} role="heading" aria-level={headingLevel} id={`${id}-${group.day}`}>
              <span>{group.label}</span>
              <span className="text-xs font-normal text-text-muted tabular-nums" aria-hidden="true"><RollingCount value={group.rows.length} reduced={reduced} /> {group.rows.length === 1 ? "update" : "updates"}</span>
              <span className="absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]">{`, ${group.rows.length} ${group.rows.length === 1 ? "update" : "updates"}`}</span>
            </div>
            <ol className="m-0 mb-3 list-none p-0">
              <AnimatePresence>
                {group.rows.map((row, index) => {
                  const today = group.label === "Today" && now - row.time < 12 * HOUR;
                  const time = today ? relative(row.time, now) : { short: formats.clock.format(new Date(row.time)), long: "" };
                  return <TimelineRow key={row.id} row={row} last={index === group.rows.length - 1} expanded={expanded.has(row.id)} onToggle={() => toggle(row.id)}
                    timeLabel={time.short} timeFull={today ? `${time.long}, ${formats.full.format(new Date(row.time))}` : formats.full.format(new Date(row.time))} />;
                })}
              </AnimatePresence>
            </ol>
          </DaySection>)}
        </AnimatePresence></div>
      </div>
      <span className="absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" role="status">{known.announcement}</span>
    </div>
  </RevealClock.Provider>;
}

export default Timeline;
