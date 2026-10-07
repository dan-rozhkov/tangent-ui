"use client";

import { isValidElement, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, type AnimationPlaybackControls, type HTMLMotionProps, type MotionProps, type TargetAndTransition, type Transition } from "motion/react";
import { FolderIcon } from "@phosphor-icons/react"
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  /** Optional accessible label for the state region. */
  label?: string;
}

const exitFast: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
const textIn: TargetAndTransition = { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` };
const textOut: TargetAndTransition = { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: exitFast };
const iconIn: TargetAndTransition = { opacity: 0, scale: .6, filter: `blur(${motionTokens.blur.subtle}px)` };
const shown: TargetAndTransition = { opacity: 1, y: "0em", scale: 1, filter: "blur(0px)" };
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } };

/** Outgoing copies are hidden from assistive tech while they fade. */
function Swap(props: HTMLMotionProps<"span">) {
  const present = useIsPresent();
  return <motion.span {...props} aria-hidden={present ? props["aria-hidden"] : true} />;
}

/** A new icon component crossfades in; re-rendering the same icon stays still. */
function iconKey(icon: ReactNode) {
  if (!isValidElement(icon)) return "icon";
  const type = icon.type as string | { displayName?: string; name?: string };
  return typeof type === "string" ? type : type.displayName ?? type.name ?? "icon";
}

/** Follows its content height. After `morphKey` changes, the height springs from the old size to the new one and then returns to auto, so passive reflows (a resize, a font swap) follow instantly. It clips only while moving, so focus rings stay visible at rest. */
function HeightFrame({ reduce, morphKey, children }: { reduce: boolean | null; morphKey: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | "auto">("auto");
  const changedAt = useRef(0);
  useLayoutEffect(() => { changedAt.current = performance.now(); }, [morphKey]);
  useEffect(() => {
    const node = content.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let last: number | undefined;
    let controls: AnimationPlaybackControls | undefined;
    const settle = () => { height.jump("auto"); if (frame.current) Object.assign(frame.current.style, { overflow: "", height: "auto" }); };
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight;
      const current = height.get();
      const from = typeof current === "number" ? current : last;
      last = next;
      controls?.stop();
      if (reduce || from === undefined || from === next || performance.now() - changedAt.current > 120) return settle();
      // Pin the old height before this frame paints, then spring to the new one.
      if (frame.current) Object.assign(frame.current.style, { overflow: "hidden", height: `${from}px` });
      controls = animate(height, [from, next], { ...motionTokens.spring.smooth, onComplete: settle });
    });
    observer.observe(node);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [height, reduce]);
  return <motion.div ref={frame} className="w-full max-w-full" style={{ height }}>
    <div ref={content} className="flow-root">{children}</div>
  </motion.div>;
}

export function EmptyState({ title, description, action, icon, className, label }: EmptyStateProps) {
  const reduce = useReducedMotion();
  const glyph = icon ?? <FolderIcon size={24} />;
  const enter: Transition = reduce ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] };
  const swap: MotionProps = { initial: reduce ? { opacity: 0 } : textIn, animate: shown, exit: reduce ? fadeOut : textOut, transition: enter };
  // The result of an action morphs in place: the icon crossfades and the copy rises in while the old copy leaves.
  return <section className={cn("flex w-full flex-col items-center px-5 py-[clamp(var(--space-8),8vw,var(--space-12))] text-center", className)} aria-label={label}>
    {/* The icon settles in once when the state first appears; later changes crossfade in place. */}
    <div className="relative grid size-12 animate-in place-items-center rounded-panel border border-border bg-surface-muted text-text-secondary duration-480 ease-enter fade-in-0 zoom-in-92 fill-mode-both motion-reduce:animate-none" aria-hidden="true"><AnimatePresence mode="popLayout" initial={false}><Swap key={iconKey(glyph)} className="grid place-items-center" initial={reduce ? { opacity: 0 } : iconIn} animate={shown} exit={reduce ? fadeOut : { ...iconIn, transition: exitFast }} transition={reduce ? enter : motionTokens.spring.snappy}>{glyph}</Swap></AnimatePresence></div>
    <HeightFrame reduce={reduce} morphKey={`${title}\n${description}`}>
      <h3 className="relative mt-5 mb-0 text-(length:--text-base) leading-body font-medium text-foreground"><AnimatePresence mode="popLayout" initial={false}><Swap key={title} className="block text-balance" {...swap}>{title}</Swap></AnimatePresence></h3>
      {/* Centered copy wraps into even lines, so a new description never leaves a single word hanging. */}
      <p className="relative mx-auto mt-2 mb-0 max-w-72 text-(length:--text-sm) leading-body text-text-secondary"><AnimatePresence mode="popLayout" initial={false}><Swap key={description} className="block text-balance" {...swap}>{description}</Swap></AnimatePresence></p>
    </HeightFrame>
    {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
  </section>;
}

export default EmptyState;
