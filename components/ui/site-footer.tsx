"use client";

import { forwardRef, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import SegmentedControl from "@/components/ui/segmented-control";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

export type SiteFooterVariant = "columns" | "minimal" | "logo";

export interface SiteFooterLink {
  label: string;
  href?: string;
  /** Opens in a new tab and shows an outward arrow. */
  external?: boolean;
}

export interface SiteFooterColumn {
  title: string;
  links: SiteFooterLink[];
}

export interface SiteFooterNewsletter {
  title?: string;
  description?: string;
  placeholder?: string;
  /** Called with a valid address. Throw or reject to show an error; resolve to show the subscribed state. */
  onSubscribe?: (email: string) => void | Promise<void>;
}

export interface SiteFooterProps {
  /** `columns` pairs a newsletter with link columns, `minimal` is one quiet row, `logo` ends in a large fading brand mark. */
  variant?: SiteFooterVariant;
  brand?: { name: string; href?: string; mark?: ReactNode };
  /** One short line under the brand. */
  tagline?: string;
  columns?: SiteFooterColumn[];
  /** Links for the minimal variant. Defaults to the first link of each column. */
  links?: SiteFooterLink[];
  /** Small links beside the copyright, such as Privacy and Terms. */
  legal?: SiteFooterLink[];
  socials?: SiteFooterLink[];
  /** Newsletter signup. Pass null to hide it. */
  newsletter?: SiteFooterNewsletter | null;
  /** A system status link. Pass null to hide it. */
  status?: { label: string; tone?: "success" | "warning" | "danger"; href?: string } | null;
  /** Year in the copyright line. */
  year?: number;
  /** Called for every link that is pressed. Links without an href render as buttons and only call this. */
  onNavigate?: (link: SiteFooterLink) => void;
  className?: string;
}

type Bezier = [number, number, number, number];
const enter = [...motionTokens.ease.enter] as Bezier;

export const siteFooterExampleColumns: SiteFooterColumn[] = [
  { title: "Product", links: [{ label: "Components" }, { label: "Blocks" }, { label: "Templates" }, { label: "Pricing" }] },
  { title: "Resources", links: [{ label: "Documentation" }, { label: "Changelog" }, { label: "Guides" }, { label: "Figma kit", external: true }] },
  { title: "Company", links: [{ label: "About" }, { label: "Customers" }, { label: "Careers" }, { label: "Contact" }] },
];
const exampleLegal: SiteFooterLink[] = [{ label: "Privacy" }, { label: "Terms" }, { label: "Licenses" }];
const exampleSocials: SiteFooterLink[] = [{ label: "X", external: true }, { label: "GitHub", external: true }, { label: "LinkedIn", external: true }];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* The footer is its own size container, so the layout folds by the space it has rather than the viewport. */
const s = {
  footer: "@container/site-footer relative overflow-hidden border-t border-border bg-background px-6 pt-12 pb-6 font-body tracking-body text-foreground [--footer-pad:var(--space-6)]",
  srOnly: "absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]",
  top: "grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-12 @max-[761px]/site-footer:grid-cols-[minmax(0,1fr)] @max-[761px]/site-footer:gap-10",
  intro: "grid min-w-0 content-start gap-3",
  brandRow: "inline-flex items-center gap-2",
  brandMark: "size-[22px] flex-none text-foreground",
  brand: "cursor-pointer border-0 bg-transparent p-0 text-left text-base leading-body font-medium text-foreground no-underline",
  tagline: "m-0 max-w-[320px] text-sm leading-body text-text-secondary",
  columns: "grid grid-cols-[repeat(3,minmax(0,1fr))] gap-6 @max-[521px]/site-footer:grid-cols-[repeat(2,minmax(0,1fr))] @max-[521px]/site-footer:gap-x-4 @max-[521px]/site-footer:gap-y-8",
  column: "[&_h2]:m-0 [&_h2]:mb-3 [&_h2]:text-sm [&_h2]:leading-body [&_h2]:font-medium",
  columnList: "m-0 grid list-none gap-2 p-0",
  link: "group/link inline-flex cursor-pointer items-center gap-[3px] border-0 bg-transparent px-0 py-[2px] text-left text-sm leading-body text-text-secondary no-underline transition-colors duration-160 ease-standard focus-visible:text-foreground active:text-foreground pointer-fine:hover:text-foreground motion-reduce:transition-none",
  external: "text-text-muted transition-transform duration-160 ease-standard pointer-fine:group-hover/link:translate-x-px pointer-fine:group-hover/link:-translate-y-px motion-reduce:transition-none",
  /* Newsletter: input and button share one shell; the shell carries validation state with its border only. */
  newsletter: "mt-5 grid max-w-[400px] gap-2 @max-[521px]/site-footer:max-w-none",
  newsletterTitle: "m-0 text-sm leading-body font-medium",
  newsletterRow: "flex h-control-md items-center gap-2 rounded-control border border-border bg-surface py-[3px] pr-[3px] pl-4 transition-colors duration-160 ease-standard motion-reduce:transition-none",
  newsletterInput: "w-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm leading-body text-foreground placeholder:text-text-muted",
  newsletterButton: "flex-none rounded-[calc(var(--radius-control)_-_3px)]",
  messageSlot: "relative min-h-5",
  message: "m-0 text-xs leading-5",
  bottom: "mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border-subtle pt-5 @max-[521px]/site-footer:flex-col @max-[521px]/site-footer:items-start",
  bottomGroup: "flex flex-wrap items-center gap-x-5 gap-y-2",
  inline: "m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0",
  copyright: "text-sm leading-body text-text-muted",
  status: "inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent px-0 py-[2px] text-sm leading-body text-text-secondary no-underline pointer-fine:hover:text-foreground",
  statusDot: "size-[7px] rounded-full bg-[var(--tone)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--tone)_18%,transparent)]",
  /* Minimal: two quiet rows. */
  minimal: "pt-8 pb-6",
  minimalRow: "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 [&+&]:mt-6 [&+&]:border-t [&+&]:border-border-subtle [&+&]:pt-5",
  /* Logo: the arch closes the page, cropped by the bottom edge and fading out in the brand gradient. */
  logo: "pb-0",
  markStage: "pointer-events-none mt-10 -mx-[var(--footer-pad)] [-webkit-mask-image:linear-gradient(to_bottom,#000_18%,transparent_96%)] [mask-image:linear-gradient(to_bottom,#000_18%,transparent_96%)]",
  bigMark: "block h-auto w-full",
  preview: "grid w-full justify-items-center gap-4",
  frame: "w-full overflow-hidden rounded-[20px] border border-border bg-background",
  frameBody: "overflow-hidden",
};
const toneVar = { success: "[--tone:var(--success)]", warning: "[--tone:var(--warning)]", danger: "[--tone:var(--danger)]" } as const;
const messageTone = { error: "text-danger", success: "text-success", hint: "text-text-muted" } as const;

function FooterLink({ link, onNavigate, className }: { link: SiteFooterLink; onNavigate?: (link: SiteFooterLink) => void; className?: string }) {
  const content = <>{link.label}{link.external && <ArrowUpRight className={s.external} size={13} strokeWidth={2} aria-hidden="true" />}</>;
  const onClick = () => onNavigate?.(link);
  if (link.href) return <a className={className ?? s.link} href={link.href} onClick={onClick} {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{content}</a>;
  return <button type="button" className={className ?? s.link} onClick={onClick}>{content}</button>;
}

function TangentMark({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="32" cy="36" r="17" />
    <path d="M8 19h48" />
  </svg>;
}

/** Email signup that validates in place, keeps its width while the button morphs, and confirms without a toast. */
function Newsletter({ title, description, placeholder = "you@example.com", onSubscribe }: SiteFooterNewsletter) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const validate = (value: string) => !value.trim() ? "Enter your email address" : EMAIL.test(value.trim()) ? null : "That email doesn't look right";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state !== "idle") return;
    setTouched(true);
    const problem = validate(email);
    setError(problem);
    if (problem) return;
    setState("loading");
    try {
      await (onSubscribe ? onSubscribe(email.trim()) : new Promise(resolve => setTimeout(resolve, 900)));
      setState("done");
    } catch {
      setState("idle");
      setError("We couldn't subscribe you. Try again in a moment");
    }
  }

  const message = state === "done" ? `Check ${email.trim()} to confirm` : error ?? description;
  const tone = state === "done" ? "success" : error ? "error" : "hint";

  return <form className={s.newsletter} onSubmit={submit} noValidate aria-labelledby={title ? `${id}-title` : undefined}>
    {title && <h2 id={`${id}-title`} className={s.newsletterTitle}>{title}</h2>}
    <div className={cn(s.newsletterRow, error ? "border-danger" : "focus-within:border-border-strong")} data-invalid={error ? "" : undefined} data-done={state === "done" ? "" : undefined}>
      <label className={s.srOnly} htmlFor={`${id}-email`}>Email address</label>
      <input
        id={`${id}-email`}
        className={cn(s.newsletterInput, state === "done" && "text-text-secondary")}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={placeholder}
        value={email}
        readOnly={state !== "idle"}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-message`}
        onChange={event => { setEmail(event.target.value); if (touched) setError(validate(event.target.value)); }}
        onBlur={() => { if (email) { setTouched(true); setError(validate(email)); } }}
      />
      <Button type="submit" size="sm" variant="primary" loading={state === "loading"} className={s.newsletterButton} aria-disabled={state === "done" || undefined}>
        {state === "done" ? <><Check size={15} strokeWidth={2.25} aria-hidden="true" />Subscribed</> : "Subscribe"}
      </Button>
    </div>
    <div className={s.messageSlot} id={`${id}-message`} aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {message && <motion.p key={message} className={cn(s.message, messageTone[tone])} data-tone={tone} role={tone === "error" ? "alert" : undefined}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: `blur(${motionTokens.blur.subtle}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.instant } }}
          transition={{ duration: reduced ? 0 : motionTokens.duration.standard, ease: enter }}>{message}</motion.p>}
      </AnimatePresence>
    </div>
  </form>;
}

/**
 * A website footer in three layouts: link columns with a newsletter signup, a single quiet row, and a closing
 * variant where the brand mark rises in, oversized and cropped by the bottom edge, fading into the page.
 */
export const SiteFooter = forwardRef<HTMLElement, SiteFooterProps>(function SiteFooter({
  variant = "columns",
  brand = { name: "Tangent" },
  tagline = "Interface components that move with intent.",
  columns = siteFooterExampleColumns,
  links,
  legal = exampleLegal,
  socials = exampleSocials,
  newsletter = { title: "Get the monthly release notes", description: "One email a month. Unsubscribe anytime." },
  status = { label: "All systems normal", tone: "success" },
  year = new Date().getFullYear(),
  onNavigate,
  className,
}, ref) {
  const reduced = !!useReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const brandNode = <FooterLink link={{ label: brand.name, href: brand.href }} onNavigate={onNavigate} className={s.brand} />;
  const brandWithMark = <span className={s.brandRow}>{brand.mark ?? <TangentMark className={s.brandMark} />}{brandNode}</span>;
  const statusTone = status?.tone ?? "success";
  const statusNode = status && (status.href
    ? <a className={cn(s.status, toneVar[statusTone])} href={status.href} data-tone={statusTone} onClick={() => onNavigate?.({ label: status.label, href: status.href })}><span className={s.statusDot} aria-hidden="true" />{status.label}</a>
    : <button type="button" className={cn(s.status, toneVar[statusTone])} data-tone={statusTone} onClick={() => onNavigate?.({ label: status.label })}><span className={s.statusDot} aria-hidden="true" />{status.label}</button>);
  const socialNode = socials.length > 0 && <ul className={s.inline} aria-label="Social">{socials.map(link => <li key={link.label}><FooterLink link={link} onNavigate={onNavigate} /></li>)}</ul>;
  const legalRow = <div className={s.bottom}>
    <div className={s.bottomGroup}>
      <span className={s.copyright}>© {year} {brand.name}</span>
      {legal.length > 0 && <ul className={s.inline} aria-label="Legal">{legal.map(link => <li key={link.label}><FooterLink link={link} onNavigate={onNavigate} /></li>)}</ul>}
    </div>
    <div className={s.bottomGroup}>{statusNode}{socialNode}</div>
  </div>;
  const columnNav = <nav className={s.columns} aria-label="Footer">
    {columns.map(column => <div key={column.title} className={s.column}>
      <h2>{column.title}</h2>
      <ul className={s.columnList}>{column.links.map(link => <li key={link.label}><FooterLink link={link} onNavigate={onNavigate} /></li>)}</ul>
    </div>)}
  </nav>;

  if (variant === "minimal") {
    const rowLinks = links ?? columns.map(column => column.links[0]).filter(Boolean).concat(legal.slice(0, 2));
    return <footer ref={ref} className={cn(s.footer, s.minimal, className)}>
      <div className={s.minimalRow}>
        {brandWithMark}
        <nav aria-label="Footer"><ul className={s.inline}>{rowLinks.map(link => <li key={link.label}><FooterLink link={link} onNavigate={onNavigate} /></li>)}</ul></nav>
      </div>
      <div className={s.minimalRow}>
        <span className={s.copyright}>© {year} {brand.name}. {tagline}</span>
        <div className={s.bottomGroup}>{statusNode}{socialNode}</div>
      </div>
    </footer>;
  }

  return <footer ref={ref} className={cn(s.footer, variant === "logo" && s.logo, className)}>
    <div className={s.top}>
      <div className={s.intro}>
        {brandWithMark}
        {tagline && <p className={s.tagline}>{tagline}</p>}
        {newsletter && variant === "columns" && <Newsletter {...newsletter} />}
      </div>
      {columnNav}
    </div>
    {legalRow}
    {variant === "logo" && <motion.div className={s.markStage} aria-hidden="true"
      initial={reduced ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: .3 }}
      transition={{ duration: reduced ? 0 : .9, ease: enter }}>
      {/* The top of the mark, drawn oversized and cropped by its viewBox, in the brand gradient and fading toward the bottom edge. */}
      <svg className={s.bigMark} viewBox="0 3.5 64 30" fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" preserveAspectRatio="xMidYMin meet">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "var(--brand-gradient-from)" }} />
            <stop offset="1" style={{ stopColor: "var(--brand-gradient-to)" }} />
          </linearGradient>
        </defs>
        <g stroke={`url(#${gradientId})`}>
          <circle cx="32" cy="36" r="17" />
          <path d="M8 19h48" />
        </g>
      </svg>
    </motion.div>}
  </footer>;
});

SiteFooter.displayName = "SiteFooter";

const variantOptions = [{ value: "columns", label: "Columns" }, { value: "minimal", label: "Minimal" }, { value: "logo", label: "Logo" }];

/** Preview: the footer with a switch between its three layouts and a note of the last link pressed. */
export function SiteFooterBlock({ variant: initial = "columns" }: { variant?: SiteFooterVariant }) {
  const [variant, setVariant] = useState<SiteFooterVariant>(initial);
  const [last, setLast] = useState<string | null>(null);
  const reduced = !!useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  // The frame springs between layout heights instead of snapping; the new layout fades in where it sits.
  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    setHeight(node.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, [variant]);
  return <div className={s.preview}>
    <SegmentedControl label="Footer layout" options={variantOptions} value={variant} onValueChange={value => setVariant(value as SiteFooterVariant)} />
    <div className={cn(s.frame, "[&_footer]:border-t-0")}>
      <motion.div className={s.frameBody} initial={false} animate={{ height: height ?? "auto" }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
        <motion.div ref={contentRef} key={variant} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motionTokens.duration.standard, ease: enter }}>
          <SiteFooter variant={variant} onNavigate={link => setLast(link.label)} />
        </motion.div>
      </motion.div>
    </div>
    <p className={s.srOnly} aria-live="polite">{last ? `Opened ${last}` : ""}</p>
  </div>;
}

export default SiteFooterBlock;
