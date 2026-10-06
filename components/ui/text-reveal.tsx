"use client";
import { Fragment, type CSSProperties } from "react";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

/**
 * Reveals a short headline or sentence once, as it mounts: each word rises out of its own clip while it sharpens from a soft blur.
 * The entrance runs in CSS, so it starts on first paint, never waits for hydration, and never leaves text hidden when scripts are slow.
 * Use `\n` in `text` for a deliberate line break and change the element's `key` to replay it.
 */
export interface TextRevealProps { text: string; as?: "h1" | "h2" | "h3" | "p"; className?: string; id?: string; /** Seconds to wait before the first word rises. Defaults to 0. */ delay?: number }
/* The clip hides the rise below the line through a feathered bottom edge, so a blurred word surfaces softly instead of being cut by a hard line.
   Padding with matching negative margins leaves room for descenders and the blur without changing layout; the feather sits below the descenders, so resting words are never dimmed. */
const clip = "inline-block align-top [margin:-.1em_-.16em_-.24em] [padding:.1em_.16em_.24em] [mask-image:linear-gradient(#000_calc(100%_-_.18em),transparent)] motion-reduce:[mask-image:none]";
/* Three tracks: the rise settles longest, the fade finishes first, and the blur clears between them. Each runs on its own nested layer, since one element can only run one
   keyframe set per property group with tw-animate-css. Backwards fill holds the hidden start through each word's delay, then lets go at the end, so resting words keep no transform or filter layer and render as crisp as plain text. */
const stage = "inline-block animate-in fill-mode-backwards [--tw-animation-delay:var(--reveal-delay,0s)]";
const rise = `${stage} slide-in-from-bottom-[.62em] duration-[760ms] ease-enter motion-reduce:animate-none`;
const fade = `${stage} fade-in-0 duration-[440ms] ease-standard motion-reduce:duration-160`;
const focus = `${stage} [--tw-enter-blur:var(--reveal-blur,4px)] duration-[580ms] ease-enter motion-reduce:animate-none`;
/** Total stagger stays under this many seconds, however long the text is. */
const MAX_STAGGER = motionTokens.duration.considered;

export function TextReveal({ text, as = "h2", className, id, delay = 0 }: TextRevealProps) {
  const Tag = as;
  const lines = text.split("\n").map(line => line.split(" ").filter(Boolean));
  const count = lines.reduce((total, words) => total + words.length, 0);
  const step = Math.min(motionTokens.stagger.word, MAX_STAGGER / Math.max(count, 1));
  const blur = as === "p" ? motionTokens.blur.soft : motionTokens.blur.text;
  let index = 0;
  return <Tag id={id} className={cn("m-0 max-w-[24ch] overflow-visible text-balance text-foreground", className)} style={{ "--reveal-blur": `${blur}px` } as CSSProperties}>
    <span className="absolute -m-px size-px overflow-hidden border-0 p-0 whitespace-nowrap select-none [clip-path:inset(50%)]">{text.replace(/\n/g, " ")}</span>
    {lines.map((words, lineIndex) => <Fragment key={lineIndex}><span className="block" aria-hidden="true">{words.map((word, wordIndex) => {
      const position = index++;
      return <Fragment key={`${word}-${position}`}><span className={clip}><span className={rise} style={{ "--reveal-delay": `${delay + position * step + lineIndex * step}s` } as CSSProperties}><span className={fade}><span className={focus}>{word}</span></span></span></span>{wordIndex < words.length - 1 ? " " : null}</Fragment>;
    })}</span>{lineIndex < lines.length - 1 ? " " : null}</Fragment>)}
  </Tag>;
}

export default TextReveal;
