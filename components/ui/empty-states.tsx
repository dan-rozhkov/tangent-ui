"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FRAMES, KINDS, VIEW, shapePath } from "@/components/ui/empty-states-art";
import type { Frame, Phase, SceneId } from "@/components/ui/empty-states-art";
import { useReducedMotion } from "@/lib/reduced-motion";

/**
 * One product illustration for four empty states. The tabs pick a state; every shape in the drawing travels to its new
 * position, size, radius, rotation and color on a spring, outlines morph point by point, and line accents draw in a beat later.
 * Each primary action does something local and visible: filters clear into results, a retry reconnects after a short wait,
 * a mail check redraws the check, and a lost page is found in the archive. Nothing here talks to a server.
 */

type View = { scene: SceneId; phase: Phase; from: Phase };
type Copy = { title: string; line: string; action: string };

const SCENES: { id: SceneId; tab: string }[] = [
  { id: "search", tab: "No results" },
  { id: "offline", tab: "Offline" },
  { id: "inbox", tab: "Caught up" },
  { id: "map", tab: "Not found" },
];

const COPY: Record<SceneId, { idle: Copy; done: Copy; loading: string; wait: number }> = {
  search: {
    idle: { title: "No results for “Q3 roadmap”", line: "Two filters are on: owner is Emma Collins and status is archived.", action: "Clear filters" },
    done: { title: "12 results for “Q3 roadmap”", line: "Filters cleared. Showing matches from every owner and status.", action: "Restore filters" },
    loading: "", wait: 0,
  },
  offline: {
    idle: { title: "You are offline", line: "Edits are saved on this device and sync when the connection returns.", action: "Try again" },
    done: { title: "Back online", line: "Three edits synced to the Northwind workspace just now.", action: "Go offline" },
    loading: "Reaching sync.northwind.example…", wait: 1400,
  },
  inbox: {
    idle: { title: "All caught up", line: "You have read every message in Inbox. New mail lands here first.", action: "Check for mail" },
    done: { title: "Still all caught up", line: "Checked just now. Nothing new since 8:30 this morning.", action: "Check again" },
    loading: "Checking for new mail…", wait: 1100,
  },
  map: {
    idle: { title: "Page not found", line: "The link to /projects/atlas-2023 is broken, or the page has moved.", action: "Find the page" },
    done: { title: "Found it in Archive", line: "Atlas 2023 roadmap moved to /archive/atlas-2023 in March.", action: "Show broken link" },
    loading: "Searching the workspace for Atlas…", wait: 1200,
  },
};

/** Shapes lead, details trail: back tiles, body, front tiles, then lines and the mark. Totals stay under 0.4s. */
const DELAY = [.05, .03, 0, .04, .07, .1, .06, .09, .11, .14];
const NUDGE = [.03, .015, 0, .02, .035, .05, .02, .04, .05, .07];
const DRIFT = 2.5;

const first = FRAMES.search.idle;
const INITIAL = first.prims.map((p, i) => ({ ...shapePath(KINDS[i], p.geo, p.fx[1], 0, 0), o: String(p.fx[0]) }));

const enter = [...motionTokens.ease.enter] as [number, number, number, number];
const standard = [...motionTokens.ease.standard] as [number, number, number, number];

/** Motion's visualDuration and bounce, turned into stiffness and damping for the vector springs below. */
function springOf({ visualDuration, bounce }: { visualDuration: number; bounce: number }) {
  const root = (2 * Math.PI) / (visualDuration * 1.2);
  return { k: root * root, c: 2 * Math.min(1, Math.max(.05, 1 - bounce)) * root };
}
const MORPH = springOf(motionTokens.spring.morph), SMOOTH = springOf(motionTokens.spring.smooth), SWAY = { k: 90, c: 19 };

type Channel = { pos: Float64Array; vel: Float64Array; target: Float64Array; queue: { at: number; values: number[] }[]; k: number; c: number; still: boolean };
const channel = (values: number[], spring: { k: number; c: number }): Channel =>
  ({ pos: Float64Array.from(values), vel: new Float64Array(values.length), target: Float64Array.from(values), queue: [], ...spring, still: true });

/** Integrates one spring vector. A new target keeps the current velocity, so shapes retarget mid-flight without a hitch. */
function advance(ch: Channel, now: number, dt: number) {
  while (ch.queue.length && ch.queue[0].at <= now) {
    const next = ch.queue.shift();
    if (next) { ch.target.set(next.values); ch.still = false; }
  }
  if (!ch.still) {
    const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps, { pos, vel, target, k, c } = ch;
    for (let s = 0; s < steps; s++) for (let i = 0; i < pos.length; i++) { vel[i] += (-k * (pos[i] - target[i]) - c * vel[i]) * h; pos[i] += vel[i] * h; }
    let settled = true;
    for (let i = 0; i < pos.length; i++) if (Math.abs(pos[i] - target[i]) > .004 || Math.abs(vel[i]) > .02) { settled = false; break; }
    if (settled) { pos.set(target); vel.fill(0); ch.still = true; }
  }
  return !ch.still || ch.queue.length > 0;
}

type Nodes = { paths: SVGPathElement[]; ghosts: SVGPathElement[]; main: SVGGElement; ghost: SVGGElement };

/** One animation frame loop drives every shape through refs. It sleeps once everything has settled. */
function createEngine(nodes: Nodes, start: Frame) {
  const geo = start.prims.map(p => channel(p.geo, MORPH));
  const fx = start.prims.map(p => channel(p.fx, SMOOTH));
  const sway = channel([0, 0], SWAY);
  const written = INITIAL.map(item => ({ d: item.d, o: item.o, dash: item.dash }));
  let frame = start, raf = 0, last = 0, parallax = false;

  const paint = () => {
    const ox = sway.pos[0] * DRIFT, oy = sway.pos[1] * DRIFT;
    nodes.paths.forEach((node, i) => {
      const { d, dash } = shapePath(KINDS[i], geo[i].pos, fx[i].pos[1], ox, oy);
      const o = String(Math.round(Math.min(1, Math.max(0, fx[i].pos[0])) * 1000) / 1000);
      if (d !== written[i].d) { node.setAttribute("d", d); written[i].d = d; }
      if (o !== written[i].o) { node.setAttribute("opacity", o); written[i].o = o; }
      if (dash !== written[i].dash) { node.setAttribute("stroke-dasharray", dash); written[i].dash = dash; }
    });
  };
  const tick = (time: number) => {
    raf = 0;
    const now = time / 1000, dt = last ? Math.min(.034, Math.max(0, now - last)) : 1 / 60;
    last = now;
    let busy = advance(sway, now, dt);
    for (let i = 0; i < geo.length; i++) busy = advance(geo[i], now, dt) || busy;
    for (let i = 0; i < fx.length; i++) busy = advance(fx[i], now, dt) || busy;
    paint();
    if (busy) raf = requestAnimationFrame(tick); else last = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  const pointer = (x: number, y: number) => {
    sway.queue = [];
    sway.target.set(parallax ? [x, y] : [0, 0]);
    sway.still = false;
    kick();
  };

  return {
    pointer,
    go(next: Frame, sceneChanged: boolean, reduced: boolean) {
      if (reduced) {
        // Crossfade without travel: freeze the old drawing in a ghost layer, snap to the new one, and fade between them.
        nodes.paths.forEach((node, i) => {
          const ghost = nodes.ghosts[i];
          ghost.setAttribute("d", node.getAttribute("d") ?? "");
          ghost.setAttribute("opacity", node.getAttribute("opacity") ?? "1");
          ghost.setAttribute("stroke-dasharray", node.getAttribute("stroke-dasharray") ?? "none");
          ghost.dataset.tone = frame.prims[i].tone;
        });
        next.prims.forEach((p, i) => {
          for (const [ch, values] of [[geo[i], p.geo], [fx[i], p.fx]] as const) { ch.queue = []; ch.target.set(values); ch.pos.set(values); ch.vel.fill(0); ch.still = true; }
        });
        frame = next;
        paint();
        animate(nodes.ghost, { opacity: [1, 0] }, { duration: motionTokens.duration.standard, ease: standard });
        animate(nodes.main, { opacity: [0, 1] }, { duration: motionTokens.duration.standard, ease: standard });
        return;
      }
      const now = performance.now() / 1000, delays = sceneChanged ? DELAY : NUDGE;
      next.prims.forEach((p, i) => {
        geo[i].queue = [{ at: now + delays[i], values: p.geo }];
        if (sceneChanged && p.redraw) fx[i].queue = [{ at: now, values: [p.fx[0], 0] }, { at: now + delays[i] + .18, values: p.fx }];
        else fx[i].queue = [{ at: now + delays[i] + (p.fx[1] > fx[i].target[1] + .01 ? .12 : 0), values: p.fx }];
      });
      frame = next;
      kick();
    },
    setParallax(on: boolean) { parallax = on; if (!on) pointer(0, 0); },
    destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; },
  };
}

/* Strokes stay 1.5px on screen at any size. Colors come from tones and cross over on CSS transitions while the geometry springs.
   Lines and the mark never fill. */
const shapeBase = "fill-none stroke-none [stroke-width:1.5px] [stroke-linecap:round] [stroke-linejoin:round] [vector-effect:non-scaling-stroke] transition-[fill,stroke] duration-480 ease-standard motion-reduce:transition-none";
const shapeFilled = "data-[tone=outline]:fill-surface data-[tone=outline]:stroke-foreground data-[tone=tuck]:fill-surface data-[tone=tuck]:stroke-border-strong data-[tone=slot]:fill-surface data-[tone=slot]:stroke-border-strong data-[tone=query]:fill-text-muted data-[tone=query]:stroke-transparent data-[tone=bar]:fill-border-strong data-[tone=bar]:stroke-transparent data-[tone=back]:fill-surface data-[tone=back]:stroke-text-muted data-[tone=shade]:fill-surface-muted data-[tone=shade]:stroke-foreground data-[tone=dot]:fill-foreground data-[tone=dot]:stroke-transparent data-[tone=ink]:fill-surface data-[tone=ink]:stroke-foreground data-[tone=muted]:fill-surface data-[tone=muted]:stroke-text-muted data-[tone=subtle]:fill-surface data-[tone=subtle]:stroke-border-strong data-[tone=accent]:fill-surface data-[tone=accent]:stroke-foreground data-[tone=success]:fill-surface data-[tone=success]:stroke-success data-[tone=warning]:fill-surface data-[tone=warning]:stroke-warning";
const shapeLine = "data-[tone=outline]:stroke-foreground data-[tone=tuck]:stroke-border-strong data-[tone=slot]:stroke-border-strong data-[tone=query]:stroke-transparent data-[tone=bar]:stroke-transparent data-[tone=back]:stroke-text-muted data-[tone=shade]:stroke-foreground data-[tone=dot]:stroke-transparent data-[tone=ink]:stroke-foreground data-[tone=muted]:stroke-text-muted data-[tone=subtle]:stroke-border-strong data-[tone=accent]:stroke-foreground data-[tone=success]:stroke-success data-[tone=warning]:stroke-warning";
const shapeClass = (kind: (typeof KINDS)[number]) => cn(shapeBase, kind === "stroke" || kind === "mark" ? shapeLine : shapeFilled);

const s = {
  root: "@container w-full font-body tracking-body text-foreground",
  card: "flex flex-col items-center gap-[clamp(20px,4cqi,32px)] rounded-[20px] border border-border bg-surface px-[clamp(16px,4cqi,40px)] py-[clamp(16px,5cqi,48px)]",
  /* Tabs: equal columns while there is room, never narrower than a label. The highlight glides under the labels. */
  tabs: "isolate grid w-[min(100%,460px)] grid-cols-[repeat(4,minmax(max-content,1fr))] gap-[2px] overflow-x-auto rounded-[12px] border border-border bg-surface-muted p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  tab: "relative min-h-[30px] cursor-pointer rounded-[9px] border-0 bg-transparent px-[clamp(8px,2.6cqi,14px)] text-sm leading-body font-medium whitespace-nowrap [-webkit-tap-highlight-color:transparent] transition-colors duration-160 ease-standard motion-reduce:transition-none @max-[421px]:px-[6px] @max-[421px]:text-xs",
  highlight: "absolute inset-0 -z-10 rounded-[inherit] border border-border bg-surface shadow-resting",
  tabLabel: "relative",
  panel: "flex w-full max-w-[480px] flex-col items-center gap-5",
  /* The drawing keeps one aspect ratio, so switching scenes never changes the layout. */
  stage: "aspect-[320/216] w-[min(100%,360px)]",
  art: "block size-full overflow-visible",
  /* Copy */
  copy: "flex w-full flex-col items-center gap-4 text-center",
  copyFrame: "w-full",
  copyInner: "grid gap-[6px] px-2",
  title: "relative m-0 text-lg leading-body font-medium tracking-body text-balance tabular-nums @min-[560px]:text-[length:var(--text-xl)]",
  line: "relative mx-auto my-0 max-w-[40ch] text-sm leading-body text-pretty text-text-secondary",
  swap: "block",
  srOnly: "absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]",
};

export function EmptyStates() {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const [view, setView] = useState<View>({ scene: "search", phase: "idle", from: "idle" });
  const [announcement, setAnnouncement] = useState("");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const ghosts = useRef<(SVGPathElement | null)[]>([]);
  const mainLayer = useRef<SVGGElement>(null);
  const ghostLayer = useRef<SVGGElement>(null);
  const engine = useRef<ReturnType<typeof createEngine> | null>(null);
  const shown = useRef({ scene: view.scene, phase: view.phase });
  const pending = useRef({ timer: 0 });
  const copyInner = useRef<HTMLDivElement>(null);
  const copyHeight = useMotionValue<number | "auto">("auto");
  const armedUntil = useRef(0);

  const frame = FRAMES[view.scene][view.phase];
  const text = COPY[view.scene];
  const copy: Copy = view.phase === "loading" ? { ...text[view.from === "done" ? "done" : "idle"], line: text.loading } : text[view.phase === "done" ? "done" : "idle"];
  const copyKey = `${copy.title}|${copy.line}`;

  useEffect(() => {
    const main = mainLayer.current, ghost = ghostLayer.current;
    const nodes = paths.current.filter(Boolean) as SVGPathElement[], ghostNodes = ghosts.current.filter(Boolean) as SVGPathElement[];
    if (!main || !ghost || nodes.length !== KINDS.length || ghostNodes.length !== KINDS.length) return;
    const instance = createEngine({ paths: nodes, ghosts: ghostNodes, main, ghost }, first);
    engine.current = instance;
    const bag = pending.current;
    return () => { instance.destroy(); engine.current = null; window.clearTimeout(bag.timer); };
  }, []);

  useEffect(() => {
    const fine = typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    engine.current?.setParallax(fine && !reduced);
  }, [reduced]);

  useEffect(() => {
    const prev = shown.current;
    if (prev.scene === view.scene && prev.phase === view.phase) return;
    shown.current = { scene: view.scene, phase: view.phase };
    engine.current?.go(FRAMES[view.scene][view.phase], prev.scene !== view.scene, reduced);
  }, [view.scene, view.phase, reduced]);

  // The copy block springs to the height of the incoming text, so the action never jumps.
  useLayoutEffect(() => { armedUntil.current = performance.now() + 700; }, [copyKey]);
  useEffect(() => {
    const node = copyInner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      if (!measured || reduced || performance.now() > armedUntil.current) { measured = true; copyHeight.jump(next); return; }
      animate(copyHeight, next, motionTokens.spring.smooth);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, copyHeight]);

  function choose(scene: SceneId) {
    if (scene === view.scene) return;
    window.clearTimeout(pending.current.timer);
    setView({ scene, phase: "idle", from: "idle" });
    setAnnouncement("");
  }

  function act() {
    const { scene, phase } = view;
    if (phase === "loading") return;
    const entry = COPY[scene];
    if (scene === "search" || (phase === "done" && scene !== "inbox")) {
      const next: Phase = phase === "idle" ? "done" : "idle";
      setView({ scene, phase: next, from: phase });
      setAnnouncement(`${entry[next === "done" ? "done" : "idle"].title}. ${entry[next === "done" ? "done" : "idle"].line}`);
      return;
    }
    setView({ scene, phase: "loading", from: phase });
    setAnnouncement(entry.loading);
    window.clearTimeout(pending.current.timer);
    pending.current.timer = window.setTimeout(() => {
      setView(current => (current.scene === scene && current.phase === "loading" ? { scene, phase: "done", from: "loading" } : current));
      setAnnouncement(`${entry.done.title}. ${entry.done.line}`);
    }, entry.wait);
  }

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = SCENES.findIndex(item => item.id === view.scene);
    const next = event.key === "ArrowRight" ? (index + 1) % SCENES.length : event.key === "ArrowLeft" ? (index + SCENES.length - 1) % SCENES.length : event.key === "Home" ? 0 : event.key === "End" ? SCENES.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    choose(SCENES[next].id);
    tabs.current[next]?.focus();
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    engine.current?.pointer(((event.clientX - rect.left) / rect.width - .5) * 2, ((event.clientY - rect.top) / rect.height - .5) * 2);
  }

  const rise = reduced
    ? { initial: { opacity: 0 }, exit: { opacity: 0, transition: { duration: motionTokens.duration.exit } } }
    : { initial: { opacity: 0, y: 8, filter: `blur(${motionTokens.blur.soft}px)` }, exit: { opacity: 0, y: -6, filter: `blur(${motionTokens.blur.soft}px)`, transition: { duration: motionTokens.duration.exit, ease: standard } } };
  const shownText = { opacity: 1, y: 0, filter: "blur(0px)" };
  const textIn = (delay: number) => ({ duration: reduced ? motionTokens.duration.standard : motionTokens.duration.considered, ease: enter, delay: reduced ? 0 : delay });

  return (
    <section className={s.root} aria-label="Empty states">
      <div className={s.card}>
        <div className={s.tabs} role="tablist" aria-label="Empty state" onKeyDown={onTabKey}>
          {SCENES.map((item, index) => {
            const selected = item.id === view.scene;
            return (
              <button key={item.id} ref={node => { tabs.current[index] = node; }} id={`${uid}-tab-${item.id}`} type="button" role="tab" aria-selected={selected} aria-controls={`${uid}-panel`} tabIndex={selected ? 0 : -1} className={cn(s.tab, selected ? "text-foreground" : "text-text-muted pointer-fine:hover:text-foreground")} onClick={() => choose(item.id)}>
                {selected ? <motion.span layoutId={`${uid}-highlight`} className={s.highlight} transition={reduced ? { duration: 0 } : motionTokens.spring.morph} /> : null}
                <span className={s.tabLabel}>{item.tab}</span>
              </button>
            );
          })}
        </div>

        <div className={s.panel} role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${view.scene}`}>
          <div className={s.stage} onPointerMove={onPointerMove} onPointerLeave={() => engine.current?.pointer(0, 0)}>
            <svg className={s.art} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label={frame.label}>
              <g ref={ghostLayer} opacity={0} aria-hidden="true">
                {KINDS.map((kind, i) => <path key={i} ref={node => { ghosts.current[i] = node; }} className={shapeClass(kind)} data-kind={kind} d="" />)}
              </g>
              <g ref={mainLayer}>
                {INITIAL.map((item, i) => (
                  <path key={i} ref={node => { paths.current[i] = node; }} className={shapeClass(KINDS[i])} data-kind={KINDS[i]} data-tone={frame.prims[i].tone} d={item.d} opacity={item.o} strokeDasharray={item.dash} style={{ transitionDelay: `${DELAY[i]}s` }} />
                ))}
              </g>
            </svg>
          </div>

          <div className={s.copy}>
            <motion.div className={s.copyFrame} style={{ height: copyHeight }}>
              <div ref={copyInner} className={s.copyInner}>
                <h2 className={s.title}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={copy.title} className={s.swap} initial={rise.initial} animate={shownText} exit={rise.exit} transition={textIn(.06)}>{copy.title}</motion.span>
                  </AnimatePresence>
                </h2>
                <p className={s.line}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={copy.line} className={s.swap} initial={rise.initial} animate={shownText} exit={rise.exit} transition={textIn(.06 + motionTokens.stagger.word)}>{copy.line}</motion.span>
                  </AnimatePresence>
                </p>
              </div>
            </motion.div>
            <Button size="sm" onClick={act} loading={view.phase === "loading"}>{copy.action}</Button>
          </div>
          <p className={s.srOnly} aria-live="polite">{announcement}</p>
        </div>
      </div>
    </section>
  );
}

export default EmptyStates;
