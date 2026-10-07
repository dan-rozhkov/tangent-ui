"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Check, Minus } from "lucide-react";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { comparisonColumns, comparisonSections } from "@/components/ui/comparison-table-data";
import type { ComparisonColumn, ComparisonSection, ComparisonValue } from "@/components/ui/comparison-table-data";
import { useReducedMotion } from "@/lib/reduced-motion";

export type { ComparisonColumn, ComparisonRow, ComparisonSection, ComparisonValue } from "@/components/ui/comparison-table-data";

export interface ComparisonTableProps {
  title?: string;
  description?: string;
  columns?: ComparisonColumn[];
  sections?: ComparisonSection[];
  /** Hide rows where every visible column has the same value (controlled). */
  differencesOnly?: boolean;
  defaultDifferencesOnly?: boolean;
  onDifferencesOnlyChange?: (value: boolean) => void;
  /** Competitor shown beside yours in the stacked phone layout (controlled). */
  compareWith?: string;
  onCompareWithChange?: (id: string) => void;
  /** Call to action in your column. */
  cta?: { label: string; href?: string; onClick?: () => void; doneLabel?: string };
  /** Offset for the sticky header, such as the height of a fixed site header. Defaults to 0. */
  stickyTop?: number;
  /** Caps the table height and scrolls it inside the block, with the header sticking to its top. */
  maxHeight?: number | string;
  /** Width below which the table stacks into a two column comparison. Defaults to 640. */
  stackBelow?: number;
  className?: string;
}

/* The root is its own size container, so the table folds by the space it has rather than the viewport. */
const s = {
  root: "@container/compare w-full min-w-0 bg-background font-body tracking-body text-foreground",
  inner: "mx-auto grid max-w-[1080px] gap-8 px-6 py-16 @max-[641px]/compare:gap-6 @max-[641px]/compare:px-4 @max-[641px]/compare:py-12",
  srOnly: "absolute size-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]",
  header: "flex flex-wrap items-end justify-between gap-6",
  intro: "grid max-w-[560px] gap-3",
  title: "m-0 font-display text-[length:clamp(var(--text-2xl),1rem_+_3cqi,var(--text-4xl))] leading-display font-medium tracking-display text-balance",
  description: "m-0 text-base leading-body text-pretty text-text-secondary",
  toggle: "group/toggle relative inline-flex cursor-pointer items-center gap-3 text-sm leading-body font-medium select-none [-webkit-tap-highlight-color:transparent]",
  toggleInput: "absolute inset-0 m-0 cursor-pointer opacity-0",
  switch: "relative h-[22px] w-[38px] flex-none rounded-pill transition-colors duration-160 ease-standard",
  thumb: "absolute top-[2px] left-[2px] size-[18px] rounded-full shadow-[var(--control-thumb-shadow)] transition-[translate,background-color] [transition-duration:580ms,160ms] [transition-timing-function:var(--ease-spring),var(--ease-standard)] motion-reduce:transition-none",
  picker: "-mx-4 flex gap-[2px] overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  pick: "relative isolate h-9 flex-none cursor-pointer rounded-pill border-0 bg-transparent px-4 text-sm leading-body font-medium whitespace-nowrap [-webkit-tap-highlight-color:transparent] transition-colors duration-160 ease-standard motion-reduce:transition-none",
  pickHighlight: "absolute inset-0 -z-10 rounded-[inherit] bg-surface-muted",
  scroller: "relative overscroll-contain [scrollbar-width:thin]",
  table: "grid [--band:color-mix(in_oklab,var(--accent)_6%,var(--surface))] [--grid:minmax(0,1.7fr)_repeat(var(--columns),minmax(0,1fr))] @max-[821px]/compare:[--grid:minmax(0,1.4fr)_repeat(var(--columns),minmax(0,1fr))] @max-[641px]/compare:[--grid:minmax(0,1.3fr)_repeat(var(--columns),minmax(0,.9fr))]",
  head: "sticky top-[var(--sticky-top,0px)] z-[3] bg-[color-mix(in_oklab,var(--background)_94%,transparent)] backdrop-blur-[14px] backdrop-saturate-[1.4]",
  gridRow: "grid grid-cols-[var(--grid)]",
  headRow: "border-b border-border",
  headFeature: "min-h-[84px] @max-[641px]/compare:min-h-[72px]",
  headCell: "relative grid min-h-[84px] items-end justify-items-center overflow-hidden px-2 py-4 text-center @max-[641px]/compare:min-h-[72px]",
  headCellOwn: "rounded-t-[20px] bg-[color:var(--band)]",
  headText: "grid gap-[2px]",
  headName: "text-base leading-body font-medium",
  headNameOwn: "text-accent-strong dark:text-foreground",
  headCaption: "text-xs leading-body text-text-muted tabular-nums",
  section: "contents",
  sectionRow: "overflow-hidden",
  sectionTitle: "pt-8 pr-2 pb-2 pl-0 text-xs leading-body font-medium text-text-muted",
  band: "bg-[color:var(--band)]",
  row: "group/row overflow-hidden",
  rowChild: "border-b border-border-subtle transition-colors duration-160 ease-standard pointer-fine:group-hover/row:bg-[color-mix(in_oklab,var(--foreground)_2.5%,transparent)]",
  feature: "grid min-h-14 content-center gap-[2px] py-3 pr-4 pl-0 text-sm leading-body font-medium @max-[641px]/compare:pr-3",
  hint: "text-xs font-normal text-text-muted",
  cell: "relative grid place-items-center p-2 text-center",
  cellOwn: "bg-[color:var(--band)] pointer-fine:group-hover/row:bg-[color-mix(in_oklab,var(--accent)_9%,var(--surface))]",
  cellInner: "grid place-items-center",
  markWrap: "inline-grid justify-items-center gap-[2px]",
  check: "[&_circle]:[fill:color-mix(in_oklab,var(--foreground)_8%,transparent)] [&_path]:fill-none [&_path]:stroke-foreground [&_path]:[stroke-width:1.9] [&_path]:[stroke-linecap:round] [&_path]:[stroke-linejoin:round]",
  checkOwn: "[&_circle]:fill-control-on [&_path]:fill-none [&_path]:stroke-control-glyph [&_path]:[stroke-width:1.9] [&_path]:[stroke-linecap:round] [&_path]:[stroke-linejoin:round]",
  checkLegend: "[&_circle]:[fill:color-mix(in_oklab,var(--foreground)_8%,transparent)] [&_path]:fill-none [&_path]:stroke-foreground [&_path]:[stroke-width:2.2] [&_path]:[stroke-linecap:round] [&_path]:[stroke-linejoin:round]",
  partial: "[&_circle]:fill-none [&_circle]:stroke-text-muted [&_circle]:[stroke-width:1.5] [&_path]:fill-text-muted",
  cross: "text-text-muted opacity-70",
  note: "max-w-[12ch] text-xs leading-body text-text-muted",
  text: "text-sm leading-body font-medium tabular-nums",
  footRow: "[&>*]:pt-5",
  footCell: "grid place-items-center pb-5",
  footCellOwn: "rounded-b-[20px] bg-[color:var(--band)]",
  legend: "flex flex-wrap content-start gap-x-4 gap-y-2 pr-4 text-xs text-text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[6px] @max-[641px]/compare:flex-col",
  cta: "inline-flex h-control-sm max-w-[calc(100%_-_var(--space-2))] cursor-pointer items-center justify-center overflow-hidden rounded-pill border-0 bg-foreground px-4 text-sm leading-body font-medium whitespace-nowrap text-background no-underline [-webkit-tap-highlight-color:transparent] transition-[background-color,color] duration-240 ease-standard data-[done]:bg-[color-mix(in_oklab,var(--success)_14%,transparent)] data-[done]:text-success",
  ctaLink: "transition-transform duration-120 active:scale-[.97]",
  ctaLabel: "inline-flex items-center gap-[6px]",
};

const snappy = motionTokens.spring.snappy;
const smooth = motionTokens.spring.smooth;
const morph = motionTokens.spring.morph;

function useControllable<T>(value: T | undefined, initial: T, onChange?: (next: T) => void) {
  const [inner, setInner] = useState(initial);
  const current = value !== undefined ? value : inner;
  const set = (next: T) => { if (value === undefined) setInner(next); onChange?.(next); };
  return [current, set] as const;
}

function normalize(value: ComparisonValue | undefined) {
  if (value === undefined) return { value: false as const, note: undefined };
  if (typeof value === "object") return value;
  return { value, note: undefined };
}
const keyOf = (value: ComparisonValue | undefined) => { const item = normalize(value); return `${item.value}`; };

function Mark({ value, own, index, reduced }: { value: ComparisonValue | undefined; own: boolean; index: number; reduced: boolean }) {
  const { value: v, note } = normalize(value);
  if (typeof v === "string" && v !== "partial") return <span className={cn(s.text, own ? "text-foreground" : "font-normal text-text-secondary")}>{v}</span>;
  if (v === true) return <span className={s.markWrap}>
    <svg className={own ? s.checkOwn : s.check} data-own={own || undefined} width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10" />
      <motion.path d="M6.6 11.3l3 3 5.9-6.4" initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 1 }} transition={{ duration: motionTokens.duration.considered, ease: [...motionTokens.ease.enter], delay: own ? .06 + Math.min(index, 12) * .035 : 0 }} />
    </svg>
    <span className={s.srOnly}>Included</span>
  </span>;
  if (v === "partial") return <span className={s.markWrap}>
    <svg className={s.partial} width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9.25" /><path d="M11 1.75a9.25 9.25 0 0 1 0 18.5z" /></svg>
    <span className={s.srOnly}>Partial</span>
    {note && <span className={s.note}>{note}</span>}
  </span>;
  return <span className={s.markWrap}><Minus className={s.cross} size={18} strokeWidth={1.75} aria-hidden="true" /><span className={s.srOnly}>Not included</span></span>;
}

export function ComparisonTable({
  title = "How Relay compares",
  description = "Everything a growing team needs, without the enterprise price or the spreadsheet sprawl.",
  columns = comparisonColumns,
  sections = comparisonSections,
  differencesOnly: differencesProp,
  defaultDifferencesOnly = false,
  onDifferencesOnlyChange,
  compareWith: compareProp,
  onCompareWithChange,
  cta,
  stickyTop = 0,
  maxHeight,
  stackBelow = 640,
  className,
}: ComparisonTableProps) {
  const reduced = Boolean(useReducedMotion());
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [differencesOnly, setDifferencesOnly] = useControllable(differencesProp, defaultDifferencesOnly, onDifferencesOnlyChange);
  const own = columns.find(column => column.highlight) ?? columns[0];
  const others = columns.filter(column => column !== own);
  const [compareWith, setCompareWith] = useControllable(compareProp, others[0]?.id ?? own.id, onCompareWithChange);
  const [ctaDone, setCtaDone] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < stackBelow));
    observer.observe(node);
    return () => observer.disconnect();
  }, [stackBelow]);

  const visible = narrow ? columns.filter(column => column === own || column.id === compareWith) : columns;
  const differs = (values: Record<string, ComparisonValue>) => new Set(visible.map(column => keyOf(values[column.id]))).size > 1;
  const gridStyle = { "--columns": visible.length, "--sticky-top": `${stickyTop}px` } as CSSProperties;
  let rowIndex = 0;

  const header = <div role="row" className={cn(s.gridRow, s.headRow)}>
    <div role="columnheader" className={s.headFeature}><span className={s.srOnly}>Feature</span></div>
    {visible.map(column => <div key={column === own ? "own" : narrow ? "other" : column.id} role="columnheader" className={cn(s.headCell, column === own && s.headCellOwn)} data-own={column === own || undefined}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={column.id} className={s.headText} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }} transition={smooth}>
          <span className={cn(s.headName, column === own && s.headNameOwn)}>{column.name}</span>
          {column.caption && <span className={s.headCaption}>{column.caption}</span>}
        </motion.span>
      </AnimatePresence>
    </div>)}
  </div>;

  return <section ref={rootRef} className={cn(s.root, className)} aria-labelledby={`${uid}-title`} data-narrow={narrow || undefined}>
    <div className={s.inner}>
      <header className={s.header}>
        <div className={s.intro}>
          <h2 id={`${uid}-title`} className={s.title}>{title}</h2>
          {description && <p className={s.description}>{description}</p>}
        </div>
        <label className={cn(s.toggle, differencesOnly ? "text-foreground" : "text-text-secondary")}>
          <span>Only differences</span>
          <input className={s.toggleInput} type="checkbox" role="switch" checked={differencesOnly} onChange={event => setDifferencesOnly(event.target.checked)} />
          <span className={cn(s.switch, differencesOnly ? "bg-control-on" : "bg-control-track pointer-fine:group-hover/toggle:bg-control-track-hover")} aria-hidden="true"><span className={cn(s.thumb, differencesOnly ? "translate-x-4 bg-control-thumb-on" : "bg-control-thumb")} /></span>
        </label>
      </header>

      {narrow && others.length > 1 && <div className={s.picker} role="group" aria-label={`Compare ${own.name} with`}>
        <LayoutGroup id={`${uid}-picker`}>
          {others.map(column => <button key={column.id} type="button" className={cn(s.pick, column.id === compareWith ? "text-foreground" : "text-text-secondary")} aria-pressed={column.id === compareWith} onClick={() => setCompareWith(column.id)}>
            {column.id === compareWith && <motion.span layoutId="pick" className={s.pickHighlight} transition={reduced ? { duration: 0 } : morph} />}
            <span>{column.name}</span>
          </button>)}
        </LayoutGroup>
      </div>}

      <div className={s.scroller} style={maxHeight !== undefined ? { maxHeight, overflowY: "auto" } : undefined} tabIndex={maxHeight !== undefined ? 0 : undefined} aria-label={maxHeight !== undefined ? title : undefined} role={maxHeight !== undefined ? "region" : undefined}>
        <div role="table" aria-labelledby={`${uid}-title`} className={s.table} style={gridStyle}>
          <div role="rowgroup" className={s.head}>{header}</div>
          {sections.map(section => {
            const rows = differencesOnly ? section.rows.filter(row => differs(row.values)) : section.rows;
            return <div role="rowgroup" key={section.id} className={s.section}>
              <AnimatePresence initial={false}>
                {rows.length > 0 && <motion.div key="title" role="row" className={cn(s.gridRow, s.sectionRow)} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : smooth}>
                  <div role="rowheader" className={s.sectionTitle}>{section.title}</div>
                  {visible.map(column => <div key={column.id} role="cell" className={cn(column === own && s.band)} data-own={column === own || undefined} />)}
                </motion.div>}
                {rows.map(row => {
                  const index = rowIndex++;
                  return <motion.div key={row.id} role="row" className={cn(s.gridRow, s.row)} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : smooth}>
                    <div role="rowheader" className={cn(s.feature, s.rowChild)}>
                      <span>{row.feature}</span>
                      {row.hint && <span className={s.hint}>{row.hint}</span>}
                    </div>
                    {visible.map(column => <div key={column === own ? "own" : narrow ? "other" : column.id} role="cell" className={cn(s.cell, s.rowChild, column === own && s.cellOwn)} data-own={column === own || undefined}>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span key={`${column.id}`} className={s.cellInner} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .8 }} transition={snappy}>
                          <Mark value={row.values[column.id]} own={column === own} index={index} reduced={reduced} />
                        </motion.span>
                      </AnimatePresence>
                    </div>)}
                  </motion.div>;
                })}
              </AnimatePresence>
            </div>;
          })}
          <div role="rowgroup">
            <div role="row" className={cn(s.gridRow, s.footRow)}>
              <div role="cell" className={s.legend}>
                <span><svg className={s.checkLegend} width="16" height="16" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="10" /><path d="M6.6 11.3l3 3 5.9-6.4" /></svg>Included</span>
                <span><svg className={s.partial} width="16" height="16" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9.25" /><path d="M11 1.75a9.25 9.25 0 0 1 0 18.5z" /></svg>Partial</span>
                <span><Minus className={s.cross} size={14} strokeWidth={1.75} aria-hidden="true" />Not included</span>
              </div>
              {visible.map(column => <div key={column.id} role="cell" className={cn(s.footCell, column === own && s.footCellOwn)} data-own={column === own || undefined}>
                {column === own && cta && (cta.href && !cta.onClick
                  ? <a className={cn(s.cta, s.ctaLink)} href={cta.href}>{cta.label}</a>
                  : <motion.button type="button" layout={!reduced} className={s.cta} style={{ borderRadius: 9999 }} data-done={ctaDone || undefined} whileTap={reduced ? undefined : { scale: .97 }} transition={morph} onClick={() => { cta.onClick?.(); if (cta.doneLabel) setCtaDone(true); }}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={ctaDone ? "done" : "idle"} layout={reduced ? false : "position"} className={s.ctaLabel} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }} transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] }}>
                        {ctaDone ? <><Check size={14} strokeWidth={2} aria-hidden="true" />{cta.doneLabel}</> : cta.label}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>)}
              </div>)}
            </div>
          </div>
        </div>
      </div>
      <p className={s.srOnly} aria-live="polite">{differencesOnly ? "Showing only rows that differ" : "Showing all rows"}</p>
    </div>
  </section>;
}

/** Preview: the comparison inside a capped height so the sticky header shows. */
export function ComparisonTableBlock() {
  return <ComparisonTable maxHeight="min(760px, 82vh)" cta={{ label: "Start free trial", doneLabel: "Trial started" }} />;
}

export default ComparisonTableBlock;
