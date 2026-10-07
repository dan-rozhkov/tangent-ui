"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from "react";
import Image, { type StaticImageData } from "next/image";
import { AnimatePresence, motion, useAnimate, type Transition, type Variants } from "motion/react";
import { ArrowRightIcon, BellIcon, CaretDownIcon, CheckIcon } from "@phosphor-icons/react"
import { CopyButton } from "@/components/ui/copy-button";
import { motionTokens } from "@/lib/motion-tokens";
import { photo } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

export type ChangelogKind = "new" | "improved" | "fixed";
type Kind = ChangelogKind;
export type ChangelogMedia =
  | { type: "photo"; src: StaticImageData | string; alt: string; caption: string; /** Pixel size, needed when `src` is a URL rather than an imported image. */ width?: number; height?: number }
  | { type: "code"; file: string; code: string };
type Media = ChangelogMedia;
export type ChangelogEntry = { id: string; month: string; date: string; iso: string; version: string; kind: Kind; title: string; summary: string; details: string[]; media?: Media };
export type ChangelogMonth = { key: string; label: string; short: string };
type Entry = ChangelogEntry;
type Month = ChangelogMonth;

const kinds: { id: Kind; label: string }[] = [
  { id: "new", label: "New" },
  { id: "improved", label: "Improved" },
  { id: "fixed", label: "Fixed" },
];

/** Sample photos load by URL from public/media, so the block installs without binary imports. */
const ceramics = photo("clay-vases"), journal = photo("pine-forest"), cups = photo("espresso-cups"), interior = photo("loft-living"), mistyLake = photo("misty-lake");

const exampleMonths: Month[] = [
  { key: "2026-09", label: "September 2026", short: "Sep" },
  { key: "2026-08", label: "August 2026", short: "Aug" },
  { key: "2026-07", label: "July 2026", short: "Jul" },
  { key: "2026-06", label: "June 2026", short: "Jun" },
];

const webhookSnippet = `import { verifyWebhook } from "@halden/node";

const event = verifyWebhook(body, headers, secret);

if (event.type === "order.paid") {
  await fulfil(event.data.order); // ord_7Hq2Lx
}`;

const dnsSnippet = `Type    Name       Value
CNAME   shop       edge.halden.example
TXT     _halden    verify=hd_4f81c2`;

const exampleEntries: Entry[] = [
  { id: "masonry", month: "2026-09", date: "Sep 18", iso: "2026-09-18", version: "4.12.0", kind: "new", title: "Masonry gallery layout", summary: "Mix portrait and landscape work without cropping a single frame.", details: ["Choose two to five columns for each breakpoint.", "Drag an image and the columns rebalance while you move it.", "Captions fall back to the image alt text."], media: { type: "photo", src: ceramics.src, width: ceramics.width, height: ceramics.height, alt: "Two textured clay vases in blush and sage against a mottled wall", caption: "Gallery by Oda Lindqvist Ceramics, Bergen" } },
  { id: "resumable", month: "2026-09", date: "Sep 18", iso: "2026-09-18", version: "4.12.0", kind: "improved", title: "Uploads resume after a dropped connection", summary: "Large uploads continue from the last finished chunk instead of starting over.", details: ["Files upload in 8 MB chunks, each retried up to five times.", "The upload queue survives a page reload."] },
  { id: "currency", month: "2026-09", date: "Sep 9", iso: "2026-09-09", version: "4.11.2", kind: "fixed", title: "Discount codes stay applied after a currency switch", summary: "Switching from EUR to CHF at checkout no longer clears an applied code.", details: ["Affected 0.4% of checkouts since 4.11.0.", "Totals are now recalculated on the server after every switch."] },
  { id: "webhooks", month: "2026-09", date: "Sep 2", iso: "2026-09-02", version: "4.11.0", kind: "new", title: "Order webhooks", summary: "Receive a signed request when an order is paid, refunded, or shipped.", details: ["Every request carries a timestamped signature.", "Failed deliveries retry with backoff for 72 hours."], media: { type: "code", file: "webhooks.ts", code: webhookSnippet } },
  { id: "covers", month: "2026-08", date: "Aug 26", iso: "2026-08-26", version: "4.10.0", kind: "new", title: "Journal posts with full-bleed covers", summary: "Open a story with one photograph that runs edge to edge on every screen.", details: ["Set a focal point so the crop holds on narrow phones.", "Covers load a blurred preview first, then the full image."], media: { type: "photo", src: journal.src, width: journal.width, height: journal.height, alt: "Pine trees emerging from drifting mist on a forested hillside", caption: "Journal cover from Studio Varga, Budapest" } },
  { id: "avif", month: "2026-08", date: "Aug 26", iso: "2026-08-26", version: "4.10.0", kind: "improved", title: "Product pages load 38% faster on mobile", summary: "Images now ship as AVIF with responsive sizes for each device.", details: ["Median largest paint dropped from 2.9 s to 1.8 s.", "Older browsers still receive WebP or JPEG."] },
  { id: "inventory", month: "2026-08", date: "Aug 14", iso: "2026-08-14", version: "4.9.3", kind: "fixed", title: "Stock no longer goes negative during a sale", summary: "Concurrent checkouts now reserve inventory in a single step.", details: ["Two buyers can no longer purchase the last item at the same moment.", "Oversold orders from August 9 to 13 were refunded automatically."] },
  { id: "shortcuts", month: "2026-08", date: "Aug 5", iso: "2026-08-05", version: "4.9.0", kind: "improved", title: "Keyboard shortcuts in the editor", summary: "Move, duplicate, and publish blocks without reaching for the mouse.", details: ["Press ⌘K to open the command menu from anywhere.", "Press ⌘D to duplicate the selected block.", "Press ⇧⌘P to publish the current page."] },
  { id: "variants", month: "2026-07", date: "Jul 22", iso: "2026-07-22", version: "4.8.0", kind: "new", title: "Variants with their own photos", summary: "Each colour or size can show its own gallery on the product page.", details: ["The page switches photos when a buyer picks a variant.", "Variants without photos fall back to the product gallery."], media: { type: "photo", src: cups.src, width: cups.width, height: cups.height, alt: "Two stoneware espresso cups on a pale stone table", caption: "Espresso cup, 80 ml from Ferment Lab, Lyon" } },
  { id: "timezone", month: "2026-07", date: "Jul 10", iso: "2026-07-10", version: "4.7.1", kind: "fixed", title: "Scheduled posts respect the studio time zone", summary: "A post scheduled for 09:00 in Zurich no longer goes live at 09:00 UTC.", details: ["Existing schedules were corrected on July 10.", "The scheduler now shows the time zone next to every slot."] },
  { id: "domains", month: "2026-07", date: "Jul 3", iso: "2026-07-03", version: "4.7.0", kind: "improved", title: "Custom domains verify in under a minute", summary: "Add two DNS records and Halden checks them every few seconds.", details: ["Certificates are issued as soon as the records resolve.", "Verification used to take up to an hour."], media: { type: "code", file: "DNS records", code: dnsSnippet } },
  { id: "rooms", month: "2026-06", date: "Jun 24", iso: "2026-06-24", version: "4.6.0", kind: "new", title: "Shoppable room photos", summary: "Tag products directly on an interior photo and link each tag to checkout.", details: ["Tags follow the photo when it is cropped or resized.", "Up to twelve products per photo."], media: { type: "photo", src: interior.src, width: interior.width, height: interior.height, alt: "A bright loft living room with a wooden staircase, grey sofa, and woven pouf", caption: "Room by Maison Aubert, Montréal" } },
  { id: "csv", month: "2026-06", date: "Jun 12", iso: "2026-06-12", version: "4.5.2", kind: "fixed", title: "CSV exports keep accented names", summary: "Names like Zoë and Håkon now open correctly in every spreadsheet app.", details: ["Exports are written as UTF-8 with a byte order mark.", "Re-export any file created since 4.5.0."] },
  { id: "search", month: "2026-06", date: "Jun 3", iso: "2026-06-03", version: "4.5.0", kind: "improved", title: "Media search understands subject and colour", summary: "Type what is in the picture and the library finds it.", details: ["Search works across 40,000 images in under 200 ms.", "Results group near-duplicates so each shot appears once."], media: { type: "photo", src: mistyLake.src, width: mistyLake.width, height: mistyLake.height, alt: "A calm lake under a pink-streaked dusk sky with low mist over the hills", caption: "Result for “misty lake” in the media library" } },
];


const kindVars: Record<Kind, string> = {
  new: "[--kind:var(--accent)] [--mark:var(--accent)] [--tick:var(--accent-foreground)]",
  improved: "[--kind:var(--text-muted)] [--mark:var(--background)] [--tick:var(--foreground)]",
  fixed: "[--kind:var(--success)] [--mark:var(--success)] [--tick:var(--background)]",
};
const mono = "[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]";

const s = {
  feed: "mx-auto w-[min(100%,920px)] overflow-hidden rounded-panel border border-border bg-surface font-body tracking-body text-foreground motion-reduce:[&_*]:[transition-duration:0ms]!",
  srOnly: "absolute -m-px size-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]",
  /* Header */
  header: "flex items-start justify-between gap-x-6 gap-y-4 px-7 pt-8 pb-5 max-[641px]:flex-col max-[641px]:gap-[18px] max-[641px]:px-5 max-[641px]:py-[26px]",
  heading: "min-w-0",
  headingTitle: "m-0 font-display text-[length:var(--text-3xl)] leading-display font-normal tracking-display",
  headingText: "mt-2 mb-0 text-sm leading-body text-text-secondary",
  /* Subscribe */
  subscribeWrap: "relative flex-none pt-[2px]",
  subscribe: "h-[38px] overflow-hidden rounded-pill border border-foreground bg-foreground text-background transition-[background-color,border-color,color] duration-240 ease-standard",
  subscribeInner: "relative flex h-full w-max",
  subscribeIdle: "inline-flex h-full cursor-pointer items-center gap-[7px] border-0 bg-transparent pr-[17px] pl-[15px] text-sm leading-none font-medium whitespace-nowrap text-inherit",
  subscribeForm: "flex h-full items-center gap-[6px] pr-1 pl-[15px]",
  subscribeInput: "h-full w-[188px] min-w-0 border-0 bg-transparent p-0 text-sm leading-none text-foreground placeholder:text-text-muted max-[641px]:w-[172px] max-[641px]:text-base",
  subscribeSubmit: "grid size-7 flex-none cursor-pointer place-items-center rounded-full border-0 bg-foreground p-0 text-background transition-transform duration-120 ease-standard active:scale-[.94] motion-reduce:active:transform-none",
  subscribeDone: "inline-flex h-full items-center gap-[7px] pr-[5px] pl-[13px] text-sm leading-body font-medium whitespace-nowrap",
  drawnCheck: "flex-none text-success",
  subscribeUndo: "ml-1 h-[26px] cursor-pointer rounded-pill border-0 bg-transparent px-[10px] text-xs leading-none font-medium text-text-secondary transition-[background-color,color] duration-160 ease-standard pointer-fine:hover:bg-surface pointer-fine:hover:text-foreground",
  subscribeNote: "absolute top-[calc(100%_+_7px)] right-[6px] m-0 text-xs leading-4 whitespace-nowrap [&_span]:inline-block max-[641px]:right-auto max-[641px]:left-[6px]",
  /* Filters */
  toolbar: "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-7 pt-[6px] pb-5 max-[641px]:px-5 max-[641px]:pt-1 max-[641px]:pb-[18px]",
  chips: "flex flex-wrap items-center gap-2",
  chip: "group/chip inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-pill border pr-[13px] pl-3 text-sm leading-none font-medium transition-[background-color,border-color,color,transform] [transition-duration:240ms,240ms,240ms,120ms] ease-standard active:scale-[.97] motion-reduce:active:transform-none",
  chipMark: "grid flex-none place-items-center overflow-hidden rounded-full transition-[background-color] duration-240 ease-standard",
  chipTick: "grid place-items-center text-[var(--tick)]",
  chipCount: "text-xs tabular-nums transition-colors duration-240 ease-standard",
  clear: "h-[34px] cursor-pointer rounded-pill border-0 bg-transparent px-2 text-sm leading-none font-medium text-text-secondary pointer-fine:hover:text-foreground",
  shown: "m-0 inline-flex items-baseline gap-1 text-sm leading-body whitespace-nowrap text-text-muted tabular-nums [&>span:last-child]:inline-block max-[481px]:hidden",
  shownCount: "inline-flex",
  /* Rolling numbers */
  roll: "relative inline-flex overflow-hidden tabular-nums [&>span]:inline-block",
  /* Month bar */
  monthBar: "flex min-h-[60px] items-center justify-between gap-4 border-y border-border px-7 py-[10px] max-[641px]:px-5",
  monthLabel: "flex min-w-0 items-baseline gap-3",
  monthText: "relative inline-flex text-lg leading-body font-medium tracking-body whitespace-nowrap [&>span]:inline-block max-[481px]:text-base",
  monthYear: "inline max-[481px]:hidden",
  monthCount: "inline-flex items-baseline gap-1 text-sm leading-body whitespace-nowrap text-text-muted tabular-nums max-[481px]:hidden",
  monthNav: "flex flex-none gap-[2px] rounded-pill bg-surface-muted p-[3px]",
  monthButton: "relative h-7 min-w-[42px] cursor-pointer rounded-pill border-0 bg-transparent px-[10px] text-xs leading-none font-medium transition-colors duration-240 ease-standard pointer-fine:hover:text-foreground max-[481px]:min-w-0 max-[481px]:px-[9px]",
  monthPill: "absolute inset-0 rounded-pill bg-surface shadow-[0_0_0_1px_var(--border),var(--shadow-resting)]",
  monthShort: "relative z-[1]",
  /* Feed */
  scroller: "relative h-[560px] overflow-y-auto overscroll-contain [scrollbar-width:thin] [-webkit-mask-image:linear-gradient(to_bottom,#000_calc(100%_-_36px),transparent)] [mask-image:linear-gradient(to_bottom,#000_calc(100%_-_36px),transparent)] max-[641px]:h-[520px]",
  list: "relative",
  group: "relative",
  groupTitle: "m-0 border-b border-border-subtle px-7 pt-[30px] pb-[10px] text-sm leading-body font-medium text-text-muted max-[641px]:px-5",
  entries: "relative m-0 list-none p-0",
  entry: "relative border-b border-border-subtle bg-surface last:border-b-0",
  row: "group/row grid w-full cursor-pointer grid-cols-[104px_minmax(0,1fr)_20px] items-start gap-x-6 gap-y-1 border-0 bg-transparent px-7 py-[22px] text-left text-inherit transition-colors duration-240 ease-standard pointer-fine:hover:bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)] max-[641px]:grid-cols-[minmax(0,1fr)_20px] max-[641px]:gap-x-3 max-[641px]:gap-y-[10px] max-[641px]:px-5 max-[641px]:py-[18px]",
  meta: "grid justify-items-start gap-2 pt-px max-[641px]:col-start-1 max-[641px]:row-start-1 max-[641px]:flex max-[641px]:items-center max-[641px]:gap-[10px] max-[641px]:pt-0",
  time: "text-sm leading-5 text-text-secondary tabular-nums",
  version: "rounded-[7px] border border-border px-[7px] py-px text-xs leading-[18px] font-medium tracking-[0] whitespace-nowrap text-text-secondary tabular-nums",
  body: "grid min-w-0 gap-[6px] max-[641px]:col-span-2 max-[641px]:row-start-2",
  kind: "inline-flex items-center gap-[7px] text-xs leading-5 font-medium text-text-secondary",
  kindDot: "size-[7px] rounded-full bg-[var(--kind)]",
  title: "text-base leading-body font-medium text-foreground",
  summary: "max-w-[62ch] text-sm leading-body text-text-secondary",
  chevron: "mt-px grid size-5 place-items-center text-text-muted transition-colors duration-240 ease-standard pointer-fine:group-hover/row:text-foreground max-[641px]:col-start-2 max-[641px]:row-start-1 max-[641px]:mt-0",
  panel: "overflow-hidden",
  panelInner: "pt-0 pr-[72px] pb-7 pl-[156px] max-[641px]:px-5 max-[641px]:pb-6",
  details: "m-0 grid max-w-[62ch] list-none gap-[6px] p-0",
  detail: "relative pl-4 text-sm leading-body text-text-secondary before:absolute before:top-[.75em] before:left-px before:h-px before:w-[6px] before:bg-text-muted before:content-['']",
  photo: "mt-[18px] max-w-[560px]",
  photoFrame: "relative aspect-[16/10] overflow-hidden rounded-[16px] bg-surface-muted after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent)] after:content-['']",
  photoImg: "block size-full object-cover",
  caption: "mt-2 text-xs leading-body text-text-muted",
  code: "mt-[18px] max-w-[560px] overflow-hidden rounded-[16px] border border-border bg-surface-muted",
  codeHead: "flex h-10 items-center justify-between gap-3 border-b border-border pr-[6px] pl-[14px] text-xs text-text-muted",
  codePre: "m-0 overflow-x-auto px-4 pt-[14px] pb-4 text-xs leading-[1.7] tracking-[0] text-foreground [tab-size:2] [scrollbar-width:thin]",
  endCap: "m-0 px-7 pt-8 pb-14 text-center text-sm leading-body text-text-muted",
};

const blurSoft = `blur(${motionTokens.blur.soft}px)`;
const blurSubtle = `blur(${motionTokens.blur.subtle}px)`;
const none = "blur(0px)";
const instant: Transition = { duration: 0 };
const exitSpring: Transition = { type: "spring", visualDuration: 0.28, bounce: 0 };

/** Values rise when they grow and fall when they shrink; the outgoing value leaves the opposite way. */
const roll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 55}%`, filter: blurSubtle }),
  center: { opacity: 1, y: "0%", filter: none },
  exit: (direction: number) => ({ opacity: 0, y: `${direction * -55}%`, filter: blurSubtle }),
};
const rise: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: direction * 14, filter: blurSoft }),
  center: { opacity: 1, y: 0, filter: none },
  exit: (direction: number) => ({ opacity: 0, y: direction * -14, filter: blurSoft, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }),
};

function RollingNumber({ value, reduce }: { value: number; reduce: boolean }) {
  const [state, setState] = useState({ value, direction: 1 });
  if (state.value !== value) setState({ value, direction: value > state.value ? 1 : -1 });
  return <span className={s.roll}>
    <AnimatePresence mode="popLayout" initial={false} custom={state.direction}>
      <motion.span key={value} custom={state.direction} variants={roll} initial="enter" animate="center" exit="exit" transition={reduce ? instant : motionTokens.spring.snappy}>{value}</motion.span>
    </AnimatePresence>
  </span>;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type SubscribeState = "idle" | "editing" | "done";

/** One pill that becomes a field, then a confirmation. The shell morphs its width; the content swaps a beat later inside it. */
function SubscribeControl({ reduce }: { reduce: boolean }) {
  const inputId = useId();
  const [state, setState] = useState<SubscribeState>("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idleRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef(false);
  const [shakeScope, animate] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    const element = innerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.offsetWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    const target = state === "editing" ? inputRef.current : state === "done" ? undoRef.current : idleRef.current;
    target?.focus({ preventScroll: true });
  }, [state]);

  function go(next: SubscribeState, focus = true) { focusNext.current = focus; setState(next); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailPattern.test(email.trim())) {
      setError(true);
      if (!reduce && shakeScope.current) animate(shakeScope.current, { x: [0, -6, 5, -3, 2, 0] }, { duration: motionTokens.duration.considered, ease: [...motionTokens.ease.standard] });
      inputRef.current?.focus();
      return;
    }
    setError(false);
    go("done");
  }
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) { if (event.key === "Escape") { setError(false); go("idle"); } }
  function onBlur(event: FocusEvent<HTMLFormElement>) { if (!event.currentTarget.contains(event.relatedTarget) && !email.trim()) { setError(false); go("idle", false); } }
  function undo() { setEmail(""); go("idle"); }

  const swap: Transition = reduce ? { duration: motionTokens.duration.instant } : { opacity: { duration: motionTokens.duration.fast, delay: 0.05 }, filter: { duration: motionTokens.duration.fast, delay: 0.05 }, scale: { ...motionTokens.spring.morph, delay: 0.03 } };
  const leave = { opacity: 0, scale: 0.96, filter: blurSubtle, transition: { duration: motionTokens.duration.instant } };
  const note = error ? "Enter a valid email address" : state === "done" ? "Subscribed." : "";

  return <div className={s.subscribeWrap}>
    <div ref={shakeScope}>
      <motion.div className={cn(s.subscribe, state === "editing" && "border-border-strong bg-surface text-foreground", state === "done" && "border-border bg-surface-muted text-foreground", error && "border-danger")} data-state={state} data-error={error || undefined} initial={false} animate={{ width: width ?? "auto" }} transition={reduce ? instant : motionTokens.spring.morph}>
        <div ref={innerRef} className={s.subscribeInner}>
          <AnimatePresence mode="popLayout" initial={false}>
            {state === "idle" && <motion.button key="idle" ref={idleRef} type="button" className={s.subscribeIdle} onClick={() => go("editing")} initial={{ opacity: 0, scale: 0.96, filter: blurSubtle }} animate={{ opacity: 1, scale: 1, filter: none }} exit={leave} transition={swap}>
              <BellIcon size={14} aria-hidden="true" />Subscribe
            </motion.button>}
            {state === "editing" && <motion.form key="form" className={s.subscribeForm} noValidate onSubmit={submit} onKeyDown={onKeyDown} onBlur={onBlur} initial={{ opacity: 0, scale: 0.96, filter: blurSubtle }} animate={{ opacity: 1, scale: 1, filter: none }} exit={leave} transition={swap}>
              <label className={s.srOnly} htmlFor={inputId}>Email address</label>
              <input className={s.subscribeInput} ref={inputRef} id={inputId} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} aria-invalid={error || undefined} onChange={(event) => { setEmail(event.target.value); if (error) setError(false); }} />
              <button type="submit" className={s.subscribeSubmit} aria-label="Subscribe to release notes"><ArrowRightIcon size={14} /></button>
            </motion.form>}
            {state === "done" && <motion.div key="done" className={s.subscribeDone} initial={{ opacity: 0, scale: 0.96, filter: blurSubtle }} animate={{ opacity: 1, scale: 1, filter: none }} exit={leave} transition={swap}>
              <svg className={s.drawnCheck} width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <motion.path d="M4 12.5l5 5L20 6.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={reduce ? instant : { duration: 0.42, ease: [...motionTokens.ease.standard], delay: 0.12 }} />
              </svg>
              <span>Subscribed</span>
              <button ref={undoRef} type="button" className={s.subscribeUndo} onClick={undo} aria-label={`Undo subscription for ${email.trim()}`}>Undo</button>
            </motion.div>}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
    <p className={cn(s.subscribeNote, error ? "text-danger" : "text-text-muted")} data-error={error || undefined} role="status" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        {note && <motion.span key={note} initial={{ opacity: 0, y: -4, filter: blurSubtle }} animate={{ opacity: 1, y: 0, filter: none }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }} transition={reduce ? instant : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}>{note}</motion.span>}
      </AnimatePresence>
    </p>
  </div>;
}

function EntryMedia({ media }: { media: Media }) {
  if (media.type === "photo") {
    return <figure className={s.photo}>
      <div className={s.photoFrame}>{typeof media.src === "string"
        ? <Image className={s.photoImg} src={media.src} alt={media.alt} width={media.width ?? 1600} height={media.height ?? 1067} sizes="(max-width: 700px) 100vw, 560px" />
        : <Image className={s.photoImg} src={media.src} alt={media.alt} placeholder="blur" sizes="(max-width: 700px) 100vw, 560px" />}</div>
      <figcaption className={s.caption}>{media.caption}</figcaption>
    </figure>;
  }
  return <div className={s.code}>
    <div className={s.codeHead}><span>{media.file}</span><CopyButton value={media.code} label={`Copy ${media.file}`} iconOnly variant="plain" /></div>
    <pre className={cn(s.codePre, mono)}><code>{media.code}</code></pre>
  </div>;
}

function EntryRow({ entry, open, onToggle, reduce }: { entry: Entry; open: boolean; onToggle: () => void; reduce: boolean }) {
  const panelId = useId();
  const kind = kinds.find((item) => item.id === entry.kind)!;
  const layout: Transition = reduce ? instant : motionTokens.spring.smooth;
  return <motion.li
    layout="position"
    className={s.entry}
    data-open={open || undefined}
    initial={reduce ? { opacity: 0 } : { opacity: 0, filter: blurSubtle }}
    animate={{ opacity: 1, filter: none }}
    exit={reduce ? { opacity: 0, transition: { duration: motionTokens.duration.instant } } : { opacity: 0, scale: 0.98, filter: blurSubtle, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }}
    transition={reduce ? { duration: 0, opacity: { duration: motionTokens.duration.instant } } : { opacity: { duration: motionTokens.duration.standard }, filter: { duration: motionTokens.duration.standard }, layout }}
  >
    <button type="button" className={s.row} aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
      <span className={s.meta}>
        <time className={s.time} dateTime={entry.iso}>{entry.date}</time>
        <span className={cn(s.version, mono)}>v{entry.version}</span>
      </span>
      <span className={s.body}>
        <span className={cn(s.kind, kindVars[entry.kind])} data-kind={entry.kind}><i className={s.kindDot} aria-hidden="true" />{kind.label}</span>
        <span className={s.title}>{entry.title}</span>
        <span className={s.summary}>{entry.summary}</span>
      </span>
      <motion.span className={cn(s.chevron, open && "text-foreground")} aria-hidden="true" initial={false} animate={{ rotate: open ? 180 : 0 }} transition={reduce ? instant : motionTokens.spring.snappy}><CaretDownIcon size={16} /></motion.span>
    </button>
    <AnimatePresence initial={false}>
      {open && <motion.div key="panel" id={panelId} className={s.panel} initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0, transition: reduce ? instant : exitSpring }} transition={reduce ? instant : motionTokens.spring.smooth}>
        <motion.div
          className={s.panelInner}
          initial={{ opacity: 0, y: 8, filter: blurSoft }}
          animate={{ opacity: 1, y: 0, filter: none }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
          transition={reduce ? { duration: 0, opacity: { duration: motionTokens.duration.instant } } : { y: { ...motionTokens.spring.smooth, delay: 0.06 }, opacity: { duration: motionTokens.duration.standard, delay: 0.06 }, filter: { duration: motionTokens.duration.standard, delay: 0.06 } }}
        >
          <ul className={s.details}>{entry.details.map((detail) => <li key={detail} className={s.detail}>{detail}</li>)}</ul>
          {entry.media && <EntryMedia media={entry.media} />}
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  </motion.li>;
}

export interface ChangelogFeedProps {
  /** Release notes, newest first. Each entry belongs to one of `months` by key. */
  entries?: ChangelogEntry[];
  /** Months shown in the month bar, newest first. */
  months?: ChangelogMonth[];
  title?: string;
  /** One line under the title, such as the latest release. */
  subtitle?: string;
  /** Closing line at the end of the list. */
  endNote?: string;
  /** Entry ids open on first render. Defaults to the newest entry. */
  defaultOpen?: string[];
  className?: string;
}

export function ChangelogFeed({
  entries = exampleEntries,
  months = exampleMonths,
  title = "Changelog",
  subtitle = "Halden 4.12 shipped on September 18, 2026",
  endNote = "That is everything since Halden 4.5 in June.",
  defaultOpen,
  className,
}: ChangelogFeedProps = {}) {
  const uid = useId();
  const totalCount = entries.length;
  const kindCounts = useMemo(() => kinds.reduce<Record<Kind, number>>((counts, kind) => ({ ...counts, [kind.id]: entries.filter((entry) => entry.kind === kind.id).length }), { new: 0, improved: 0, fixed: 0 }), [entries]);
  const monthOrder = useCallback((key: string) => months.findIndex((month) => month.key === key), [months]);
  const reduce = useReducedMotion() ?? false;
  const [filters, setFilters] = useState<Kind[]>([]);
  const [open, setOpen] = useState<string[]>(() => defaultOpen ?? (entries[0] ? [entries[0].id] : []));
  const [active, setActive] = useState({ key: months[0].key, direction: 1 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef(new Map<string, HTMLElement>());
  const frame = useRef(0);

  const visible = useMemo(() => entries.filter((entry) => filters.length === 0 || filters.includes(entry.kind)), [entries, filters]);
  const groups = useMemo(() => months.map((month) => ({ ...month, items: visible.filter((entry) => entry.month === month.key) })).filter((group) => group.items.length > 0), [months, visible]);
  const current = groups.find((group) => group.key === active.key) ?? groups[0];

  const sync = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller || groups.length === 0) return;
    const line = scroller.getBoundingClientRect().top + 28;
    let key = groups[0].key;
    for (const group of groups) {
      const element = groupRefs.current.get(group.key);
      if (element && element.getBoundingClientRect().top <= line) key = group.key;
    }
    if (scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) key = groups[groups.length - 1].key;
    setActive((previous) => previous.key === key ? previous : { key, direction: monthOrder(key) > monthOrder(previous.key) ? 1 : -1 });
  }, [groups, monthOrder]);

  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => { frame.current = 0; sync(); });
  }, [sync]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => onScroll());
    observer.observe(list);
    return () => observer.disconnect();
  }, [onScroll]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function toggleFilter(kind: Kind) { setFilters((previous) => previous.includes(kind) ? previous.filter((item) => item !== kind) : [...previous, kind]); }
  function toggleEntry(id: string) { setOpen((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]); }
  function jumpTo(key: string) {
    const scroller = scrollRef.current;
    const element = groupRefs.current.get(key);
    if (!scroller || !element) return;
    const top = scroller.scrollTop + element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top: Math.max(0, top - 1), behavior: reduce ? "auto" : "smooth" });
  }

  const shownLabel = filters.length === 0 ? `${totalCount} updates` : `${visible.length} of ${totalCount} updates`;
  const layout: Transition = reduce ? instant : motionTokens.spring.smooth;

  return <section className={cn(s.feed, className)} aria-labelledby={`${uid}-title`}>
    <header className={s.header}>
      <div className={s.heading}>
        <h2 id={`${uid}-title`} className={s.headingTitle}>{title}</h2>
        {subtitle && <p className={s.headingText}>{subtitle}</p>}
      </div>
      <SubscribeControl reduce={reduce} />
    </header>

    <div className={s.toolbar}>
      <div className={s.chips} role="group" aria-label="Filter by type">
        {kinds.map((kind) => {
          const on = filters.includes(kind.id);
          return <button key={kind.id} type="button" className={cn(s.chip, kindVars[kind.id], on ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-text-secondary pointer-fine:hover:border-border-strong pointer-fine:hover:text-foreground")} data-kind={kind.id} aria-pressed={on} onClick={() => toggleFilter(kind.id)}>
            <motion.span className={cn(s.chipMark, on ? "bg-[var(--mark)]" : "bg-[var(--kind)]")} aria-hidden="true" initial={false} animate={{ width: on ? 16 : 7, height: on ? 16 : 7 }} transition={reduce ? instant : motionTokens.spring.morph}>
              <motion.span className={s.chipTick} initial={false} animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.4 }} transition={reduce ? instant : { ...motionTokens.spring.snappy, delay: on ? 0.05 : 0 }}><CheckIcon size={11} /></motion.span>
            </motion.span>
            <span>{kind.label}</span>
            <span className={cn(s.chipCount, on ? "text-[color:color-mix(in_srgb,var(--background)_62%,transparent)]" : "text-text-muted")}>{kindCounts[kind.id]}</span>
          </button>;
        })}
        <AnimatePresence initial={false}>
          {filters.length > 0 && <motion.button key="clear" type="button" className={s.clear} onClick={() => setFilters([])} initial={{ opacity: 0, x: -6, filter: blurSubtle }} animate={{ opacity: 1, x: 0, filter: none }} exit={{ opacity: 0, x: -4, filter: blurSubtle, transition: { duration: motionTokens.duration.instant } }} transition={reduce ? instant : motionTokens.spring.snappy}>Show all</motion.button>}
        </AnimatePresence>
      </div>
      <p className={s.shown} aria-hidden="true">
        <motion.span className={s.shownCount} layout="position" transition={layout}><RollingNumber value={visible.length} reduce={reduce} /></motion.span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={filters.length === 0 ? "all" : "some"} initial={{ opacity: 0, filter: blurSubtle }} animate={{ opacity: 1, filter: none }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }} transition={reduce ? instant : { duration: motionTokens.duration.standard }}>{filters.length === 0 ? "updates" : `of ${totalCount} updates`}</motion.span>
        </AnimatePresence>
      </p>
      <p className={s.srOnly} role="status" aria-live="polite">{`Showing ${shownLabel}`}</p>
    </div>

    <div className={s.monthBar}>
      <div className={s.monthLabel} aria-hidden="true">
        <span className={s.monthText}>
          <AnimatePresence mode="popLayout" initial={false} custom={active.direction}>
            <motion.span key={current?.key ?? "none"} custom={active.direction} variants={rise} initial="enter" animate="center" exit="exit" transition={reduce ? instant : motionTokens.spring.morph}>{current ? <>{current.label.split(" ")[0]}<span className={s.monthYear}> {current.label.split(" ")[1]}</span></> : "No updates"}</motion.span>
          </AnimatePresence>
        </span>
        <motion.span className={s.monthCount} layout="position" transition={layout}><RollingNumber value={current?.items.length ?? 0} reduce={reduce} />{current?.items.length === 1 ? "update" : "updates"}</motion.span>
      </div>
      <nav className={s.monthNav} aria-label="Jump to month">
        {groups.map((group) => {
          const selected = group.key === current?.key;
          return <button key={group.key} type="button" className={cn(s.monthButton, selected ? "text-foreground" : "text-text-secondary")} aria-label={`Jump to ${group.label}`} aria-current={selected ? "true" : undefined} onClick={() => jumpTo(group.key)}>
            {selected && <motion.span layoutId={`${uid}-month`} className={s.monthPill} transition={reduce ? instant : motionTokens.spring.morph} />}
            <span className={s.monthShort}>{group.short}</span>
          </button>;
        })}
      </nav>
    </div>

    <motion.div layoutScroll ref={scrollRef} className={s.scroller} onScroll={onScroll} tabIndex={0} aria-label="Release notes">
      <div ref={listRef} className={s.list}>
        <AnimatePresence mode="popLayout" initial={false}>
          {groups.map((group, index) => <motion.section
            key={group.key}
            layout="position"
            className={s.group}
            aria-labelledby={`${uid}-${group.key}`}
            ref={(element: HTMLElement | null) => { if (element) groupRefs.current.set(group.key, element); else groupRefs.current.delete(group.key); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
            transition={{ layout, opacity: { duration: reduce ? motionTokens.duration.instant : motionTokens.duration.standard } }}
          >
            <h3 id={`${uid}-${group.key}`} className={index === 0 ? s.srOnly : s.groupTitle}>{group.label}</h3>
            <ul className={s.entries}>
              <AnimatePresence mode="popLayout" initial={false}>
                {group.items.map((entry) => <EntryRow key={entry.id} entry={entry} open={open.includes(entry.id)} onToggle={() => toggleEntry(entry.id)} reduce={reduce} />)}
              </AnimatePresence>
            </ul>
          </motion.section>)}
        </AnimatePresence>
        <motion.p layout="position" transition={{ layout }} className={s.endCap}>{endNote}</motion.p>
      </div>
    </motion.div>
  </section>;
}

export default ChangelogFeed;
