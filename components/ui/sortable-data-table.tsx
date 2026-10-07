"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, RefObject } from "react";
import { ArrowUp } from "@mynaui/icons-react";
import { AnimatePresence, animate, motion, useMotionValue, type Transition, type Variants } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

export type SortDirection = "asc" | "desc";
export type SortState = { key: string; direction: SortDirection };

export type DataColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
  /** Right-aligns the column with tabular numerals. Detected when every value is a number. */
  numeric?: boolean;
  /** Fixed width such as 120 or "20%". Other columns are measured once and held, so sorting never reflows them. */
  width?: number | string;
};

export type SortableDataTableProps<T extends Record<string, unknown>> = {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: keyof T | ((row: T) => string);
  caption?: string;
  emptyMessage?: string;
  /** Sort applied on the first render. */
  defaultSort?: SortState;
  onSortChange?: (sort: SortState) => void;
  /** Adds a checkbox column, row click selection, and a count line with a clear action. */
  selectable?: boolean;
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  /** Noun for the count line, as in "6 projects". */
  itemName?: { one: string; other: string };
};


/* Cells are opaque so rows passing each other during a sort cover one another cleanly instead of blending text.
   Below 620px the table folds: the header becomes a strip of sort controls and each row becomes two lines. */
const wrapperClass = "relative w-full max-w-full min-w-0 overflow-hidden rounded-control border border-border bg-surface font-sans text-foreground [--column-tint:var(--surface-muted)]";
const scrollerClass = "relative overflow-x-auto overscroll-x-contain max-[620px]:overflow-visible";
const bandClass = "pointer-events-none absolute top-0 bottom-0 bg-(--column-tint) max-[620px]:hidden";
const tableClass = "relative z-1 w-full min-w-[560px] border-separate border-spacing-0 text-left text-sm leading-body tracking-body data-[fixed]:table-fixed max-[620px]:block max-[620px]:w-full max-[620px]:max-w-full max-[620px]:min-w-0";
/* The header strip scrolls sideways; its pinned select-all cell fades whatever slides under it once the strip has scrolled. */
const headRowClass = "max-[620px]:flex max-[620px]:items-center max-[620px]:gap-1 max-[620px]:overflow-x-auto max-[620px]:border-b max-[620px]:border-border max-[620px]:px-2 max-[620px]:py-1 max-[620px]:[scrollbar-width:none] max-[620px]:[&::-webkit-scrollbar]:hidden";
const bodyClass = "max-[620px]:block max-[620px]:w-full";

const cellClass = "bg-(--cell-fill) transition-[background-color,color] duration-240 ease-standard [--cell-base:var(--surface)] [--cell-fill:var(--cell-base)] data-[numeric]:text-right data-[numeric]:tabular-nums data-[sorted]:[--cell-base:var(--column-tint)] motion-reduce:transition-none!";
const thClass = cn(cellClass, "group/th h-11 border-b border-border px-4 text-left text-sm font-medium whitespace-nowrap text-text-muted data-[sorted]:text-foreground data-[sortable]:p-0", "max-[620px]:block max-[620px]:h-auto max-[620px]:flex-none max-[620px]:border-0 max-[620px]:bg-transparent max-[620px]:p-0");
const tdClass = cn(
  cellClass,
  "h-13 border-b border-border-subtle px-4 align-middle font-normal text-foreground [overflow-wrap:anywhere] [tr:last-child>&]:border-b-0",
  "pointer-fine:[tr:not([data-selected]):hover>&]:[--cell-fill:color-mix(in_oklab,var(--foreground)_3%,var(--cell-base))] [tr[data-selected]>&]:[--cell-fill:color-mix(in_oklab,var(--accent)_8%,var(--cell-base))] pointer-fine:[tr[data-selected]:hover>&]:[--cell-fill:color-mix(in_oklab,var(--accent)_11%,var(--cell-base))]",
  "max-[620px]:order-2 max-[620px]:block max-[620px]:h-auto max-[620px]:min-w-0 max-[620px]:border-0 max-[620px]:bg-transparent max-[620px]:p-0 max-[620px]:text-left max-[620px]:text-xs max-[620px]:text-text-secondary max-[620px]:data-[primary]:order-0 max-[620px]:data-[primary]:flex-[1_1_0] max-[620px]:data-[primary]:text-sm max-[620px]:data-[primary]:font-medium max-[620px]:data-[primary]:text-foreground max-[620px]:data-[numeric]:not-data-[primary]:order-0 max-[620px]:data-[numeric]:not-data-[primary]:flex-none max-[620px]:data-[numeric]:not-data-[primary]:ml-auto max-[620px]:data-[numeric]:not-data-[primary]:pl-2 max-[620px]:data-[numeric]:not-data-[primary]:text-sm max-[620px]:data-[numeric]:not-data-[primary]:text-foreground max-[620px]:data-[numeric]:[td[data-numeric]~&]:order-2 max-[620px]:data-[numeric]:[td[data-numeric]~&]:ml-0 max-[620px]:data-[numeric]:[td[data-numeric]~&]:pl-0 max-[620px]:data-[numeric]:[td[data-numeric]~&]:text-xs max-[620px]:data-[numeric]:[td[data-numeric]~&]:text-text-secondary max-[620px]:data-[sorted]:not-data-[primary]:text-foreground",
);
const selectCellClass = "w-11 py-0 pr-0 pl-4 max-[620px]:sticky max-[620px]:z-1 max-[620px]:ml-[calc(-1*var(--space-2))] max-[620px]:left-[calc(-1*var(--space-2))] max-[620px]:w-10 max-[620px]:pl-3 max-[620px]:bg-surface max-[620px]:after:absolute max-[620px]:after:top-0 max-[620px]:after:bottom-0 max-[620px]:after:left-full max-[620px]:after:w-9 max-[620px]:after:bg-[linear-gradient(to_right,var(--surface)_45%,transparent)] max-[620px]:after:opacity-0 max-[620px]:after:pointer-events-none max-[620px]:after:content-[''] max-[620px]:supports-[animation-timeline:scroll()]:after:animate-in max-[620px]:supports-[animation-timeline:scroll()]:after:opacity-100 max-[620px]:supports-[animation-timeline:scroll()]:after:[--tw-enter-opacity:0] max-[620px]:supports-[animation-timeline:scroll()]:after:[animation-fill-mode:both] max-[620px]:supports-[animation-timeline:scroll()]:after:[animation-range:0_24px] max-[620px]:supports-[animation-timeline:scroll()]:after:[animation-timeline:scroll(nearest_inline)] max-[620px]:supports-[animation-timeline:scroll()]:after:[animation-timing-function:linear]";
/* The empty row keeps its base fill on hover, so it never reads as a selectable row. */
const emptyCellClass = "h-[120px]! text-center! text-text-muted! max-[620px]:h-auto! max-[620px]:flex-[1_0_100%] max-[620px]:px-0 max-[620px]:py-6";
const rowClass = "max-[620px]:relative max-[620px]:box-border max-[620px]:flex max-[620px]:min-h-16 max-[620px]:w-full max-[620px]:flex-wrap max-[620px]:content-center max-[620px]:items-baseline max-[620px]:gap-x-2 max-[620px]:gap-y-0.5 max-[620px]:border-b max-[620px]:border-border-subtle max-[620px]:bg-(--row-fill) max-[620px]:px-4 max-[620px]:py-2.5 max-[620px]:[--row-fill:var(--surface)] max-[620px]:transition-[background-color] max-[620px]:duration-240 max-[620px]:ease-standard max-[620px]:last:border-b-0 max-[620px]:after:order-1 max-[620px]:after:basis-full max-[620px]:after:content-[''] motion-reduce:transition-none!";
const sortButtonClass = "group/sort flex h-11 w-full cursor-pointer items-center justify-start border-0 bg-transparent px-4 tracking-[inherit] text-inherit [-webkit-tap-highlight-color:transparent] group-data-[numeric]/th:justify-end max-[620px]:h-8 max-[620px]:w-auto max-[620px]:rounded-control max-[620px]:px-2.5 max-[620px]:transition-[background-color,color] max-[620px]:duration-240 max-[620px]:ease-standard max-[620px]:group-data-[sorted]/th:bg-surface-muted motion-reduce:transition-none!";
/* Right-aligned columns lead with the arrow so the label lines up with the digits below it. */
const sortInnerClass = "inline-flex items-center gap-1.5 rounded-control transition-[color] duration-160 ease-standard group-data-[numeric]/th:flex-row-reverse pointer-fine:group-hover/sort:text-foreground max-[620px]:group-data-[numeric]/th:flex-row motion-reduce:transition-none!";
const footerClass = "flex h-11 items-center justify-between gap-3 border-t border-border py-0 pr-2 pl-4 text-sm leading-body tracking-body text-text-muted";
const countClass = "inline-flex min-w-0 items-baseline gap-[.28em] whitespace-nowrap transition-[color] duration-240 ease-standard data-[active]:text-foreground motion-reduce:transition-none!";
const clearClass = "h-[30px] flex-none cursor-pointer rounded-control border-0 bg-transparent px-3 font-medium tracking-[inherit] text-foreground transition-[background-color] duration-160 ease-standard [-webkit-tap-highlight-color:transparent] pointer-fine:hover:bg-surface-muted motion-reduce:transition-none!";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const isEmpty = (value: unknown) => value == null || value === "";
const comparable = (value: unknown) => value instanceof Date ? value.getTime() : value;
const blur = (px: number) => `blur(${px}px)`;
const enter: Transition = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] };
const leave: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
const instant: Transition = { duration: motionTokens.duration.instant };
/** Changing text rises in from the side it is moving toward and lifts away on the other. */
const rise: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${.3 * direction}em`, filter: blur(motionTokens.blur.soft) }),
  shown: { opacity: 1, y: "0em", filter: blur(0), transition: enter },
  gone: (direction: number) => ({ opacity: 0, y: `${-.3 * direction}em`, filter: blur(motionTokens.blur.subtle), transition: leave }),
};
/** Reduced motion keeps the same properties as rise (no travel, no blur) so the server and a reduced-motion client render identical styles. */
const fade: Variants = { enter: { opacity: 0, y: "0em", filter: blur(0) }, shown: { opacity: 1, y: "0em", filter: blur(0), transition: instant }, gone: { opacity: 0, y: "0em", filter: blur(0), transition: instant } };
/** Check and dash share three points, so the header box morphs between all and some. */
const checkPath = "M4.25 9.25 L7.25 12.25 L13.75 5.75";
const dashPath = "M4.75 9 L9 9 L13.25 9";

/** Text that changes in place. The slot eases to the new width, so the words beside it never jump. */
function Swap({ value, direction, reduced, className }: { value: string; direction: number; reduced: boolean; className?: string }) {
  const inner = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | string>("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    let settled = false;
    const measure = () => {
      const next = node.getBoundingClientRect().width;
      if (settled && !reduced) animate(width, next, motionTokens.spring.morph); else width.jump(next);
      settled = true;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, width]);
  return <motion.span className={cn("inline-block", className)} style={{ width }}>
    <span ref={inner} className="relative inline-flex w-max">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span key={value} className="inline-block whitespace-nowrap" custom={direction} variants={reduced ? fade : rise} initial="enter" animate="shown" exit="gone">{value}</motion.span>
      </AnimatePresence>
    </span>
  </motion.span>;
}

/** The arrow fades in where a column becomes sorted and flips on a spring when the direction changes. */
function SortGlyph({ active, descending, reduced }: { active: boolean; descending: boolean; reduced: boolean }) {
  const rotate = useMotionValue(descending ? 180 : 0);
  const seen = useRef({ active, hiddenAt: -Infinity });
  useLayoutEffect(() => {
    const state = seen.current;
    if (active) {
      // Turn only while the arrow is visible; a freshly shown arrow starts pointing the right way.
      const visible = state.active || performance.now() - state.hiddenAt < 160;
      if (visible && !reduced) animate(rotate, descending ? 180 : 0, motionTokens.spring.snappy);
      else rotate.jump(descending ? 180 : 0);
    } else if (state.active) state.hiddenAt = performance.now();
    state.active = active;
  }, [active, descending, reduced, rotate]);
  const transition: Transition = reduced ? instant : active ? { opacity: enter, filter: enter, scale: motionTokens.spring.snappy } : { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] };
  return <span className="relative grid size-4 flex-none place-items-center" aria-hidden="true">
    <ArrowUp className={cn("absolute inset-0 grid place-items-center text-text-muted opacity-0 transition-[opacity] duration-160 ease-standard motion-reduce:transition-none!", !active && "group-focus-visible/sort:opacity-60 pointer-fine:group-hover/sort:opacity-60")} size={16} strokeWidth={1.75} />
    <motion.span className="absolute inset-0 grid place-items-center text-foreground" style={{ rotate }} initial={false} animate={active ? { opacity: 1, scale: 1, filter: blur(0) } : { opacity: 0, scale: .6, filter: blur(motionTokens.blur.subtle) }} transition={transition}><ArrowUp size={16} strokeWidth={1.75} /></motion.span>
  </span>;
}

function SelectBox({ checked, mixed = false, label, nav, reduced, onToggle, inputRef }: { checked: boolean; mixed?: boolean; label: string; nav: "head" | "row"; reduced: boolean; onToggle: (extend: boolean) => void; inputRef?: RefObject<HTMLInputElement | null> }) {
  const local = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? local;
  const on = checked || mixed;
  useLayoutEffect(() => { if (ref.current) ref.current.indeterminate = mixed; }, [mixed, ref]);
  const opacity: Transition = { duration: on ? motionTokens.duration.instant : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
  return <label className={cn("group/hit relative flex h-11 w-full cursor-pointer items-center", nav === "head" ? "max-[620px]:h-8" : "max-[620px]:justify-center")}>
    <input ref={ref} type="checkbox" className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0" checked={checked} aria-label={label} data-nav={nav} onChange={event => onToggle((event.nativeEvent as MouseEvent).shiftKey === true)} />
    <span className="pointer-events-none relative block size-[18px] flex-none rounded-[5px] border border-border-strong bg-surface text-control-glyph [transition:border-color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)] peer-active:[transform:scale(.95)] peer-active:[transition:border-color_var(--duration-fast)_var(--ease-standard),transform_110ms_var(--ease-standard)] data-[on]:border-control-on pointer-fine:group-hover/hit:not-data-[on]:border-text-muted motion-reduce:transition-none! motion-reduce:peer-active:[transform:none]" data-on={on || undefined} aria-hidden="true">
      <motion.span className="absolute -inset-px rounded-[inherit] bg-control-on" initial={false} animate={{ opacity: on ? 1 : 0, scale: on ? 1 : .6 }} transition={reduced ? { duration: 0 } : { scale: motionTokens.spring.snappy, opacity }} />
      <svg className="absolute -inset-px size-[18px] overflow-visible" viewBox="0 0 18 18" fill="none" focusable="false">
        <motion.path initial={false} animate={{ d: mixed ? dashPath : checkPath, pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={reduced ? { duration: 0 } : { d: motionTokens.spring.morph, pathLength: motionTokens.spring.snappy, opacity }} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  </label>;
}

export function SortableDataTable<T extends Record<string, unknown>>({ rows, columns, rowKey, caption = "Data table", emptyMessage = "No rows to show", defaultSort, onSortChange, selectable = false, selectedKeys, defaultSelectedKeys, onSelectionChange, itemName = { one: "row", other: "rows" } }: SortableDataTableProps<T>) {
  const reduced = useReducedMotion() ?? false;
  const tableRef = useRef<HTMLTableElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const anchor = useRef<string | null>(null);
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);
  const [announcement, setAnnouncement] = useState("");
  const [internalSelection, setInternalSelection] = useState<string[]>(defaultSelectedKeys ?? []);
  const selection = useMemo(() => new Set(selectedKeys ?? internalSelection), [internalSelection, selectedKeys]);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return rows.map((row, index) => ({ row, index })).sort((a, b) => {
      const left = comparable(a.row[sort.key]);
      const right = comparable(b.row[sort.key]);
      // Empty values stay at the bottom in both directions.
      if (isEmpty(left) || isEmpty(right)) return isEmpty(left) === isEmpty(right) ? a.index - b.index : isEmpty(left) ? 1 : -1;
      const result = typeof left === "number" && typeof right === "number" ? left - right : collator.compare(String(left), String(right));
      return (sort.direction === "asc" ? result : -result) || a.index - b.index;
    }).map(entry => entry.row);
  }, [rows, sort]);

  const numeric = useMemo(() => new Set(columns.filter(column => column.numeric ?? (rows.some(row => typeof row[column.key] === "number") && rows.every(row => typeof row[column.key] === "number" || isEmpty(row[column.key])))).map(column => column.key)), [columns, rows]);
  const getRowKey = (row: T) => String(typeof rowKey === "function" ? rowKey(row) : row[rowKey]);
  const keys = sortedRows.map(getRowKey);
  const order = keys.join("\u0000");
  const selectedCount = keys.filter(key => selection.has(key)).length;
  const allSelected = keys.length > 0 && selectedCount === keys.length;

  // Measure the natural column widths once, then hold them with a fixed layout so nothing reflows while rows move.
  const signature = [selectable ? "select" : "", ...columns.map(column => column.key)].join("\u0000");
  const [locked, setLocked] = useState<{ signature: string; widths: Record<string, number> } | null>(null);
  const widths = locked?.signature === signature ? locked.widths : null;
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || widths) return;
    const measure = () => {
      const total = table.getBoundingClientRect().width;
      if (!total || getComputedStyle(table).display !== "table") return false;
      const next: Record<string, number> = {};
      table.querySelectorAll<HTMLElement>("thead th[data-key]").forEach(cell => { next[cell.dataset.key ?? ""] = cell.getBoundingClientRect().width / total * 100; });
      setLocked({ signature, widths: next });
      return true;
    };
    if (measure()) return;
    const observer = new ResizeObserver(() => { if (measure()) observer.disconnect(); });
    observer.observe(table);
    return () => observer.disconnect();
  }, [signature, widths]);

  // A still tint under the sorted column fills the gaps that open while rows pass each other.
  const [band, setBand] = useState<{ left: number; width: number } | null>(null);
  const seenSort = useRef(false);
  useLayoutEffect(() => {
    const table = tableRef.current;
    const key = sort?.key;
    const update = () => {
      const cell = key ? table?.querySelector<HTMLElement>(`thead th[data-key="${CSS.escape(key)}"]`) : null;
      setBand(current => !cell ? null : current?.left === cell.offsetLeft && current.width === cell.offsetWidth ? current : { left: cell.offsetLeft, width: cell.offsetWidth });
    };
    update();
    if (!table || !key) return;
    // On a phone the header is a scrolling strip of sort controls; keep the active one in view.
    const cell = table.querySelector<HTMLElement>(`thead th[data-key="${CSS.escape(key)}"]`);
    const strip = cell?.parentElement;
    if (cell && strip && strip.scrollWidth > strip.clientWidth && getComputedStyle(table).display !== "table") {
      const bounds = strip.getBoundingClientRect(), target = cell.getBoundingClientRect(), inset = 8;
      const start = Math.max(bounds.left, strip.querySelector("th:not([data-key])")?.getBoundingClientRect().right ?? bounds.left) + inset;
      const shift = target.right > bounds.right - inset ? target.right - bounds.right + inset : target.left < start ? target.left - start : 0;
      if (shift) strip.scrollTo({ left: strip.scrollLeft + shift, behavior: reduced || !seenSort.current ? "auto" : "smooth" });
    }
    seenSort.current = true;
    const observer = new ResizeObserver(update);
    observer.observe(table);
    return () => observer.disconnect();
  }, [reduced, sort?.key, widths]);

  const shownCount = selectedCount || keys.length;
  const noun = selectedCount ? "selected" : keys.length === 1 ? itemName.one : itemName.other;
  const [lastCount, setLastCount] = useState(shownCount);
  const [countDirection, setCountDirection] = useState(1);
  if (shownCount !== lastCount) { setLastCount(shownCount); setCountDirection(shownCount > lastCount ? 1 : -1); }

  function sortBy(column: DataColumn<T>) {
    const next: SortState = { key: column.key, direction: sort?.key === column.key && sort.direction === "asc" ? "desc" : "asc" };
    setSort(next);
    onSortChange?.(next);
    setAnnouncement(`Sorted by ${column.label}, ${next.direction === "asc" ? "ascending" : "descending"}`);
  }

  function commit(next: Set<string>) {
    const list = keys.filter(key => next.has(key));
    if (selectedKeys === undefined) setInternalSelection(list);
    onSelectionChange?.(list);
    setAnnouncement(list.length ? `${list.length} of ${keys.length} selected` : "Selection cleared");
  }

  function toggleRow(key: string, extend: boolean) {
    const next = new Set(selection);
    const checked = !selection.has(key);
    const from = extend && anchor.current ? keys.indexOf(anchor.current) : -1;
    const to = keys.indexOf(key);
    (from < 0 ? [key] : keys.slice(Math.min(from, to), Math.max(from, to) + 1)).forEach(item => checked ? next.add(item) : next.delete(item));
    anchor.current = key;
    commit(next);
  }

  function clearSelection() {
    commit(new Set());
    selectAllRef.current?.focus();
  }

  function onRowClick(event: ReactMouseEvent<HTMLTableRowElement>, key: string) {
    if (!selectable || (event.target as HTMLElement).closest("a, button, input, label, select, textarea, [role='button'], [contenteditable='true']") || window.getSelection()?.toString()) return;
    toggleRow(key, event.shiftKey);
    // Keep the keyboard path where the pointer left off, so arrows continue from this row.
    event.currentTarget.querySelector<HTMLInputElement>("input[type='checkbox']")?.focus({ preventScroll: true });
  }

  /** Arrows walk the header controls and the row checkboxes; Escape clears the selection. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.key === "Escape" && selectedCount) {
      event.preventDefault();
      event.stopPropagation();
      if (target.dataset.clear !== undefined) clearSelection(); else commit(new Set());
      return;
    }
    const nav = target.dataset.nav;
    if (!nav) return;
    const list = (name: string) => [...event.currentTarget.querySelectorAll<HTMLElement>(`[data-nav="${name}"]`)];
    const items = list(nav);
    const index = items.indexOf(target);
    const steps: Record<string, [HTMLElement[], number]> = nav === "head"
      ? { ArrowRight: [items, index + 1], ArrowLeft: [items, index - 1], Home: [items, 0], End: [items, items.length - 1], ...(target === selectAllRef.current ? { ArrowDown: [list("row"), 0] } : {}) }
      : { ArrowDown: [items, index + 1], ArrowUp: index === 0 && selectAllRef.current ? [[selectAllRef.current], 0] : [items, index - 1], Home: [items, 0], End: [items, items.length - 1] };
    const step = steps[event.key];
    const next = step?.[0][step[1]];
    if (!next) return;
    event.preventDefault();
    next.focus();
  }

  return <div className={wrapperClass} onKeyDown={onKeyDown}>
    <div className={scrollerClass}>
      {band ? <span className={bandClass} style={{ left: band.left, width: band.width }} aria-hidden="true" /> : null}
      <table ref={tableRef} role="table" className={tableClass} data-fixed={widths ? "" : undefined} data-selectable={selectable || undefined}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {selectable ? <col className="w-11" /> : null}
          {columns.map((column, index) => <col key={column.key} style={{ width: column.width !== undefined ? (typeof column.width === "number" ? `${column.width}px` : column.width) : widths && index > 0 ? `${widths[column.key]}%` : undefined }} />)}
        </colgroup>
        <thead role="rowgroup" className="max-[620px]:block"><tr role="row" className={headRowClass}>
          {selectable ? <th scope="col" role="columnheader" className={cn(thClass, selectCellClass)}><SelectBox inputRef={selectAllRef} checked={allSelected} mixed={selectedCount > 0 && !allSelected} label="Select all rows" nav="head" reduced={reduced} onToggle={() => commit(allSelected ? new Set() : new Set(keys))} /></th> : null}
          {columns.map((column, index) => {
            const active = sort?.key === column.key;
            const sortable = column.sortable !== false;
            return <th key={column.key} scope="col" role="columnheader" className={cn(thClass, selectable && index === 0 && !sortable && "pl-2")} data-key={column.key} data-primary={index === 0 || undefined} data-sorted={active || undefined} data-numeric={numeric.has(column.key) || undefined} data-sortable={sortable || undefined} aria-sort={!sortable ? undefined : active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
              {sortable ? <button className={cn(sortButtonClass, selectable && index === 0 && "pl-2")} type="button" data-nav="head" onClick={() => sortBy(column)} aria-label={`Sort by ${column.label}${active ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}>
                <span className={sortInnerClass}><span>{column.label}</span><SortGlyph active={active} descending={active && sort.direction === "desc"} reduced={reduced} /></span>
              </button> : column.label}
            </th>;
          })}
        </tr></thead>
        <tbody role="rowgroup" className={bodyClass}>{sortedRows.length ? sortedRows.map((row, index) => {
          const key = keys[index];
          const selected = selectable && selection.has(key);
          return <motion.tr key={key} role="row" className={cn(rowClass, selectable && "cursor-pointer [-webkit-tap-highlight-color:transparent] max-[620px]:pl-11 max-[620px]:data-[selected]:[--row-fill:color-mix(in_oklab,var(--accent)_8%,var(--surface))] pointer-fine:max-[620px]:data-[selected]:hover:[--row-fill:color-mix(in_oklab,var(--accent)_11%,var(--surface))]", "pointer-fine:max-[620px]:not-data-[selected]:hover:[--row-fill:color-mix(in_oklab,var(--foreground)_3%,var(--surface))]")} layout={reduced ? false : "position"} layoutDependency={order} transition={motionTokens.spring.smooth} data-selected={selected || undefined} onClick={event => onRowClick(event, key)} onMouseDown={event => { if (selectable && event.shiftKey) event.preventDefault(); }}>
            {selectable ? <td role="cell" className={cn(tdClass, selectCellClass)}><SelectBox checked={selected} label={`Select ${String(row[columns[0]?.key] ?? key)}`} nav="row" reduced={reduced} onToggle={extend => toggleRow(key, extend)} /></td> : null}
            {columns.map((column, columnIndex) => <td key={column.key} role="cell" className={cn(tdClass, selectable && columnIndex === 0 && "pl-2")} data-label={column.label} data-primary={columnIndex === 0 || undefined} data-sorted={sort?.key === column.key || undefined} data-numeric={numeric.has(column.key) || undefined}>{column.render ? column.render(row[column.key], row) : String(row[column.key] ?? "–")}</td>)}
          </motion.tr>;
        }) : <tr role="row" className={rowClass}><td role="cell" className={cn(tdClass, emptyCellClass)} colSpan={columns.length + (selectable ? 1 : 0)}>{emptyMessage}</td></tr>}</tbody>
      </table>
    </div>
    {selectable ? <div className={footerClass}>
      <span className="sr-only">{shownCount} {noun}</span>
      <span className={countClass} data-active={selectedCount > 0 || undefined} aria-hidden="true">
        <Swap className="tabular-nums" value={String(shownCount)} direction={countDirection} reduced={reduced} />
        <Swap value={noun} direction={selectedCount ? 1 : -1} reduced={reduced} />
      </span>
      <AnimatePresence initial={false}>{selectedCount ? <motion.button key="clear" type="button" className={clearClass} data-clear="" onClick={clearSelection} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .96, filter: blur(motionTokens.blur.soft) }} animate={{ opacity: 1, scale: 1, filter: blur(0) }} exit={reduced ? { opacity: 0, transition: instant } : { opacity: 0, scale: .98, filter: blur(motionTokens.blur.subtle), transition: leave }} transition={reduced ? instant : enter} whileTap={reduced ? undefined : { scale: .97, transition: { duration: motionTokens.duration.instant } }}>Clear selection</motion.button> : null}</AnimatePresence>
    </div> : null}
    <p className="sr-only" role="status">{announcement}</p>
  </div>;
}

export default SortableDataTable;
