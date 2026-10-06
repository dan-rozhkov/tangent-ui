"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, FileCode2 } from "lucide-react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

export interface CodeBlockProps {
  /** Source shown in the block and copied by the action. */
  code: string;
  /** File name displayed in the header. */
  filename?: string;
  /** Used for the header label and lightweight syntax highlighting. */
  language?: string;
  /** Collapse longer sources to this many lines, with a toggle that expands the rest in place. */
  maxLines?: number;
}

type TokenKind = "comment" | "string" | "number" | "keyword" | "type" | "function" | "property" | "tag" | "punctuation";

/* Each role has contrast in both themes; color supports, but never replaces, source text. */
const tokenClass: Record<TokenKind, string> = {
  comment: "text-text-muted italic",
  string: "text-[oklch(46%_.13_150)] dark:text-[oklch(77%_.15_150)]",
  number: "text-[oklch(50%_.14_55)] dark:text-[oklch(80%_.14_75)]",
  keyword: "text-[oklch(48%_.15_285)] dark:text-[oklch(78%_.16_285)]",
  type: "text-[oklch(46%_.13_230)] dark:text-[oklch(79%_.13_230)]",
  function: "text-[oklch(43%_.12_25)] dark:text-[oklch(80%_.13_25)]",
  property: "text-[oklch(44%_.12_85)] dark:text-[oklch(79%_.12_85)]",
  tag: "text-[oklch(46%_.13_230)] dark:text-[oklch(79%_.13_230)]",
  punctuation: "text-text-secondary",
};

/* Changing text stacks old and new words in one cell; reserve spans hold the widest label so the cell never snaps. */
const swapClass = "inline-grid min-w-0 whitespace-nowrap [&>span]:min-w-0 [&>span]:[grid-area:1/1]";
const swapStackClass = "grid min-w-0 [&>span]:min-w-0 [&>span]:[grid-area:1/1]";

const keywordPattern = /^(?:abstract|as|async|await|break|case|catch|class|const|continue|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|of|private|protected|public|readonly|return|set|static|switch|throw|try|type|typeof|var|void|while|with|yield|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)$/;
const literalPattern = /^(?:true|false|null|undefined|NaN|Infinity)$/;
const typePattern = /^(?:Array|Boolean|Date|Error|Map|Number|Promise|Record|Set|String|ReactNode|HTMLElement|HTMLButtonElement|Event|unknown|never|void|any|boolean|number|string|object)$/;
const tokenPattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$-]*\b|[{}[\]();,.<>:=+*/!?|&-]/g;

function normaliseLanguage(language: string) {
  return language.toLowerCase().replace(/^\./, "");
}

function tokenKind(value: string, source: string, index: number, language: string): TokenKind | undefined {
  if (value.startsWith("//") || value.startsWith("/*") || value.startsWith("<!--")) return "comment";
  if (value.startsWith("\"") || value.startsWith("'") || value.startsWith("`")) {
    return language === "json" && /^\s*:/.test(source.slice(index + value.length)) ? "property" : "string";
  }
  if (/^\d/.test(value)) return "number";
  if (keywordPattern.test(value) || literalPattern.test(value)) return "keyword";
  if (typePattern.test(value)) return "type";
  if (/^[{}[\]();,.<>:=+*/!?|&-]$/.test(value)) return "punctuation";

  const before = source.slice(0, index);
  const after = source.slice(index + value.length);
  if ((language === "tsx" || language === "jsx" || language === "html" || language === "vue") && /<\/?$/.test(before)) return "tag";
  if (/^\s*\(/.test(after) && language !== "json") return "function";
  if ((language === "css" || language === "tsx" || language === "jsx") && /^\s*[:=]/.test(after)) return "property";
  return undefined;
}

function highlight(code: string, language: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of code.matchAll(tokenPattern)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (cursor < index) parts.push(code.slice(cursor, index));

    const kind = tokenKind(value, code, index, language);
    parts.push(kind ? <span className={tokenClass[kind]} key={`${index}-${value}`}>{value}</span> : <Fragment key={`${index}-${value}`}>{value}</Fragment>);
    cursor = index + value.length;
  }

  if (cursor < code.length) parts.push(code.slice(cursor));
  return parts;
}

const textEnter = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } as const;
const textExit = { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } as const;

/** Text that changes in place: the new words rise in with a soft blur while the old ones leave upward, faster. */
function SwapText({ value, reduced }: { value: string; reduced: boolean }) {
  return <AnimatePresence initial={false}>
    <motion.span key={value} className="block overflow-hidden text-ellipsis" initial={reduced ? false : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: textExit }} transition={reduced ? { duration: 0 } : textEnter}>{value}</motion.span>
  </AnimatePresence>;
}

/** A new file name swaps in while its box follows the new width on a spring, then returns to auto so it can still truncate. */
function FileName({ name, reduced }: { name: string; reduced: boolean }) {
  const sizer = useRef<HTMLSpanElement>(null);
  const rest = useRef(0);
  const width = useMotionValue<number | "auto">("auto");
  useEffect(() => {
    const node = sizer.current;
    if (!node) return;
    const observer = new ResizeObserver(() => { rest.current = node.offsetWidth; });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const moving = width.get(), to = sizer.current?.offsetWidth ?? 0;
    const from = typeof moving === "number" ? moving : rest.current;
    rest.current = to;
    if (reduced || !from || !to || Math.abs(from - to) < 1) { width.jump("auto"); return; }
    width.jump(from);
    const controls = animate(width, to, { ...motionTokens.spring.morph, onComplete: () => width.jump("auto") });
    return () => controls.stop();
  }, [name, reduced, width]);
  return <motion.span className={cn(swapClass, "relative overflow-hidden text-foreground")} style={{ width }}>
    <span ref={sizer} className="pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap" aria-hidden="true">{name}</span>
    <span className={swapStackClass} aria-hidden="true"><SwapText value={name} reduced={reduced} /></span>
    <span className="sr-only">{name}</span>
  </motion.span>;
}

export function CodeBlock({ code, filename, language = "tsx", maxLines }: CodeBlockProps) {
  const displayLanguage = normaliseLanguage(language);
  const reduced = useReducedMotion() ?? false;
  const preId = useId();
  const lineCount = code.split("\n").length;
  const collapsible = maxLines != null && maxLines > 0 && lineCount > maxLines;
  const [expanded, setExpanded] = useState(false);
  const open = !collapsible || expanded;
  const preRef = useRef<HTMLPreElement>(null);
  const measured = useRef<{ full: number; collapsed: number } | null>(null);
  // Before the first measurement the clip height comes from CSS, so the server render is already collapsed.
  const height = useMotionValue<number | string>(open ? "auto" : "var(--code-collapsed)");
  const target = useRef({ open, reduced });
  const settleRef = useRef<(instant: boolean) => void>(() => {});

  // The source area follows its content on a spring: expanding, collapsing, and new code all resize smoothly.
  useLayoutEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    const settle = (instant: boolean) => {
      const sizes = measured.current;
      if (!sizes) return;
      const next = target.current.open ? sizes.full : sizes.collapsed;
      if (instant || target.current.reduced || typeof height.get() !== "number") height.jump(next);
      else animate(height, next, motionTokens.spring.smooth);
    };
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(pre);
      const full = pre.offsetHeight;
      const collapsed = maxLines ? Math.min(full, Math.round(maxLines * parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom))) : full;
      const first = !measured.current;
      measured.current = { full, collapsed };
      settle(first);
    });
    observer.observe(pre);
    settleRef.current = settle;
    return () => observer.disconnect();
  }, [height, maxLines]);
  useLayoutEffect(() => { target.current = { open, reduced }; settleRef.current(false); }, [open, reduced]);
  const expandLabels = [`Show all ${lineCount} lines`, "Show fewer lines"];

  return (
    <section className="w-full max-w-full min-w-0 overflow-hidden rounded-panel border border-border bg-surface [--code-collapsed:calc(var(--code-lines,0)*var(--text-sm)*1.7_+_var(--space-5)*2)] max-[420px]:[--code-collapsed:calc(var(--code-lines,0)*var(--text-xs)*1.7_+_var(--space-4)*2)]" aria-label={filename ? `${filename} source code` : `${displayLanguage} source code`} style={maxLines ? { "--code-lines": maxLines } as CSSProperties : undefined}>
      <header className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border-subtle bg-surface-raised py-2 pr-3 pl-4 max-[420px]:pl-3 max-[420px]:[&_button]:w-control-sm max-[420px]:[&_button]:px-0 max-[420px]:[&_button>span:last-of-type]:hidden">
        <div className="flex min-w-0 items-baseline gap-2 font-sans text-sm leading-body font-medium tracking-body text-text-secondary [&>svg]:flex-none [&>svg]:self-center [&>svg]:text-text-muted">
          <FileCode2 size={16} strokeWidth={1.75} aria-hidden="true" />
          <FileName name={filename ?? "Source code"} reduced={reduced} />
          <span className="flex-none [font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace] text-xs font-normal text-text-muted before:mr-2 before:text-border-strong before:content-['·']">{displayLanguage}</span>
        </div>
        <CopyButton value={code} label="Copy code" />
      </header>
      <motion.div className="overflow-hidden" style={{ height }}>
        <pre ref={preRef} id={preId} className="relative m-0 overflow-auto p-5 [font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,'Liberation_Mono',monospace] text-sm leading-[1.7] whitespace-pre text-foreground [font-variant-ligatures:none] [tab-size:2] max-[420px]:p-4 max-[420px]:text-xs" tabIndex={0} aria-label="Selectable source code">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.code key={code} className="block" initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: textExit }} transition={reduced ? { duration: 0 } : textEnter}>{highlight(code, displayLanguage)}</motion.code>
          </AnimatePresence>
        </pre>
      </motion.div>
      {collapsible && <button type="button" className="group/expand flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border-0 border-t border-border-subtle bg-surface-raised px-4 text-sm font-medium text-text-secondary transition-[color,background-color] duration-160 ease-standard pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground motion-reduce:transition-none" aria-expanded={expanded} aria-controls={preId} onClick={() => setExpanded(value => !value)}>
        {/* Both labels reserve the cell, so the chevron never moves when the words change. */}
        <span className={swapClass} aria-hidden="true">{expandLabels.map(text => <span key={text} className="invisible">{text}</span>)}<span className={swapStackClass}><SwapText value={expandLabels[expanded ? 1 : 0]} reduced={reduced} /></span></span>
        <span className="sr-only">{expandLabels[expanded ? 1 : 0]}</span>
        <motion.span className="grid flex-none place-items-center text-text-muted pointer-fine:group-hover/expand:text-foreground" aria-hidden="true" initial={false} animate={{ rotate: expanded ? 180 : 0 }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}><ChevronDown size={16} strokeWidth={1.75} /></motion.span>
      </button>}
    </section>
  );
}
