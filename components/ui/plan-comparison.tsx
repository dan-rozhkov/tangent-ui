"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import SegmentedControl from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

type Plan = "team" | "studio";
type Billing = "monthly" | "yearly";
type Feature = { label: string; team: string; studio: string; shared?: boolean };

const features: Feature[] = [
  { label: "Active projects", team: "Unlimited", studio: "Unlimited", shared: true },
  { label: "Shared workspaces", team: "1 workspace", studio: "Unlimited" },
  { label: "Guest reviewers", team: "5 per project", studio: "Unlimited" },
  { label: "Version history", team: "30 days", studio: "Unlimited" },
  { label: "Approval flows", team: "Not included", studio: "Included" },
  { label: "Custom roles", team: "Not included", studio: "Included" },
  { label: "Source exports", team: "Included", studio: "Included", shared: true },
  { label: "Support", team: "Email", studio: "Priority email" },
];

const pricing: Record<Plan, Record<Billing, number>> = {
  team: { monthly: 13, yearly: 10 },
  studio: { monthly: 27, yearly: 22 },
};

const s = {
  included: "inline-flex items-center gap-[6px] text-foreground",
  unavailable: "text-text-muted",
  srOnly: "absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]",
};

function Value({ text }: { text: string }) {
  if (text === "Included") return <span className={s.included}><Check className="text-success" size={16} strokeWidth={1.75} aria-hidden="true" />Included</span>;
  return <span className={text === "Not included" ? s.unavailable : undefined}>{text}</span>;
}

function AnimatedNumber({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    if (reduce) {
      previousValue.current = value;
      return;
    }

    const controls = animate(previousValue.current, value, {
      duration: motionTokens.duration.standard,
      ease: [...motionTokens.ease.enter],
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });

    previousValue.current = value;
    return () => controls.stop();
  }, [reduce, value]);

  return <>{reduce ? value : displayValue}</>;
}

export function PlanComparison() {
  const id = useId();
  const reduce = useReducedMotion();
  const [billing, setBilling] = useState<Billing>("monthly");
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [selected, setSelected] = useState<Plan | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState<"lg" | "md" | "sm" | "xs">("lg");
  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const measure = (width: number) => setSize(width <= 340 ? "xs" : width <= 540 ? "sm" : width <= 720 ? "md" : "lg");
    measure(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const visibleFeatures = differencesOnly ? features.filter((feature) => !feature.shared) : features;

  // Layout follows the block width (measured above), not the viewport: medium tightens gutters, narrow stacks each feature name above its two values.
  const medium = size !== "lg", narrow = size === "sm" || size === "xs", xs = size === "xs";
  const plans = ["team", "studio"] as const;
  const valueClass = (plan: Plan) => cn(
    "flex min-h-11 min-w-0 items-center border-l border-border px-5 py-[10px] text-text-secondary transition-[background-color,color] duration-240 ease-standard motion-reduce:transition-none",
    selected === plan && "bg-surface-muted text-foreground",
    medium && "px-[14px]",
    narrow && "min-h-0 border-l-0 px-[14px] pt-1 pb-[10px]",
    narrow && plan === "team" && "pl-5",
    narrow && plan === "studio" && "border-l border-border-subtle",
    xs && "px-3",
    xs && plan === "team" && "pl-4",
  );

  return (
    <section ref={rootRef} className={cn("mx-auto w-[min(100%,1060px)] min-w-0 overflow-hidden rounded-panel border border-border bg-surface font-body text-sm leading-body tracking-body text-foreground")} data-size={size} aria-labelledby={`${id}-title`}>
      <div className={cn("flex items-end justify-between gap-x-8 gap-y-4 px-8 pt-8 pb-6", medium && "flex-col items-start px-5 pt-6 pb-5", xs && "px-4")}>
        <div className="max-w-[560px] min-w-0"><h2 id={`${id}-title`} className={cn("m-0 font-display text-[length:var(--text-3xl)] leading-display font-normal tracking-display text-balance", narrow && "text-[length:var(--text-2xl)]")}>Room for the way you work</h2><p className="mt-2 mb-0 max-w-[46ch] text-pretty text-text-secondary">Only the details that change between plans. Switch billing to see what you would pay.</p></div>
        <div className={cn("grid flex-none justify-items-end gap-[6px]", medium && "justify-items-start")}><SegmentedControl label="Billing period" value={billing} onValueChange={(value) => setBilling(value as Billing)} options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} /><small className="min-h-4 text-xs leading-body text-text-muted tabular-nums">{billing === "yearly" ? "Billed yearly, save up to 23%" : "Billed month to month"}</small></div>
      </div>

      <div className={cn("flex min-h-[52px] items-center justify-between gap-x-4 gap-y-2 border-t border-border px-8 py-2 [&>button]:flex-none", medium && "px-5", narrow && "flex-wrap", xs && "px-4")}><div className="flex items-baseline gap-[10px]"><h3 className="m-0 text-sm leading-body font-medium">Compare plans</h3><span className="min-w-[11ch] text-xs leading-body text-text-muted tabular-nums"><AnimatedNumber value={visibleFeatures.length} /> of {features.length} features</span></div><Switch checked={differencesOnly} onCheckedChange={setDifferencesOnly} label="Show differences only" /></div>

      <div className="border-t border-border" role="table" aria-label="Team and Studio plan comparison">
        {/* Plan cells share three row tracks (name, price, button), so a description that wraps in one column keeps prices and buttons level. */}
        <div className={cn("grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] grid-rows-[auto_auto_auto]", narrow && "grid-cols-2")} role="row">
          <div className={cn("flex [grid-row:1/span_3] items-end pr-4 pb-5 pl-8 text-xs leading-body text-text-muted", medium && "pl-5", narrow && "hidden")} role="columnheader">What changes</div>
          {plans.map((plan) => (
            <div key={plan} className={cn(
              "relative grid [grid-row:span_3] min-w-0 grid-rows-subgrid content-start border-l border-border p-5 transition-colors duration-240 ease-standard motion-reduce:transition-none",
              medium && "px-[14px] py-4",
              narrow && "border-l-0",
              narrow && plan === "team" && "pl-5",
              narrow && plan === "studio" && "border-l border-border",
              xs && "px-3",
              xs && plan === "team" && "pl-4",
              selected === plan && "bg-surface-muted",
            )} role="columnheader" aria-label={`${plan === "team" ? "Team" : "Studio"} plan`}>
              <div><h3 className="m-0 text-base leading-body font-medium tracking-[-.01em]">{plan === "team" ? "Team" : "Studio"}</h3><span className="mt-[2px] block text-xs leading-body text-text-muted">{plan === "team" ? "For smaller teams" : "For work across teams"}</span></div>
              <div className="mt-4 mb-[14px] flex flex-wrap items-baseline gap-x-[6px] gap-y-[2px]"><span className={cn("inline-flex min-w-[3ch] font-display text-[length:var(--text-3xl)] leading-none font-normal tracking-display tabular-nums", narrow && "text-[length:var(--text-2xl)]")} aria-live="polite" aria-atomic="true">$<AnimatedNumber value={pricing[plan][billing]} /></span><span className="text-xs leading-body whitespace-nowrap text-text-muted">per seat / month</span></div>
              <Button type="button" variant={selected === plan ? "primary" : "secondary"} className="w-full" aria-pressed={selected === plan} onClick={() => setSelected(current => current === plan ? null : plan)}>{selected === plan ? "Selected" : `Select ${plan === "team" ? "Team" : "Studio"}`}</Button>
              {selected === plan && <motion.span className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" layoutId={`${id}-selected-rail`} transition={reduce ? { duration: 0 } : motionTokens.spring.responsive} aria-hidden="true" />}
            </div>
          ))}
        </div>

        <div className="border-t border-border" role="rowgroup">
          <AnimatePresence initial={false}>
            {visibleFeatures.map((feature) => (
              <motion.div key={feature.label} className={cn("group/feature grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] overflow-hidden border-b border-border-subtle last:border-b-0", narrow && "grid-cols-2")} role="row" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? undefined : { height: 0, opacity: 0, transition: { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } } }} transition={reduce ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], delay: .04 } }}>
                <div className={cn("flex min-h-11 min-w-0 items-center py-[10px] pr-5 pl-8 text-foreground", medium && "pl-5", narrow && "col-span-full min-h-0 px-5 pt-[10px] pb-0 text-xs text-text-secondary", xs && "px-4")} role="rowheader">{feature.label}</div>
                <div className={valueClass("team")} role="cell"><span className={s.srOnly}>Team</span><Value text={feature.team} /></div>
                <div className={valueClass("studio")} role="cell"><span className={s.srOnly}>Studio</span><Value text={feature.studio} /></div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className={cn("flex min-h-12 items-center justify-between gap-x-6 gap-y-2 border-t border-border px-8 py-3 text-xs leading-body text-text-muted", medium && "flex-col items-start px-5", xs && "px-4")}><span>Prices in USD per seat. Yearly plans are billed annually.</span><p className={cn(s.srOnly, "m-0")} role="status" aria-live="polite">{selected ? `${selected === "team" ? "Team" : "Studio"} selected` : ""}</p></div>
    </section>
  );
}

export default PlanComparison;
