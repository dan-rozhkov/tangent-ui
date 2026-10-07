"use client";

import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue } from "motion/react";
import { ArrowRightIcon, CheckIcon, XIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button";
import SegmentedControl from "@/components/ui/segmented-control";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { ctaCopy, ctaFaces, ctaSetup, type CtaAction } from "./cta-section-data";
import { useReducedMotion } from "@/lib/reduced-motion";

export type { CtaAction } from "./cta-section-data";
export type CtaVariant = "centered" | "split" | "banner";

export interface CtaSectionProps {
  /** `centered` is a closing section, `split` sits beside a product visual, `banner` is one dismissible line. */
  variant?: CtaVariant;
  title?: string;
  description?: string;
  primaryAction?: CtaAction;
  /** Not shown in the banner variant. Pass null to hide it. */
  secondaryAction?: CtaAction | null;
  /** Small print under the actions in the centered variant, such as "No credit card required". */
  note?: string;
  /** Faces beside the note in the centered variant. Pass an empty array to hide them. */
  faces?: string[];
  /** Short benefit lines in the split variant. */
  points?: string[];
  /** Replaces the split variant's setup card. */
  visual?: ReactNode;
  /** Banner only: shows a dismiss button and calls this after it closes. */
  onDismiss?: () => void;
  className?: string;
}

type Bezier = [number, number, number, number];
/** The arrow leans forward on hover. Transform is spelled out because a Tailwind translate would not ride this transition. */
const arrowClass = "transition-[transform] duration-160 ease-standard motion-reduce:transition-none pointer-fine:group-hover/action:[transform:translateX(3px)]";
const actionsClass = "mt-4 flex flex-wrap gap-3 @max-[560px]/cta:w-full @max-[560px]/cta:flex-col @max-[560px]/cta:[&>*]:w-full";
const titleClass = "m-0 font-display text-[length:clamp(1.875rem,1rem+3.4cqi,var(--text-4xl))] font-medium tracking-display leading-display text-balance";
const descriptionClass = "m-0 text-(length:--text-lg) leading-body text-text-secondary text-pretty @max-[560px]/cta:text-(length:--text-base)";

const enter = [...motionTokens.ease.enter] as Bezier;
const standard = [...motionTokens.ease.standard] as Bezier;

/** A link, a callback, or (with neither) a button that confirms in place, so previews always answer a click. */
function Action({ action, variant, size = "lg", arrow }: { action: CtaAction; variant: "primary" | "secondary"; size?: "sm" | "md" | "lg"; arrow?: boolean }) {
  const [confirmed, setConfirmed] = useState(false);
  if (action.href) {
    return <a className={cn(
      "group/action inline-flex items-center justify-center gap-2 rounded-control border border-transparent text-(length:--text-sm) font-medium no-underline transition-[background-color,border-color,transform] duration-160 ease-standard active:scale-[.97] motion-reduce:transition-none motion-reduce:active:transform-none",
      size === "sm" ? "h-control-sm px-3.5" : "h-control-lg px-5",
      variant === "primary" ? "bg-foreground text-background" : "border-border bg-surface text-foreground",
    )} data-variant={variant} data-size={size} href={action.href}>
      {action.label}{arrow && <ArrowRightIcon className={arrowClass} size={16} aria-hidden="true" />}
    </a>;
  }
  const simulated = !action.onClick;
  return <Button
    className="group/action"
    variant={variant}
    size={size}
    aria-live={simulated ? "polite" : undefined}
    onClick={() => { if (action.onClick) action.onClick(); else setConfirmed(value => !value); }}
  >
    {confirmed
      ? <><CheckIcon size={16} aria-hidden="true" />{action.confirmedLabel ?? action.label}</>
      : <>{action.label}{arrow && <ArrowRightIcon className={arrowClass} size={16} aria-hidden="true" />}</>}
  </Button>;
}

/** A setup card that ticks through its steps once it scrolls into view. */
const statusSpan = "[grid-area:1/1] opacity-0 [transform:translateY(4px)] [filter:blur(2px)] [transition:opacity_var(--duration-fast)_var(--ease-standard),transform_var(--duration-standard)_var(--ease-enter),filter_var(--duration-fast)_var(--ease-standard)] data-[shown]:opacity-100 data-[shown]:[transform:none] data-[shown]:[filter:blur(0)] motion-reduce:transition-none";

function SetupVisual({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: .5 });
  const total = ctaSetup.steps.length;
  const [step, setStep] = useState(0);
  const shown = reduced ? total : step;

  useEffect(() => {
    if (!inView || reduced) return;
    const timers = ctaSetup.steps.map((_, index) => window.setTimeout(() => setStep(index + 1), 520 + index * 620));
    return () => timers.forEach(window.clearTimeout);
  }, [inView, reduced]);

  return <div ref={ref} className="group/setup w-[min(100%,360px)] overflow-hidden rounded-panel border border-border bg-surface-raised shadow-raised" aria-hidden="true" data-done={shown === total ? "" : undefined}>
    <div className="flex items-center gap-2.5 px-[18px] pt-4 pb-3.5">
      <span className="grid size-7 flex-none place-items-center rounded-lg bg-foreground text-(length:--text-sm) font-medium text-background">{ctaSetup.workspace.charAt(0)}</span>
      <span className="text-(length:--text-sm) font-medium">{ctaSetup.workspace}</span>
      <span className="ml-auto inline-grid justify-items-end text-(length:--text-xs) text-text-muted">
        <span className={statusSpan} data-shown={shown < total ? "" : undefined}>Setting up</span>
        <span className={cn(statusSpan, "group-data-[done]/setup:font-medium group-data-[done]/setup:text-success")} data-shown={shown === total ? "" : undefined}>Ready</span>
      </span>
    </div>
    <div className="mx-[18px] h-0.5 overflow-hidden rounded-[1px] bg-border"><span className="block h-full origin-left bg-success [transition:transform_var(--duration-considered)_var(--ease-in-out)] motion-reduce:transition-none" style={{ transform: `scaleX(${shown / total})` }} /></div>
    <ol className="m-0 grid list-none gap-0.5 px-2 pt-2.5 pb-3">
      {ctaSetup.steps.map((label, index) => {
        const done = index < shown;
        return <li key={label} className="group/step flex min-h-11 items-center gap-3 rounded-[14px] px-2.5 text-(length:--text-sm) text-text-muted transition-[color,background-color] duration-240 ease-standard motion-reduce:transition-none data-[active]:bg-surface-muted data-[active]:text-foreground data-[done]:text-foreground" data-done={done ? "" : undefined} data-active={index === shown ? "" : undefined}>
          <span className="relative grid size-5 flex-none place-items-center rounded-full border-[1.5px] border-dashed border-border-strong text-transparent transition-[border-color,background-color,color] duration-240 ease-standard group-data-[active]/step:border-solid group-data-[active]/step:border-text-muted group-data-[done]/step:border-solid group-data-[done]/step:border-success group-data-[done]/step:bg-success group-data-[done]/step:text-background motion-reduce:transition-none [&_svg]:opacity-0 [&_svg]:[transform:scale(.5)] [&_svg]:[transition:transform_var(--duration-spring)_var(--ease-spring),opacity_var(--duration-fast)_var(--ease-standard)] group-data-[done]/step:[&_svg]:opacity-100 group-data-[done]/step:[&_svg]:[transform:scale(1)] motion-reduce:[&_svg]:transition-none"><CheckIcon size={12} /></span>
          <span className="min-w-0 truncate">{label}</span>
          {index === total - 1 && <span className="ml-auto flex pl-1.5 [&_img]:-ml-1.5 [&_img]:block [&_img]:size-[22px] [&_img]:rounded-full [&_img]:border-2 [&_img]:border-surface-raised [&_img]:object-cover [&_img]:opacity-0 [&_img]:[transform:translateX(-6px)_scale(.9)] [&_img]:[transition:opacity_var(--duration-standard)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)] group-data-[active]/step:[&_img]:opacity-100 group-data-[active]/step:[&_img]:[transform:none] group-data-[done]/step:[&_img]:opacity-100 group-data-[done]/step:[&_img]:[transform:none] motion-reduce:[&_img]:transition-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {ctaSetup.faces.map((src, face) => <img key={src} src={src} alt="" width={22} height={22} style={{ transitionDelay: `${face * 60}ms` }} />)}
          </span>}
        </li>;
      })}
    </ol>
  </div>;
}

function Faces({ faces }: { faces: string[] }) {
  if (!faces.length) return null;
  return <span className="flex pl-1.5 [&_img]:-ml-1.5 [&_img]:block [&_img]:size-[26px] [&_img]:rounded-full [&_img]:border-2 [&_img]:border-surface [&_img]:object-cover" aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {faces.slice(0, 4).map(src => <img key={src} src={src} alt="" width={26} height={26} />)}
  </span>;
}

/**
 * A call to action in three shapes: a centered closing section, a split layout beside a setup card that completes
 * itself in view, and a compact banner that closes its gap when dismissed.
 */
export const CtaSection = forwardRef<HTMLElement, CtaSectionProps>(function CtaSection({
  variant = "centered",
  title,
  description,
  primaryAction,
  secondaryAction,
  note,
  faces = ctaFaces,
  points,
  visual,
  onDismiss,
  className,
}, ref) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const [open, setOpen] = useState(true);
  const copy = ctaCopy[variant];
  const heading = title ?? copy.title;
  const text = description ?? copy.description;
  const primary = primaryAction ?? copy.primary;
  const secondary = secondaryAction === null ? null : secondaryAction ?? ("secondary" in copy ? copy.secondary : undefined);
  const classes = cn("@container/cta bg-background font-body tracking-body text-foreground [&_*]:box-border", className);

  if (variant === "banner") {
    return <section ref={ref} className={classes} data-variant="banner" aria-labelledby={`${id}-title`}>
      <AnimatePresence initial={false} onExitComplete={onDismiss}>
        {open && <motion.div
          key="banner"
          className="overflow-hidden"
          exit={reduced ? { opacity: 0, transition: { duration: motionTokens.duration.instant } } : { opacity: 0, height: 0, transition: { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: standard } } }}
        >
          <div className="mx-auto max-w-[calc(1120px+2*var(--space-8))] px-8 py-6 @max-[560px]/cta:p-4"><div className="flex items-center justify-between gap-4 rounded-[20px] border border-border bg-surface py-2.5 pr-2.5 pl-5 @max-[560px]/cta:flex-col @max-[560px]/cta:items-start @max-[560px]/cta:p-4">
            <p className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-(length:--text-sm) leading-body [&_strong]:font-medium [&_span]:text-text-secondary">
              <strong id={`${id}-title`}>{heading}</strong>
              <span>{text}</span>
            </p>
            <div className="flex flex-none items-center gap-1 @max-[560px]/cta:w-full @max-[560px]/cta:justify-between">
              <Action action={primary} variant="primary" size="sm" arrow />
              {onDismiss !== undefined && <button type="button" className="grid size-control-sm cursor-pointer place-items-center rounded-full border-0 bg-transparent text-text-muted [-webkit-tap-highlight-color:transparent] transition-[background-color,color,transform] duration-160 ease-standard active:scale-[.94] motion-reduce:transition-none motion-reduce:active:transform-none pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground" aria-label="Dismiss" onClick={() => setOpen(false)}>
                <XIcon size={16} aria-hidden="true" />
              </button>}
            </div>
          </div></div>
        </motion.div>}
      </AnimatePresence>
    </section>;
  }

  if (variant === "split") {
    const list = points ?? ctaCopy.split.points;
    return <section ref={ref} className={classes} data-variant="split" aria-labelledby={`${id}-title`}>
      <div className="mx-auto grid max-w-[1120px] grid-cols-2 items-center gap-16 px-8 py-24 @max-[860px]/cta:grid-cols-1 @max-[860px]/cta:gap-10 @max-[860px]/cta:py-16 @max-[560px]/cta:px-4 @max-[560px]/cta:py-12">
        <div className="grid justify-items-start gap-4">
          <h2 id={`${id}-title`} className={titleClass}>{heading}</h2>
          <p className={descriptionClass}>{text}</p>
          {list.length > 0 && <ul className="m-0 mt-2 grid list-none gap-2 p-0 [&_li]:flex [&_li]:items-center [&_li]:gap-3 [&_li]:text-(length:--text-sm) [&_li]:text-text-secondary [&_svg]:flex-none [&_svg]:text-success">
            {list.map(point => <li key={point}><CheckIcon size={16} aria-hidden="true" />{point}</li>)}
          </ul>}
          <div className={actionsClass}>
            <Action action={primary} variant="primary" arrow />
            {secondary && <Action action={secondary} variant="secondary" />}
          </div>
        </div>
        <motion.div
          className="grid min-h-[380px] place-items-center rounded-surface border border-border bg-[color-mix(in_oklab,var(--surface-muted)_55%,var(--surface))] p-8 @max-[860px]/cta:min-h-[320px] @max-[560px]/cta:rounded-[28px] @max-[560px]/cta:p-5"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: .35 }}
          transition={{ duration: motionTokens.duration.considered, ease: enter }}
        >
          {visual ?? <SetupVisual reduced={reduced} />}
        </motion.div>
      </div>
    </section>;
  }

  const small = note ?? ctaCopy.centered.note;
  return <section ref={ref} className={classes} data-variant="centered" aria-labelledby={`${id}-title`}>
    <div className="mx-auto max-w-[1120px] px-8 py-16 @max-[560px]/cta:px-4 @max-[560px]/cta:py-10">
      <div className="grid justify-items-center gap-4 rounded-surface border border-border bg-[color-mix(in_oklab,var(--surface-muted)_45%,var(--surface))] px-8 py-24 text-center @max-[560px]/cta:rounded-[28px] @max-[560px]/cta:px-5 @max-[560px]/cta:py-16">
        <h2 id={`${id}-title`} className={cn(titleClass, "max-w-[18ch]")}>{heading}</h2>
        <p className={cn(descriptionClass, "max-w-[34rem]")}>{text}</p>
        <div className={cn(actionsClass, "justify-center")}>
          <Action action={primary} variant="primary" arrow />
          {secondary && <Action action={secondary} variant="secondary" />}
        </div>
        {(small || faces.length > 0) && <p className="mx-0 mt-3 mb-0 inline-flex flex-wrap items-center justify-center gap-3 text-(length:--text-sm) text-text-muted"><Faces faces={faces} />{small}</p>}
      </div>
    </div>
  </section>;
});

CtaSection.displayName = "CtaSection";

const variantOptions = [{ value: "centered", label: "Centered" }, { value: "split", label: "Split" }, { value: "banner", label: "Banner" }];

/** Springs the frame to its content's height after a discrete change (a new layout, a dismissed banner), so the preview never snaps.
 *  Other resizes, such as the banner's own collapse or a parent reflow, follow at once so nothing lags. */
function useFrameHeight(key: string, reduced: boolean) {
  const content = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | "auto">("auto");
  const lastKey = useRef(key), armedUntil = useRef(0);
  useLayoutEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    armedUntil.current = performance.now() + 700;
  }, [key]);
  useEffect(() => {
    const node = content.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight;
      if (!measured || reduced || performance.now() > armedUntil.current) { measured = next > 0; height.jump(next || "auto"); return; }
      animate(height, next, motionTokens.spring.smooth);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, reduced]);
  return { content, height };
}

/** Preview: all three shapes. Buttons confirm in place; nothing is sent. */
export function CtaSectionBlock() {
  const reduced = !!useReducedMotion();
  const [variant, setVariant] = useState<CtaVariant>("centered");
  const [dismissed, setDismissed] = useState(false);
  const showRestore = variant === "banner" && dismissed;
  const view = showRestore ? "restore" : variant;
  const { content, height } = useFrameHeight(view, reduced);
  // The first layout appears as is; later layouts fade in while the frame springs to their height.
  const [changed, setChanged] = useState(false);
  return <div className="grid w-full justify-items-center gap-4">
    <SegmentedControl label="Call to action layout" options={variantOptions} value={variant} onValueChange={next => { setChanged(true); setVariant(next as CtaVariant); setDismissed(false); }} />
    <motion.div className="w-full overflow-hidden rounded-[20px] border border-border bg-background" style={{ height }}>
      <div ref={content}>
        <motion.div key={view} initial={reduced || !changed ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motionTokens.duration.standard, ease: standard }}>
          {showRestore
            ? <div className="grid min-h-[104px] place-items-center p-6"><Button variant="secondary" size="sm" onClick={() => setDismissed(false)}>Show the banner again</Button></div>
            : <CtaSection variant={variant} onDismiss={variant === "banner" ? () => { setChanged(true); setDismissed(true); } : undefined} />}
        </motion.div>
      </div>
    </motion.div>
  </div>;
}

export default CtaSectionBlock;
