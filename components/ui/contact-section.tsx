"use client";

import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useAnimate, useIsPresent } from "motion/react";
import type { Variants } from "motion/react";
import { Check, Clock, Mail, MessageCircle, Phone, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import SegmentedControl from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { motionTokens } from "@/lib/motion-tokens";
import { person } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

export type ContactSectionVariant = "form" | "channels" | "offices";

export interface ContactMessage {
  name: string;
  email: string;
  topic: string;
  message: string;
}

export interface ContactChannel {
  value: string;
  label: string;
  /** One line under the label in the list, such as a response time. */
  meta: string;
  icon?: ReactNode;
  /** The detail shown when the channel is selected. */
  detail: ReactNode;
}

export interface ContactOffice {
  city: string;
  /** IANA time zone, used for the live local time and open status. */
  timeZone: string;
  address: string[];
  email?: string;
  /** Opening hours in local 24 hour time. Defaults to 9 to 18. */
  hours?: [number, number];
}

export interface ContactSectionProps {
  /** `form` validates and morphs into a confirmation, `channels` lists ways to reach you, `offices` shows live local times. */
  variant?: ContactSectionVariant;
  title?: string;
  description?: string;
  /** Topics offered in the form. */
  topics?: string[];
  /** Called with a valid message. Reject to keep the form and show an error; resolve to show the confirmation. */
  onSubmit?: (message: ContactMessage) => void | Promise<void>;
  channels?: ContactChannel[];
  /** Selected channel (controlled). */
  channel?: string;
  defaultChannel?: string;
  onChannelChange?: (value: string) => void;
  offices?: ContactOffice[];
  className?: string;
}

type Bezier = [number, number, number, number];
const enter = [...motionTokens.ease.enter] as Bezier;
const standard = [...motionTokens.ease.standard] as Bezier;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_MESSAGE = 500;

/** Faces slide along one axis in the direction of travel and settle out of a soft blur. */
const faceVariants: Variants = {
  hidden: ({ direction, axis }: { direction: number; axis: "x" | "y" }) => ({ opacity: 0, x: axis === "x" ? direction * 18 : 0, y: axis === "y" ? direction * 18 : 0, filter: `blur(${motionTokens.blur.soft}px)` }),
  shown: { opacity: 1, x: 0, y: 0, filter: "blur(0px)", transition: { x: motionTokens.spring.smooth, y: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: enter, delay: .04 }, filter: { duration: motionTokens.duration.standard, ease: enter, delay: .04 } } },
  gone: ({ direction, axis }: { direction: number; axis: "x" | "y" }) => ({ opacity: 0, x: axis === "x" ? direction * -12 : 0, y: axis === "y" ? direction * -12 : 0, filter: `blur(${motionTokens.blur.soft}px)`, transition: { duration: motionTokens.duration.fast, ease: standard } }),
};
const fadeVariants: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: motionTokens.duration.fast } }, gone: { opacity: 0, transition: { duration: motionTokens.duration.instant } } };

function Face({ children, custom, reduced, className }: { children: ReactNode; custom: { direction: number; axis: "x" | "y" }; reduced: boolean; className?: string }) {
  const present = useIsPresent();
  return <motion.div className={className} data-face="" data-leaving={present ? undefined : ""} inert={!present} custom={custom} variants={reduced ? fadeVariants : faceVariants} initial="hidden" animate="shown" exit="gone">{children}</motion.div>;
}

/**
 * One surface that springs from the height of its old content to the new one when `faceKey` changes, while the faces
 * crossfade along an axis. Between switches the height is automatic, so fields that grow inside it never get clipped.
 */
function MorphPanel({ faceKey, direction = 1, axis = "y", reduced, className, children, ...rest }: { faceKey: string; direction?: number; axis?: "x" | "y"; reduced: boolean; className?: string; children: ReactNode; id?: string; role?: string; "aria-labelledby"?: string }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const lastKey = useRef(faceKey);
  const lastHeight = useRef(0);
  useEffect(() => {
    const node = scope.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    lastHeight.current = node.offsetHeight;
    const observer = new ResizeObserver(() => { lastHeight.current = node.offsetHeight; });
    observer.observe(node);
    return () => observer.disconnect();
  }, [scope]);
  useLayoutEffect(() => {
    if (lastKey.current === faceKey) return;
    lastKey.current = faceKey;
    const node = scope.current;
    const face = node?.querySelector<HTMLElement>(":scope > [data-face]:not([data-leaving])");
    if (!node || !face || reduced) return;
    const from = lastHeight.current || node.offsetHeight;
    const to = face.offsetHeight;
    if (Math.abs(from - to) < 1) return;
    node.style.setProperty("height", `${from}px`);
    const controls = animate(node, { height: [from, to] }, motionTokens.spring.smooth);
    controls.then(() => node.style.removeProperty("height"));
    return () => { controls.stop(); node.style.removeProperty("height"); };
  }, [faceKey, animate, scope, reduced]);
  return <div ref={scope} className={cn("relative overflow-hidden", className)} {...rest}>
    <AnimatePresence initial={false} mode="popLayout" custom={{ direction, axis }}>
      <Face key={faceKey} custom={{ direction, axis }} reduced={reduced} className="w-full">{children}</Face>
    </AnimatePresence>
  </div>;
}

/** Topic chips as a radio group: a highlight glides to the choice and arrow keys move it. */
function TopicPicker({ topics, value, onChange, reduced }: { topics: string[]; value: string; onChange: (topic: string) => void; reduced: boolean }) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(event: KeyboardEvent) {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (topics.indexOf(value) + delta + topics.length) % topics.length;
    onChange(topics[next]);
    refs.current[next]?.focus();
  }
  return <div className="grid">
    <span id={`${id}-label`} className="mb-2 text-(length:--text-sm) font-medium leading-body text-foreground">Topic</span>
    <LayoutGroup id={id}>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-labelledby={`${id}-label`} onKeyDown={onKeyDown}>
        {topics.map((topic, index) => <button key={topic} ref={node => { refs.current[index] = node; }} type="button" role="radio" aria-checked={topic === value} tabIndex={topic === value ? 0 : -1} className="relative isolate h-control-sm cursor-pointer rounded-pill border border-border bg-transparent px-4 font-[inherit] text-(length:--text-sm) font-medium text-text-secondary [-webkit-tap-highlight-color:transparent] transition-[color,border-color] duration-160 ease-standard motion-reduce:transition-none aria-checked:border-transparent aria-checked:text-control-glyph pointer-fine:not-aria-checked:hover:border-border-strong pointer-fine:not-aria-checked:hover:text-foreground" onClick={() => onChange(topic)}>
          {topic === value && <motion.span layoutId="topic" className="absolute -inset-px -z-10 rounded-[inherit] bg-control-on" transition={reduced ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
          <span>{topic}</span>
        </button>)}
      </div>
    </LayoutGroup>
  </div>;
}

type Errors = Partial<Record<"name" | "email" | "message", string>>;
function validate(values: { name: string; email: string; message: string }): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Enter your name";
  if (!values.email.trim()) errors.email = "Enter your email address";
  else if (!EMAIL.test(values.email.trim())) errors.email = "Enter an email like name@example.com";
  if (values.message.trim().length < 20) errors.message = values.message.trim() ? "Add a little more detail, at least 20 characters" : "Tell us how we can help";
  return errors;
}

function ContactForm({ topics, onSubmit, reduced }: { topics: string[]; onSubmit?: ContactSectionProps["onSubmit"]; reduced: boolean }) {
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const [topic, setTopic] = useState(topics[0] ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState<"editing" | "sending" | "sent">("editing");
  const [failure, setFailure] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState({ name: "", email: "" });
  const nameRef = useRef<HTMLInputElement>(null), emailRef = useRef<HTMLInputElement>(null), messageRef = useRef<HTMLTextAreaElement>(null);
  const restoreFocus = useRef(false);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (phase === "sent") successRef.current?.focus();
    if (phase === "editing" && restoreFocus.current) { restoreFocus.current = false; nameRef.current?.focus(); }
  }, [phase]);

  const update = (field: keyof typeof values) => (event: { target: { value: string } }) => {
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    if (submitted) setErrors(validate(next));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (phase !== "editing") return;
    setSubmitted(true);
    setFailure(null);
    const found = validate(values);
    setErrors(found);
    if (found.name) { nameRef.current?.focus(); return; }
    if (found.email) { emailRef.current?.focus(); return; }
    if (found.message) { messageRef.current?.focus(); return; }
    setPhase("sending");
    const payload = { name: values.name.trim(), email: values.email.trim(), topic, message: values.message.trim() };
    try {
      await (onSubmit ? onSubmit(payload) : new Promise(resolve => setTimeout(resolve, 1100)));
      setSentTo({ name: payload.name.split(/\s+/)[0], email: payload.email });
      setPhase("sent");
    } catch {
      setPhase("editing");
      setFailure("We couldn't send your message. Check your connection and try again.");
    }
  }

  function reset() {
    setValues({ name: "", email: "", message: "" });
    setErrors({});
    setSubmitted(false);
    setFailure(null);
    restoreFocus.current = true;
    setPhase("editing");
  }

  const left = MAX_MESSAGE - values.message.length;
  return <MorphPanel faceKey={phase === "sent" ? "sent" : "form"} direction={phase === "sent" ? 1 : -1} reduced={reduced} className="rounded-panel border border-border bg-surface [&>[data-face]]:p-6 @max-[520px]/contact:[&>[data-face]]:p-5">
    {phase === "sent"
      ? <div className="grid justify-items-center gap-3 px-2 py-10 text-center" aria-live="polite">
          <span className="mb-2 grid size-[52px] place-items-center rounded-full bg-[color-mix(in_oklab,var(--success)_13%,transparent)] text-success [&_svg]:size-[26px]" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .42, ease: enter, delay: .16 }} />
            </svg>
          </span>
          <h3 ref={successRef} tabIndex={-1} className="m-0 font-display text-(length:--text-2xl) font-medium tracking-display leading-display">Thanks, {sentTo.name}</h3>
          <p className="mx-0 mt-0 mb-3 max-w-[360px] text-(length:--text-sm) leading-[1.55] text-text-secondary">Your message is with our {topic.toLowerCase()} team. We&rsquo;ll reply to {sentTo.email} within one business day.</p>
          <Button variant="secondary" onClick={reset}>Send another message</Button>
        </div>
      : <form className="grid gap-5" onSubmit={submit} noValidate aria-label="Contact form">
          <div className="grid grid-cols-2 gap-4 @max-[520px]/contact:grid-cols-1">
            <Input ref={nameRef} label="Name" name="name" autoComplete="name" placeholder="Emma Collins" value={values.name} onChange={update("name")} error={errors.name} readOnly={phase === "sending"} />
            <Input ref={emailRef} label="Work email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="emma@northwind.example" value={values.email} onChange={update("email")} error={errors.email} readOnly={phase === "sending"} />
          </div>
          <TopicPicker topics={topics} value={topic} onChange={setTopic} reduced={reduced} />
          <Textarea ref={messageRef} label="Message" name="message" rows={4} maxLength={MAX_MESSAGE} placeholder="What are you building?" value={values.message} onChange={update("message")} error={errors.message} description={`${left} characters left`} readOnly={phase === "sending"} />
          <AnimatePresence initial={false}>
            {failure && <motion.p key="failure" role="alert" className="m-0 overflow-hidden text-(length:--text-sm) text-danger" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={reduced ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: standard } }}>{failure}</motion.p>}
          </AnimatePresence>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 @max-[520px]/contact:[&>button]:w-full">
            <p className="m-0 text-(length:--text-sm) text-text-muted">We reply within one business day.</p>
            <Button type="submit" variant="primary" loading={phase === "sending"}>Send message</Button>
          </div>
        </form>}
  </MorphPanel>;
}

const copyRow = "flex w-[min(100%,360px)] items-center justify-between gap-3 rounded-control border border-border py-1 pr-1 pl-4 text-(length:--text-sm) [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap";
const hannah = person("hannah-walsh");
const ICON = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;

/** A demo action that confirms in place: the label morphs, and the result stays visible below it. */
function ConfirmAction({ idle, busy, done, note }: { idle: string; busy?: boolean; done: string; note?: ReactNode }) {
  const reduced = !!useReducedMotion();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return <div className="grid justify-items-start gap-2">
    <Button variant={state === "done" ? "secondary" : "primary"} loading={state === "busy"} onClick={() => {
      if (state !== "idle") { setState("idle"); return; }
      if (busy) { setState("busy"); timer.current = window.setTimeout(() => setState("done"), 800); } else setState("done");
    }}>
      {state === "done" ? <><Check size={15} strokeWidth={2.25} aria-hidden="true" />{done}</> : idle}
    </Button>
    <div aria-live="polite">
      <AnimatePresence initial={false}>
        {state === "done" && note && <motion.div key="note" className="overflow-hidden text-(length:--text-sm) text-text-secondary" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={reduced ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: standard } }}>{note}</motion.div>}
      </AnimatePresence>
    </div>
  </div>;
}

export const contactExampleChannels: ContactChannel[] = [
  {
    value: "chat", label: "Chat with support", meta: "Replies in about 4 minutes", icon: <MessageCircle {...ICON} />,
    detail: <>
      <h3>Chat with support</h3>
      <p>Hannah and Jordan are online now. Chat is best for quick questions about installing, theming, or a component that misbehaves.</p>
      <ConfirmAction idle="Start a chat" busy done="Chat started" note={<span className="flex items-center gap-2 pt-1 [&_strong]:font-medium [&_strong]:text-foreground"><Avatar name={hannah.name} src={hannah.src} size="sm" status="online" /><span><strong>{hannah.name}</strong> joined the chat. Say hello.</span></span>} />
    </>,
  },
  {
    value: "email", label: "Email support", meta: "Replies within a business day", icon: <Mail {...ICON} />,
    detail: <>
      <h3>Email support</h3>
      <p>Send screenshots, links, or a reproduction. Every message gets a reply from a person within one business day.</p>
      <div className={copyRow}><span>support@example.com</span><CopyButton value="support@example.com" label="Copy email" /></div>
    </>,
  },
  {
    value: "sales", label: "Talk to sales", meta: "Weekdays, 9am to 6pm PT", icon: <Phone {...ICON} />,
    detail: <>
      <h3>Talk to sales</h3>
      <p>Licensing for a larger team, invoicing, or a security review. Tyler will walk you through it on a 20 minute call.</p>
      <div className={copyRow}><span className="tabular-nums">+1 (415) 555-0132</span><CopyButton value="+14155550132" label="Copy number" /></div>
      <ConfirmAction idle="Request a call" busy done="Call requested" note="Tyler will email you a few times that work this week." />
    </>,
  },
  {
    value: "community", label: "Ask the community", meta: "4,200 members", icon: <Users {...ICON} />,
    detail: <>
      <h3>Ask the community</h3>
      <p>Designers and engineers who ship with Tangent answer questions about components, theming, and motion, usually within the hour.</p>
      <ConfirmAction idle="Open the forum" done="Forum opened" note="The forum opens in a new tab on the live site." />
    </>,
  },
];

export const contactExampleOffices: ContactOffice[] = [
  { city: "San Francisco", timeZone: "America/Los_Angeles", address: ["100 Example Street, Floor 4", "San Francisco, CA 94000"], email: "sf@example.com" },
  { city: "New York", timeZone: "America/New_York", address: ["200 Sample Avenue, Suite 12", "New York, NY 10000"], email: "nyc@example.com" },
  { city: "Lisbon", timeZone: "Europe/Lisbon", address: ["Rua do Exemplo 10, 3º", "1000-000 Lisboa, Portugal"], email: "lisbon@example.com" },
];

function useNow(intervalMs: number) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function officeState(office: ContactOffice, now: Date | null) {
  if (!now) return { time: "--:--", open: null as boolean | null };
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: office.timeZone, hour: "numeric", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const hour = Number(get("hour")), weekday = get("weekday");
  const [start, end] = office.hours ?? [9, 18];
  const time = new Intl.DateTimeFormat("en-US", { timeZone: office.timeZone, hour: "numeric", minute: "2-digit" }).format(now);
  return { time, open: weekday !== "Sat" && weekday !== "Sun" && hour >= start && hour < end };
}

const hourLabel = (hour: number) => `${hour % 12 || 12}${hour < 12 || hour === 24 ? "am" : "pm"}`;

function Offices({ offices }: { offices: ContactOffice[] }) {
  const now = useNow(15000);
  return <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 p-0">
    {offices.map(office => {
      const { time, open } = officeState(office, now);
      return <li key={office.city} className="grid content-start gap-3 rounded-panel border border-border bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3 [&_h3]:m-0 [&_h3]:text-(length:--text-lg) [&_h3]:font-medium [&_h3]:leading-body">
          <h3>{office.city}</h3>
          <span className="inline-flex flex-none items-baseline gap-1.5 text-(length:--text-sm) text-text-secondary [&_svg]:self-center"><Clock size={14} strokeWidth={1.75} aria-hidden="true" /><span className="tabular-nums">{time}</span></span>
        </div>
        <span className="group/status inline-flex items-center gap-2 text-(length:--text-sm) text-text-secondary" data-open={open === null ? undefined : open ? "" : undefined} data-closed={open === false ? "" : undefined}>
          <span className="size-[7px] rounded-full bg-border-strong transition-[background-color] duration-240 ease-standard motion-reduce:transition-none group-data-[open]/status:bg-success group-data-[open]/status:shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_18%,transparent)]" aria-hidden="true" />{open === null ? "Checking hours" : open ? `Open until ${hourLabel((office.hours ?? [9, 18])[1])}` : "Closed now"}
        </span>
        <address className="mt-1 grid text-(length:--text-sm) leading-[1.55] not-italic text-text-secondary">{office.address.map(line => <span key={line}>{line}</span>)}</address>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
          {office.email && <a className="text-(length:--text-sm) text-foreground no-underline pointer-fine:hover:underline pointer-fine:hover:underline-offset-[3px]" href={`mailto:${office.email}`}>{office.email}</a>}
          <CopyButton value={office.address.join(", ")} label="Copy address" variant="plain" />
        </div>
      </li>;
    })}
  </ul>;
}

function Channels({ channels, value, onChange, reduced }: { channels: ContactChannel[]; value: string; onChange: (value: string) => void; reduced: boolean }) {
  const id = useId();
  const [direction, setDirection] = useState(1);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = channels.find(channel => channel.value === value) ?? channels[0];
  const choose = (next: string) => {
    if (next === active.value) return;
    setDirection(Math.sign(channels.findIndex(channel => channel.value === next) - channels.indexOf(active)) || 1);
    onChange(next);
  };
  function onKeyDown(event: KeyboardEvent) {
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    const edge = event.key === "Home" ? 0 : event.key === "End" ? channels.length - 1 : -1;
    if (!delta && edge < 0) return;
    event.preventDefault();
    const next = edge >= 0 ? edge : (channels.indexOf(active) + delta + channels.length) % channels.length;
    choose(channels[next].value);
    refs.current[next]?.focus();
  }
  return <div className="grid grid-cols-[minmax(220px,300px)_minmax(0,1fr)] items-start gap-6 @max-[820px]/contact:grid-cols-[minmax(0,1fr)]">
    <LayoutGroup id={id}>
      <div className="grid gap-0.5 @max-[820px]/contact:flex @max-[820px]/contact:overflow-x-auto @max-[820px]/contact:[scrollbar-width:none] @max-[820px]/contact:[&::-webkit-scrollbar]:hidden" role="tablist" aria-orientation="vertical" aria-label="Ways to reach us" onKeyDown={onKeyDown}>
        {channels.map((channel, index) => {
          const selected = channel.value === active.value;
          return <button key={channel.value} ref={node => { refs.current[index] = node; }} type="button" role="tab" id={`${id}-tab-${channel.value}`} aria-selected={selected} aria-controls={`${id}-panel`} tabIndex={selected ? 0 : -1} className="group relative isolate flex cursor-pointer items-center gap-3 rounded-2xl border-0 bg-transparent px-4 py-3 text-left font-[inherit] text-foreground [-webkit-tap-highlight-color:transparent] @max-[820px]/contact:flex-none" onClick={() => choose(channel.value)}>
            {selected && <motion.span layoutId="channel" className="absolute inset-0 -z-10 rounded-[inherit] bg-surface-muted" transition={reduced ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
            <span className="flex flex-none text-text-muted transition-[color] duration-160 ease-standard motion-reduce:transition-none group-aria-selected:text-accent pointer-fine:group-hover:text-foreground!">{channel.icon}</span>
            <span className="grid min-w-0 gap-px [&>span:first-child]:text-(length:--text-sm) [&>span:first-child]:font-medium [&>span:last-child]:overflow-hidden [&>span:last-child]:text-(length:--text-xs) [&>span:last-child]:text-ellipsis [&>span:last-child]:whitespace-nowrap [&>span:last-child]:text-text-muted @max-[820px]/contact:[&>span:last-child]:hidden"><span>{channel.label}</span><span>{channel.meta}</span></span>
          </button>;
        })}
      </div>
    </LayoutGroup>
    <MorphPanel faceKey={active.value} direction={direction} axis="y" reduced={reduced} className="rounded-panel border border-border bg-surface [&>[data-face]]:p-6 @max-[520px]/contact:[&>[data-face]]:p-5" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active.value}`}>
      <div className="grid justify-items-start gap-3 [&_h3]:m-0 [&_h3]:text-(length:--text-lg) [&_h3]:font-medium [&_h3]:leading-body [&_p]:mx-0 [&_p]:mt-0 [&_p]:mb-2 [&_p]:max-w-[480px] [&_p]:text-(length:--text-sm) [&_p]:leading-[1.6] [&_p]:text-text-secondary">{active.detail}</div>
    </MorphPanel>
  </div>;
}

/**
 * A contact section in three layouts: a validated form whose card springs into a confirmation, a list of support
 * channels whose detail panel morphs to each channel, and office cards with live local times and open status.
 */
export const ContactSection = forwardRef<HTMLElement, ContactSectionProps>(function ContactSection({
  variant = "form",
  title,
  description,
  topics = ["Sales", "Support", "Partnerships", "Press"],
  onSubmit,
  channels = contactExampleChannels,
  channel: channelProp,
  defaultChannel,
  onChannelChange,
  offices = contactExampleOffices,
  className,
}, ref) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const [innerChannel, setInnerChannel] = useState(defaultChannel ?? channels[0]?.value ?? "");
  const activeChannel = channelProp ?? innerChannel;
  const setChannel = (next: string) => { if (channelProp === undefined) setInnerChannel(next); onChannelChange?.(next); };
  const copy = {
    form: { title: "Talk to our team", description: "Questions about licensing, a bug you can't pin down, or a component you wish existed. A person reads every message." },
    channels: { title: "Get help your way", description: "Pick whatever suits the question. Every channel reaches the same small team." },
    offices: { title: "Visit us", description: "We work across three time zones, so someone is usually awake. Drop by for coffee, just let us know first." },
  }[variant];

  return <section ref={ref} className={cn("@container/contact bg-background font-body tracking-body text-foreground", className)} data-variant={variant} aria-labelledby={`${id}-title`}>
    <div className={cn("mx-auto grid max-w-[1120px] gap-10 px-8 py-20 @max-[520px]/contact:px-4 @max-[520px]/contact:py-12", variant === "form" && "grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] items-start gap-12 @max-[820px]/contact:grid-cols-[minmax(0,1fr)] @max-[820px]/contact:gap-8")}>
      <div className="grid max-w-[520px] content-start gap-3">
        <h2 id={`${id}-title`} className="m-0 font-display text-[length:clamp(1.75rem,1rem+3cqi,var(--text-4xl))] font-medium tracking-display leading-display text-balance">{title ?? copy.title}</h2>
        <p className="m-0 text-(length:--text-base) leading-normal text-text-secondary text-pretty">{description ?? copy.description}</p>
        {variant === "form" && <ul className="m-0 mt-4 grid list-none gap-2 p-0 [&_li]:flex [&_li]:min-h-8 [&_li]:items-center [&_li]:gap-2 [&_li]:text-(length:--text-sm) [&_li]:text-text-secondary [&_svg]:flex-none">
          <li><Clock size={16} strokeWidth={1.75} aria-hidden="true" />Replies within one business day</li>
          <li><Mail size={16} strokeWidth={1.75} aria-hidden="true" /><span>hello@example.com</span><CopyButton value="hello@example.com" label="Copy email" iconOnly variant="plain" /></li>
        </ul>}
      </div>
      {variant === "form" && <ContactForm topics={topics} onSubmit={onSubmit} reduced={reduced} />}
      {variant === "channels" && <Channels channels={channels} value={activeChannel} onChange={setChannel} reduced={reduced} />}
      {variant === "offices" && <Offices offices={offices} />}
    </div>
  </section>;
});

ContactSection.displayName = "ContactSection";

const variantOptions = [{ value: "form", label: "Form" }, { value: "channels", label: "Channels" }, { value: "offices", label: "Offices" }];

/** Preview: the contact section with a switch between its three layouts. Messages are simulated and never sent. */
export function ContactSectionBlock({ variant: initial = "form" }: { variant?: ContactSectionVariant }) {
  const [variant, setVariant] = useState<ContactSectionVariant>(initial);
  return <div className="grid w-full justify-items-center gap-4">
    <SegmentedControl label="Contact layout" options={variantOptions} value={variant} onValueChange={next => setVariant(next as ContactSectionVariant)} />
    <div className="w-full overflow-hidden rounded-[20px] border border-border bg-background">
      <ContactSection key={variant} variant={variant} />
    </div>
  </div>;
}

export default ContactSectionBlock;
