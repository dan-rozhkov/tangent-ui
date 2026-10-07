"use client";

import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import Image from "next/image";
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from "motion/react";
import type { Transition, Variants } from "motion/react";
import { ArrowRightIcon, BookOpenIcon, CaretDownIcon, ChatsCircleIcon, ClockIcon, CompassIcon, LayoutIcon, ListIcon, PackageIcon, SidebarSimpleIcon, SwatchesIcon, XIcon } from "@phosphor-icons/react"
import SegmentedControl from "@/components/ui/segmented-control";
import { motionTokens } from "@/lib/motion-tokens";
import { photo } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

export type SiteHeaderVariant = "simple" | "centered" | "mega";

/** One destination inside a mega menu panel. */
export interface SiteHeaderLink {
  label: string;
  /** One short line under the label. */
  description?: string;
  /** A plain decorative icon beside the label. */
  icon?: ReactNode;
  href?: string;
}

/** A card beside the links in a mega menu panel. */
export interface SiteHeaderFeature {
  title: string;
  description?: string;
  href?: string;
  image?: { src: string; alt: string };
}

/** A top level destination. With `links` and the mega variant it opens a panel; otherwise it is a plain link. */
export interface SiteHeaderItem {
  /** Stable value, also used for `current`. */
  value: string;
  label: string;
  href?: string;
  links?: SiteHeaderLink[];
  feature?: SiteHeaderFeature;
}

export interface SiteHeaderAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

/** What `onNavigate` receives. */
export interface SiteHeaderDestination {
  label: string;
  href?: string;
  /** The top level item the destination belongs to. */
  section?: string;
}

export interface SiteHeaderProps {
  /** `simple` puts links beside the brand, `centered` centers them in a quiet capsule, `mega` opens panels for items with links. */
  variant?: SiteHeaderVariant;
  brand?: { name: string; href?: string; mark?: ReactNode };
  items?: SiteHeaderItem[];
  /** Value of the item that holds the current page (controlled). */
  current?: string;
  /** Initial current item when uncontrolled. */
  defaultCurrent?: string;
  /** Called when a destination inside an item is chosen, with that item's value. */
  onCurrentChange?: (value: string) => void;
  /** Called for every destination: items, panel links, the brand, and actions with an href. */
  onNavigate?: (destination: SiteHeaderDestination) => void;
  /** A quiet action before the primary one, such as Sign in. Pass null to hide it. */
  secondaryAction?: SiteHeaderAction | null;
  /** The one primary action at the end of the bar. Pass null to hide it. */
  primaryAction?: SiteHeaderAction | null;
  /** Sticks to the top of its scroll container. Defaults to true. */
  sticky?: boolean;
  /** The element that scrolls, when it is not the window. The header turns solid once it scrolls. */
  scrollContainer?: RefObject<HTMLElement | null>;
  /** Pixels of scroll before the background turns solid. Defaults to 8. */
  scrollThreshold?: number;
  /** Accessible name of the navigation landmark. */
  label?: string;
  className?: string;
}

type Bezier = [number, number, number, number];
const enter = [...motionTokens.ease.enter] as Bezier;
const standard = [...motionTokens.ease.standard] as Bezier;
/** Duration based springs restated as stiffness and damping, so a retarget keeps the velocity already in flight. */
const physical = (visualDuration: number, bounce: number): Transition => {
  const root = 2 * Math.PI / (visualDuration * 1.2);
  return { type: "spring", stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 };
};
const GROW = physical(.44, .12), SHRINK = physical(.34, 0), GLIDE = physical(.3, .1), SLIDE = physical(.4, .06);
const HOVER_INTENT = 70, LEAVE_GRACE = 180, TRAVEL = 36;
/** Matches the container query classes (`@max-[760px]/site-header`) below. */
const COLLAPSE_BELOW = 760;

/** Panel content slides in from the side of the newly opened item; opening from closed drops in from the bar. */
const faceVariants: Variants = {
  hidden: (direction: number) => ({ opacity: 0, x: direction * TRAVEL, y: direction ? 0 : -6, filter: `blur(${motionTokens.blur.subtle}px)` }),
  shown: { opacity: 1, x: 0, y: 0, filter: "blur(0px)", transition: { x: SLIDE, y: SLIDE, opacity: { duration: motionTokens.duration.fast, ease: enter, delay: .02 }, filter: { duration: motionTokens.duration.standard, ease: enter } } },
  gone: (direction: number) => ({ opacity: 0, x: direction * -TRAVEL * .6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { x: SLIDE, opacity: { duration: motionTokens.duration.instant, ease: standard }, filter: { duration: motionTokens.duration.instant, ease: standard } } }),
};
const fadeVariants: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: motionTokens.duration.fast } }, gone: { opacity: 0, transition: { duration: motionTokens.duration.instant } } };

export function TangentMark(props: { className?: string }) {
  return <svg className={props.className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="32" cy="36" r="17" />
    <path d="M8 19h48" />
  </svg>;
}

const ICON = { size: 16, "aria-hidden": true } as const;
const curvedFacade = photo("curved-facade");

export const siteHeaderExampleItems: SiteHeaderItem[] = [
  {
    value: "product", label: "Product",
    links: [
      { label: "Components", description: "140 interactive React components", icon: <PackageIcon {...ICON} /> },
      { label: "Blocks", description: "Complete sections, ready to ship", icon: <SidebarSimpleIcon {...ICON} /> },
      { label: "Templates", description: "Starter sites with every page", icon: <LayoutIcon {...ICON} /> },
      { label: "Themes", description: "Tune color, radius, and motion", icon: <SwatchesIcon {...ICON} /> },
    ],
    feature: { title: "What's new in 2.4", description: "Site headers, footers, and hero sections.", image: { src: curvedFacade.src, alt: curvedFacade.alt } },
  },
  {
    value: "resources", label: "Resources",
    links: [
      { label: "Documentation", description: "Install, theme, and compose", icon: <BookOpenIcon {...ICON} /> },
      { label: "Guides", description: "Patterns for real product work", icon: <CompassIcon {...ICON} /> },
      { label: "Changelog", description: "Every release, week by week", icon: <ClockIcon {...ICON} /> },
      { label: "Community", description: "Questions, answers, and showcases", icon: <ChatsCircleIcon {...ICON} /> },
    ],
  },
  { value: "pricing", label: "Pricing" },
  { value: "customers", label: "Customers" },
];

/* Class maps. The header is its own size container, so the layout folds by the space it has rather than the viewport. */
const s = {
  header: "@container/site-header relative z-20 border-b border-b-transparent bg-transparent font-body tracking-body text-foreground transition-[background-color,border-color,box-shadow] duration-240 ease-standard motion-reduce:transition-none data-[scrolled]:border-b-border data-[scrolled]:bg-background data-[scrolled]:shadow-resting",
  inner: "relative mx-auto max-w-[1200px] px-6 @max-[760px]/site-header:px-4",
  bar: "flex h-16 items-center gap-2",
  brandSlot: "flex min-w-0",
  brand: "inline-flex cursor-pointer items-center gap-2 rounded-[12px] border-0 bg-transparent py-2 pr-2 pl-0 text-base leading-body font-medium text-foreground no-underline",
  brandMark: "size-[22px] flex-none",
  nav: "min-w-0 @max-[760px]/site-header:hidden",
  navList: "m-0 flex list-none items-center gap-[2px] p-0",
  navCell: "flex",
  navItem: "group/item relative isolate inline-flex h-9 cursor-pointer items-center gap-1 rounded-[12px] border-0 bg-transparent px-3 text-sm leading-body font-medium whitespace-nowrap text-text-secondary no-underline [-webkit-tap-highlight-color:transparent] transition-colors duration-160 ease-standard data-[current]:text-foreground data-[open]:text-foreground pointer-fine:hover:text-foreground motion-reduce:transition-none",
  navLabel: "relative",
  chevron: "text-text-muted transition-transform duration-240 ease-standard group-data-[open]/item:rotate-180 motion-reduce:transition-none",
  hover: "absolute inset-0 -z-10 rounded-[inherit] bg-surface-muted",
  indicator: "absolute right-3 bottom-1 left-3 h-[2px] rounded-[2px] bg-accent",
  actions: "ml-auto flex items-center gap-2",
  action: "inline-flex h-9 cursor-pointer items-center justify-center rounded-control border border-transparent px-[14px] text-sm leading-body font-medium whitespace-nowrap no-underline [-webkit-tap-highlight-color:transparent] transition-[transform,background-color,opacity] duration-160 ease-standard active:scale-[.97] motion-reduce:transition-none motion-reduce:active:transform-none",
  secondary: "bg-transparent text-text-secondary pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
  primary: "bg-foreground text-background pointer-fine:hover:opacity-90",
  wideOnly: "@max-[760px]/site-header:hidden",
  menuButton: "relative hidden size-10 cursor-pointer place-items-center rounded-[12px] border-0 bg-transparent text-foreground [-webkit-tap-highlight-color:transparent] transition-colors duration-160 ease-standard active:bg-surface-muted motion-reduce:transition-none @max-[760px]/site-header:grid",
  menuIcon: "grid place-items-center",
  /* Mega menu panel: one surface whose height springs to each section's content. */
  panel: "absolute top-[calc(100%_-_4px)] right-6 left-6 origin-[50%_0] overflow-hidden rounded-panel border border-border bg-surface-raised shadow-floating @max-[760px]/site-header:hidden",
  face: "relative p-3 data-[leaving]:pointer-events-none data-[leaving]:absolute data-[leaving]:inset-x-0 data-[leaving]:top-0",
  faceGrid: "grid gap-2 data-[featured]:grid-cols-[minmax(0,1fr)_minmax(200px,260px)]",
  panelLinks: "m-0 grid list-none grid-cols-[repeat(2,minmax(0,1fr))] gap-[2px] p-0",
  panelLink: "flex size-full cursor-pointer items-start gap-3 rounded-[16px] border-0 bg-transparent p-3 text-left text-foreground no-underline transition-colors duration-160 ease-standard focus-visible:bg-surface-muted pointer-fine:hover:bg-surface-muted motion-reduce:transition-none",
  panelIcon: "mt-[2px] flex flex-none text-text-secondary",
  panelText: "grid min-w-0 gap-[2px] [&>span]:leading-body [&>span:first-child]:text-sm [&>span:first-child]:font-medium [&>span:last-child:not(:first-child)]:text-sm [&>span:last-child:not(:first-child)]:text-text-muted",
  feature: "group/feature grid cursor-pointer content-start gap-[6px] rounded-[18px] border-0 bg-surface-muted px-2 pt-2 pb-3 text-left text-foreground no-underline focus-visible:bg-surface-muted",
  featureImage: "relative mb-1 block aspect-[16/10] overflow-hidden rounded-[12px] bg-border",
  featureImg: "object-cover transition-transform duration-480 ease-standard pointer-fine:group-hover/feature:scale-[1.03] motion-reduce:transition-none",
  featureTitle: "inline-flex items-center gap-[6px] px-1 text-sm leading-body font-medium",
  featureArrow: "text-text-muted transition-transform duration-160 ease-standard pointer-fine:group-hover/feature:translate-x-[2px] motion-reduce:transition-none",
  featureText: "px-1 text-sm leading-body text-text-muted",
  /* Mobile sheet: drops from the bar and pushes nothing; the scrim closes it. */
  scrim: "absolute inset-x-0 top-full h-dvh bg-[oklch(0%_0_0/.16)] @min-[760px]/site-header:hidden",
  sheet: "absolute inset-x-0 top-full overflow-hidden border-b border-border bg-background @min-[760px]/site-header:hidden",
  /* --site-header-sheet-max lets a header inside a fixed height scroller keep its actions in view. */
  sheetInner: "max-h-[var(--site-header-sheet-max,calc(100dvh_-_65px))] overflow-y-auto overscroll-contain px-4 pt-2 pb-5",
  sheetList: "m-0 list-none p-0",
  sheetItem: "border-b border-border-subtle",
  sheetRow: "group/row flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-1 text-left text-base leading-body font-medium text-foreground no-underline [-webkit-tap-highlight-color:transparent]",
  sheetChevron: "text-text-muted transition-transform duration-240 ease-standard group-aria-expanded/row:rotate-180 motion-reduce:transition-none",
  sheetDot: "size-[6px] rounded-full bg-accent",
  sheetGroup: "overflow-hidden",
  sheetGroupList: "m-0 grid list-none p-0 pb-3",
  sheetLink: "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] border-0 bg-transparent px-2 text-left text-sm leading-body text-text-secondary no-underline active:bg-surface-muted active:text-foreground",
  sheetActions: "mt-5 grid grid-cols-2 gap-2",
  /* Preview frame: a small page that scrolls under the header. */
  preview: "grid w-full justify-items-center gap-4",
  frame: "@container relative h-[520px] w-full overflow-y-auto overscroll-contain rounded-[20px] border border-border bg-background",
  page: "-mt-[65px]",
  pageHero: "grid justify-items-center gap-3 [background:var(--brand-gradient-soft,var(--surface-muted))] px-6 pt-32 pb-[72px] text-center @max-[521px]:px-4 @max-[521px]:pt-28 @max-[521px]:pb-14",
  pageTitle: "m-0 font-display text-[length:var(--text-3xl)] leading-display font-medium tracking-display",
  pageRows: "grid gap-3 p-6",
  pageRow: "grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 @max-[521px]:grid-cols-1 @max-[521px]:[&>span:not(:first-child)]:hidden",
  pageBlock: "h-[120px] rounded-[16px] bg-surface-muted",
  srOnly: "absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]",
};

function useScrolled(threshold: number, container?: RefObject<HTMLElement | null>) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const node = container?.current ?? null;
    const target: HTMLElement | Window = node ?? window;
    const read = () => node ? node.scrollTop : window.scrollY;
    // Turns solid past the threshold and clear again only near the top, so it never flickers at the edge.
    const update = () => { const y = read(); setScrolled(previous => previous ? y > threshold / 2 : y > threshold); };
    update();
    target.addEventListener("scroll", update, { passive: true });
    return () => target.removeEventListener("scroll", update);
  }, [threshold, container]);
  return scrolled;
}

/** A panel face reports its natural height while current; a leaving face floats out of flow and turns inert. */
function Face({ direction, reduced, onHeight, children }: { direction: number; reduced: boolean; onHeight: (height: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !present) return;
    onHeight(node.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => onHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, [present, onHeight]);
  return <motion.div ref={ref} className={s.face} data-face="" data-leaving={present ? undefined : ""} inert={!present} custom={direction} variants={reduced ? fadeVariants : faceVariants} initial="hidden" animate="shown" exit="gone">
    {children}
  </motion.div>;
}

type DestinationProps = Omit<HTMLAttributes<HTMLElement>, "onClick" | "children"> & { link: { href?: string; label: string }; onChoose: (event: ReactMouseEvent) => void; children: ReactNode };
/** Renders an anchor when the destination has an href and a button otherwise, so demos and real sites share one path. */
function Destination({ link, onChoose, children, ...rest }: DestinationProps) {
  return link.href
    ? <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} href={link.href} onClick={onChoose}>{children}</a>
    : <button {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} type="button" onClick={onChoose}>{children}</button>;
}

/**
 * A website header in three layouts. It sticks to the top and turns solid once the page scrolls, marks the current section
 * with an indicator that glides between links, opens springy mega menu panels whose content slides in from the side you
 * moved toward, and folds into a menu sheet on narrow containers.
 */
export const SiteHeader = forwardRef<HTMLElement, SiteHeaderProps>(function SiteHeader({
  variant = "mega",
  brand = { name: "Tangent" },
  items = siteHeaderExampleItems,
  current: currentProp,
  defaultCurrent,
  onCurrentChange,
  onNavigate,
  secondaryAction = { label: "Sign in" },
  primaryAction = { label: "Get Tangent" },
  sticky = true,
  scrollContainer,
  scrollThreshold = 8,
  label = "Main",
  className,
}, ref) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const scrolled = useScrolled(scrollThreshold, scrollContainer);
  const [innerCurrent, setInnerCurrent] = useState(defaultCurrent);
  const current = currentProp ?? innerCurrent;
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState<{ value: string; direction: number } | null>(null);
  const [panel, setPanel] = useState<{ height: number | null; grow: boolean }>({ height: null, grow: true });
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement | HTMLAnchorElement>());
  const panelRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | undefined>(undefined), closeTimer = useRef<number | undefined>(undefined);
  const focusFirst = useRef(false);
  const hasPanels = variant === "mega";
  const centered = variant === "centered";
  const openItem = open ? items.find(item => item.value === open.value) : undefined;

  const setRefs = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
    if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
  }, [ref]);

  const clearTimers = useCallback(() => { window.clearTimeout(openTimer.current); window.clearTimeout(closeTimer.current); }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const openPanel = useCallback((value: string | null) => {
    setOpen(previous => {
      if (!value) return null;
      if (previous?.value === value) return previous;
      const from = previous ? items.findIndex(item => item.value === previous.value) : -1;
      const to = items.findIndex(item => item.value === value);
      return { value, direction: from < 0 ? 0 : Math.sign(to - from) };
    });
    if (!value) setPanel({ height: null, grow: true });
  }, [items]);

  const close = useCallback((restoreFocus = false) => {
    clearTimers();
    const was = open?.value;
    openPanel(null);
    if (restoreFocus && was) triggerRefs.current.get(was)?.focus();
  }, [open, openPanel, clearTimers]);

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false);
    setExpanded(null);
    if (restoreFocus) menuButtonRef.current?.focus();
  }, []);

  const choose = useCallback((destination: SiteHeaderDestination, section: string | undefined) => {
    if (section) {
      if (currentProp === undefined) setInnerCurrent(section);
      onCurrentChange?.(section);
    }
    onNavigate?.(destination);
    close();
    closeMenu();
  }, [close, closeMenu, currentProp, onCurrentChange, onNavigate]);

  // Outside presses and Escape close whichever layer is open.
  useEffect(() => {
    if (!open && !menuOpen) return;
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) { close(); closeMenu(); } };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { if (open) close(true); else closeMenu(true); } };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open, menuOpen, close, closeMenu]);

  // The sheet belongs to narrow layouts: widening the container closes it, and it holds the page still while open.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width >= COLLAPSE_BELOW) { setMenuOpen(false); setExpanded(null); } else setOpen(null);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const scroller: HTMLElement = scrollContainer?.current ?? document.documentElement;
    const previous = scroller.style.getPropertyValue("overflow");
    scroller.style.setProperty("overflow", "hidden");
    return () => { if (previous) scroller.style.setProperty("overflow", previous); else scroller.style.removeProperty("overflow"); };
  }, [menuOpen, scrollContainer]);

  useEffect(() => {
    if (!open || !focusFirst.current) return;
    focusFirst.current = false;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("[data-panel-link]")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function onTriggerPointerEnter(event: ReactPointerEvent, value: string) {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    if (open) openPanel(value);
    else openTimer.current = window.setTimeout(() => openPanel(value), HOVER_INTENT);
  }
  function onRegionPointerLeave(event: ReactPointerEvent) {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => openPanel(null), LEAVE_GRACE);
  }
  function onRegionPointerEnter(event: ReactPointerEvent) {
    if (event.pointerType === "mouse") window.clearTimeout(closeTimer.current);
  }

  function onNavKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const triggers = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-nav-item]"));
    const index = triggers.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + triggers.length) % triggers.length;
    triggers[nextIndex].focus();
    if (open) { const item = items[nextIndex]; openPanel(item && hasPanels && item.links?.length ? item.value : null); }
  }
  function onTriggerKeyDown(event: ReactKeyboardEvent, value: string) {
    if (event.key === "ArrowDown") { event.preventDefault(); focusFirst.current = true; openPanel(value); if (open?.value === value) panelRef.current?.querySelector<HTMLElement>("[data-panel-link]")?.focus(); }
  }
  function onPanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    const unique = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-face]:not([data-leaving]) [data-panel-link]"));
    if (!unique.length) return;
    event.preventDefault();
    const index = unique.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? unique.length - 1 : event.key === "ArrowDown" ? Math.min(index + 1, unique.length - 1) : index - 1;
    if (next < 0) { close(true); return; }
    unique[next]?.focus();
  }

  // Growing carries a little life; shrinking settles without overshoot.
  const onHeight = useCallback((height: number) => setPanel(previous => previous.height === height ? previous : { height, grow: previous.height === null || height > previous.height }), []);

  const actionNode = (action: SiteHeaderAction, kind: "secondary" | "primary", extra = "") => {
    const onClick = () => { action.onClick?.(); if (action.href) onNavigate?.({ label: action.label, href: action.href }); closeMenu(); };
    const cls = cn(s.action, s[kind], extra);
    return action.href ? <a className={cls} href={action.href} onClick={onClick}>{action.label}</a> : <button type="button" className={cls} onClick={onClick}>{action.label}</button>;
  };

  const brandNode = <Destination link={{ label: brand.name, href: brand.href }} className={s.brand} onChoose={() => { onNavigate?.({ label: brand.name, href: brand.href }); close(); closeMenu(); }}>
    {brand.mark ?? <TangentMark className={s.brandMark} />}<span>{brand.name}</span>
  </Destination>;

  return <header
    ref={setRefs}
    className={cn(s.header, sticky && "sticky top-0", className)}
    data-variant={variant}
    data-scrolled={scrolled || menuOpen || !!open ? "" : undefined}
  >
    <div className={s.inner} onPointerLeave={onRegionPointerLeave} onPointerEnter={onRegionPointerEnter}>
      <div className={cn(s.bar, centered && "@min-[760px]/site-header:grid @min-[760px]/site-header:grid-cols-[1fr_auto_1fr]")}>
        <div className={s.brandSlot}>{brandNode}</div>
        <LayoutGroup id={id}>
          <nav className={cn(s.nav, centered ? "m-0" : "ml-4")} aria-label={label} onKeyDown={onNavKeyDown} onPointerLeave={() => setHovered(null)}>
            <ul className={cn(s.navList, centered && "rounded-pill border border-border bg-surface-muted p-[3px]")}>
              {items.map(item => {
                const isCurrent = current === item.value;
                const withPanel = hasPanels && !!item.links?.length;
                const isOpen = open?.value === item.value;
                const panelId = `${id}-panel`;
                const common = {
                  className: cn(s.navItem, centered && "h-8 rounded-pill px-[14px]"),
                  "data-nav-item": "",
                  "data-current": isCurrent ? "" : undefined,
                  "data-open": isOpen ? "" : undefined,
                  onPointerEnter: (event: ReactPointerEvent) => { if (event.pointerType === "mouse") setHovered(item.value); if (withPanel) onTriggerPointerEnter(event, item.value); else if (event.pointerType === "mouse" && open) closeTimer.current = window.setTimeout(() => openPanel(null), LEAVE_GRACE); },
                  onFocus: () => setHovered(null),
                };
                const decorations = <>
                  {hovered === item.value && variant !== "centered" && <motion.span key={`hover-${variant}`} layoutId={`hover-${variant}`} className={s.hover} transition={reduced ? { duration: 0 } : GLIDE} aria-hidden="true" />}
                  {isCurrent && <motion.span key={`current-${variant}`} layoutId={`current-${variant}`} className={cn(s.indicator, withPanel && "right-[calc(var(--space-3)+18px)]", centered && "inset-0 -z-10 h-auto rounded-[inherit] border border-border bg-surface shadow-resting")} transition={reduced ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
                </>;
                return <li key={item.value} className={s.navCell}>
                  {withPanel
                    ? <button
                        {...common}
                        ref={(node: HTMLButtonElement | null) => { if (node) triggerRefs.current.set(item.value, node); else triggerRefs.current.delete(item.value); }}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={isOpen ? panelId : undefined}
                        onClick={() => { clearTimers(); openPanel(isOpen ? null : item.value); }}
                        onKeyDown={event => onTriggerKeyDown(event, item.value)}
                      >
                        {decorations}
                        <span className={s.navLabel}>{item.label}</span>
                        <CaretDownIcon className={s.chevron} size={14} aria-hidden="true" />
                      </button>
                    : <Destination
                        link={item}
                        {...common}
                        aria-current={isCurrent ? "page" : undefined}
                        onChoose={() => choose({ label: item.label, href: item.href, section: item.value }, item.value)}
                      >
                        {decorations}
                        <span className={s.navLabel}>{item.label}</span>
                      </Destination>}
                </li>;
              })}
            </ul>
          </nav>
        </LayoutGroup>
        <div className={cn(s.actions, centered && "justify-self-end")}>
          {secondaryAction && actionNode(secondaryAction, "secondary", s.wideOnly)}
          {primaryAction && actionNode(primaryAction, "primary")}
          <button ref={menuButtonRef} type="button" className={s.menuButton} aria-expanded={menuOpen} aria-controls={`${id}-sheet`} aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => { if (menuOpen) closeMenu(); else setMenuOpen(true); }}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span key={menuOpen ? "close" : "open"} className={s.menuIcon} initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: menuOpen ? -45 : 45, scale: .8 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: menuOpen ? 45 : -45, scale: .8 }} transition={reduced ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.instant } }}>
                {menuOpen ? <XIcon size={20} aria-hidden="true" /> : <ListIcon size={20} aria-hidden="true" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      {hasPanels && <AnimatePresence>
        {openItem?.links && <motion.div
          key="panel"
          id={`${id}-panel`}
          ref={panelRef}
          className={s.panel}
          role="region"
          aria-label={openItem.label}
          onKeyDown={onPanelKeyDown}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: .985 }}
          animate={{ opacity: 1, y: 0, scale: 1, height: panel.height ?? "auto" }}
          exit={reduced ? { opacity: 0, transition: { duration: motionTokens.duration.instant } } : { opacity: 0, y: -4, scale: .99, transition: { duration: motionTokens.duration.exit, ease: standard } }}
          transition={reduced ? { duration: 0 } : { height: panel.grow ? GROW : SHRINK, y: GROW, scale: GROW, opacity: { duration: motionTokens.duration.fast, ease: enter } }}
        >
          <AnimatePresence initial={false} custom={open?.direction ?? 0}>
            <Face key={openItem.value} direction={open?.direction ?? 0} reduced={reduced} onHeight={onHeight}>
              <div className={s.faceGrid} data-featured={openItem.feature ? "" : undefined}>
                <ul className={s.panelLinks}>
                  {openItem.links.map(link => <li key={link.label}>
                    <Destination link={link} className={s.panelLink} data-panel-link="" onChoose={() => choose({ label: link.label, href: link.href, section: openItem.value }, openItem.value)}>
                      {link.icon && <span className={s.panelIcon}>{link.icon}</span>}
                      <span className={s.panelText}><span>{link.label}</span>{link.description && <span>{link.description}</span>}</span>
                    </Destination>
                  </li>)}
                </ul>
                {openItem.feature && <Destination link={{ label: openItem.feature.title, href: openItem.feature.href }} className={s.feature} data-panel-link="" onChoose={() => choose({ label: openItem.feature!.title, href: openItem.feature!.href, section: openItem.value }, openItem.value)}>
                  {openItem.feature.image && <span className={s.featureImage}><Image className={s.featureImg} src={openItem.feature.image.src} alt={openItem.feature.image.alt} fill sizes="260px" /></span>}
                  <span className={s.featureTitle}>{openItem.feature.title}<ArrowRightIcon className={s.featureArrow} size={14} aria-hidden="true" /></span>
                  {openItem.feature.description && <span className={s.featureText}>{openItem.feature.description}</span>}
                </Destination>}
              </div>
            </Face>
          </AnimatePresence>
        </motion.div>}
      </AnimatePresence>}
    </div>

    <AnimatePresence>
      {menuOpen && <>
        <motion.div key="scrim" className={s.scrim} onClick={() => closeMenu()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.standard, ease: standard }} aria-hidden="true" />
        <motion.div
          key="sheet"
          id={`${id}-sheet`}
          className={s.sheet}
          initial={reduced ? { opacity: 0 } : { height: 0 }}
          animate={reduced ? { opacity: 1 } : { height: "auto" }}
          exit={reduced ? { opacity: 0 } : { height: 0, transition: SHRINK }}
          transition={reduced ? { duration: 0 } : GROW}
        >
          <nav className={s.sheetInner} aria-label={label}>
            <ul className={s.sheetList}>
              {items.map((item, index) => {
                const isCurrent = current === item.value;
                const group = !!item.links?.length && variant === "mega";
                const isExpanded = expanded === item.value;
                const rowMotion = { initial: reduced ? false : { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, transition: { duration: motionTokens.duration.standard, ease: enter, delay: reduced ? 0 : .04 + index * motionTokens.stagger.item } } as const;
                return <motion.li key={item.value} className={s.sheetItem} {...rowMotion}>
                  {group ? <>
                    <button type="button" className={s.sheetRow} data-current={isCurrent ? "" : undefined} aria-expanded={isExpanded} aria-controls={`${id}-group-${item.value}`} onClick={() => setExpanded(isExpanded ? null : item.value)}>
                      <span>{item.label}</span><CaretDownIcon className={s.sheetChevron} size={18} aria-hidden="true" />
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && <motion.div key="group" id={`${id}-group-${item.value}`} className={s.sheetGroup} initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }} exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}>
                        <ul className={s.sheetGroupList}>{item.links!.map(link => <li key={link.label}>
                          <Destination link={link} className={s.sheetLink} onChoose={() => choose({ label: link.label, href: link.href, section: item.value }, item.value)}>
                            {link.icon}<span>{link.label}</span>
                          </Destination>
                        </li>)}</ul>
                      </motion.div>}
                    </AnimatePresence>
                  </> : <Destination link={item} className={s.sheetRow} data-current={isCurrent ? "" : undefined} aria-current={isCurrent ? "page" : undefined} onChoose={() => choose({ label: item.label, href: item.href, section: item.value }, item.value)}>
                    <span>{item.label}</span>{isCurrent && <span className={s.sheetDot} aria-hidden="true" />}
                  </Destination>}
                </motion.li>;
              })}
            </ul>
            {(secondaryAction || primaryAction) && <motion.div className={s.sheetActions} initial={reduced ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionTokens.duration.standard, ease: enter, delay: reduced ? 0 : .04 + items.length * motionTokens.stagger.item }}>
              {secondaryAction && actionNode(secondaryAction, "secondary", "h-control-md border-border")}
              {primaryAction && actionNode(primaryAction, "primary", "h-control-md")}
            </motion.div>}
          </nav>
        </motion.div>
      </>}
    </AnimatePresence>
  </header>;
});

SiteHeader.displayName = "SiteHeader";

const variantOptions = [{ value: "mega", label: "Mega menu" }, { value: "simple", label: "Simple" }, { value: "centered", label: "Centered" }];
const pageLabels: Record<string, string> = { product: "Product", resources: "Resources", pricing: "Pricing", customers: "Customers" };

/** Preview: the header inside a small scrolling page, with a switch between its three layouts. */
export function SiteHeaderBlock({ variant: initial = "mega" }: { variant?: SiteHeaderVariant }) {
  const [variant, setVariant] = useState<SiteHeaderVariant>(initial);
  const [current, setCurrent] = useState("product");
  const [last, setLast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  return <div className={s.preview}>
    <SegmentedControl label="Header layout" options={variantOptions} value={variant} onValueChange={value => setVariant(value as SiteHeaderVariant)} />
    <div className={s.frame} ref={scrollRef} style={{ "--site-header-sheet-max": "calc(520px - 67px)" } as CSSProperties}>
      <SiteHeader
        variant={variant}
        current={current}
        onCurrentChange={setCurrent}
        onNavigate={destination => setLast(destination.label)}
        scrollContainer={scrollRef}
        secondaryAction={{ label: "Sign in", onClick: () => setLast("Sign in") }}
        primaryAction={{ label: "Get Tangent", onClick: () => setLast("Get Tangent") }}
      />
      <div className={s.page}>
        <div className={s.pageHero}>
          <h2 className={s.pageTitle}>{pageLabels[current] ?? "Tangent"}</h2>
          <p className={s.srOnly} aria-live="polite">{last ? `Opened ${last}` : ""}</p>
        </div>
        <div className={s.pageRows} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className={s.pageRow}><span className={s.pageBlock} /><span className={s.pageBlock} /><span className={s.pageBlock} /></div>)}
        </div>
      </div>
    </div>
  </div>;
}

export default SiteHeaderBlock;
