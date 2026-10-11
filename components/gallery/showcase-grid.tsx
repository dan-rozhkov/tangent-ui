"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

import { demos } from "@/components/demos"
import { ReplayButton, useDemoAutoplay, type SettleReason } from "@/components/gallery/demo-autoplay"
import { showcaseScripts } from "@/components/gallery/showcase-scripts"
import { catalog } from "@/lib/catalog"
import { prefersReducedMotion } from "@/lib/reduced-motion"
import { showcase } from "@/lib/showcase"

/** Pause between one tile's tour ending and the next starting, so the motion doesn't chain back to back. */
const PLAY_GAP = 600

/** How long the mouse must rest on a tile before its tour starts, so sweeping across the grid doesn't fire tours. */
const HOVER_DELAY = 1000

const FINE_POINTER = "(hover: hover) and (pointer: fine)"

let finePointerQuery: MediaQueryList | undefined
/** One shared query list: the snapshot is read on every render of the grid. */
function finePointer() {
  finePointerQuery ??= window.matchMedia(FINE_POINTER)
  return finePointerQuery
}

function subscribeFinePointer(listener: () => void) {
  const query = finePointer()
  query.addEventListener("change", listener)
  return () => query.removeEventListener("change", listener)
}

/** Whether a real mouse is the primary input; the server and touch devices answer false. */
function useFinePointer() {
  return useSyncExternalStore(subscribeFinePointer, () => finePointer().matches, () => false)
}

/** A trusted mouse move that really moved; Chrome also fires zero-movement ones when the page scrolls under the cursor. */
function isMouseMove(event: PointerEvent) {
  return event.isTrusted && event.pointerType === "mouse" && (event.movementX !== 0 || event.movementY !== 0)
}

const mountQueue: (() => void)[] = []
let mountPump: { cancel: () => void } | null = null

/** Pops one pending mount per idle period; Safari has no requestIdleCallback, so a short timeout stands in. */
function pumpMounts() {
  if (mountPump || mountQueue.length === 0) return
  const run = () => {
    mountPump = null
    mountQueue.shift()?.()
    pumpMounts()
  }
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: 200 })
    mountPump = { cancel: () => cancelIdleCallback(id) }
  } else {
    const id = window.setTimeout(run, 50)
    mountPump = { cancel: () => window.clearTimeout(id) }
  }
}

/** Queues a demo mount behind the others, so several demos never mount in the same frame. Returns a canceller. */
function queueMount(mount: () => void) {
  mountQueue.push(mount)
  pumpMounts()
  return () => {
    const index = mountQueue.indexOf(mount)
    if (index >= 0) mountQueue.splice(index, 1)
    if (mountQueue.length === 0) {
      mountPump?.cancel()
      mountPump = null
    }
  }
}

/** The same set with `name` added or removed; the identical set when nothing changes, so state doesn't re-render. */
function withMember(set: ReadonlySet<string>, name: string, member: boolean): ReadonlySet<string> {
  if (set.has(name) === member) return set
  const next = new Set(set)
  if (member) next.add(name)
  else next.delete(name)
  return next
}

interface TileProps {
  name: string
  /** This tile's turn in the grid's one-at-a-time autoplay queue, or its hover tour on desktop. */
  playing: boolean
  /** Desktop mode: tours follow the mouse, and leaving a tile that ran one puts the demo back to its start. */
  hoverMode: boolean
  /** The viewer took the demo over, so it keeps their state. */
  owned: boolean
  onView: (name: string, inView: boolean) => void
  onHover: (name: string, hovered: boolean) => void
  onSettle: (name: string, reason: SettleReason) => void
  /** The viewer pressed or typed into the demo, tour or not. */
  onOwn: (name: string) => void
  /** The viewer replayed this tile by hand, which counts as its tour. */
  onReplay: (name: string) => void
}

function ShowcaseTile({ name, playing, hoverMode, owned, onView, onHover, onSettle, onOwn, onReplay }: TileProps) {
  const item = catalog.find(entry => entry.name === name)
  const Demo = demos[name]
  const areaRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  // Bumped when a tour is cut short by scrolling away, so the demo comes back fresh for its restart.
  const [fresh, setFresh] = useState(0)
  const playingRef = useRef(playing)
  const ownedRef = useRef(owned)
  // Whether a tour has run since the demo last mounted fresh.
  const ranRef = useRef(false)
  useEffect(() => {
    playingRef.current = playing
    ownedRef.current = owned
    if (playing) ranRef.current = true
  })
  const { run, replay, hasScript } = useDemoAutoplay(name, stageRef, {
    active: playing,
    onSettle: reason => onSettle(name, reason),
  })

  // Mount the demo once its cell nears the viewport, through the shared queue; it stays mounted.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    let cancel: (() => void) | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        cancel = queueMount(() => setNear(true))
      },
      { rootMargin: "200px" },
    )
    observer.observe(area)
    return () => {
      observer.disconnect()
      cancel?.()
    }
  }, [])

  // Tells the grid when the mounted tile sits in the middle band of the viewport, the only place a tour may start.
  useEffect(() => {
    const area = areaRef.current
    if (!near || !area) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && playingRef.current) {
          ranRef.current = false
          setFresh(count => count + 1)
        }
        onView(name, entry.isIntersecting)
      },
      { rootMargin: "-25% 0px -25% 0px" },
    )
    observer.observe(area)
    return () => {
      observer.disconnect()
      onView(name, false)
    }
  }, [near, name, onView])

  // The mouse counts as on the tile only once it moves there, and off it only once it moves elsewhere: Chrome also
  // fires trusted pointerenter and pointerleave when the page scrolls under a stationary cursor, which must neither
  // stop a tour nor reset the demo. Scripts fire untrusted events.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const move = (event: PointerEvent) => {
      if (isMouseMove(event)) onHover(name, true)
    }
    // Nothing on a pointerleave tells a scroll from a real exit, so a leave counts once the next real move lands off
    // the tile. A real exit's own pointermove follows its pointerleave at once; leaving the window has no next move.
    const recheck = (event: PointerEvent) => {
      if (!isMouseMove(event)) return
      document.removeEventListener("pointermove", recheck, { capture: true })
      if (!area.contains(event.target as Node)) exit()
    }
    const leave = (event: PointerEvent) => {
      if (!event.isTrusted || event.pointerType !== "mouse") return
      if (event.relatedTarget === null) exit()
      else document.addEventListener("pointermove", recheck, { capture: true, passive: true })
    }
    const exit = () => {
      onHover(name, false)
      // The next hover replays the tour, so the demo must start from its initial state; a viewer's own state stays.
      if (hoverMode && ranRef.current && !ownedRef.current) {
        ranRef.current = false
        setFresh(count => count + 1)
      }
    }
    area.addEventListener("pointermove", move, { passive: true })
    area.addEventListener("pointerleave", leave, { passive: true })
    return () => {
      area.removeEventListener("pointermove", move)
      area.removeEventListener("pointerleave", leave)
      document.removeEventListener("pointermove", recheck, { capture: true })
      onHover(name, false)
    }
  }, [name, onHover, hoverMode])

  // Any press or key in the demo makes it the viewer's, also when no tour runs: a pending hover tour must not start on
  // top of it, and leaving must not reset it. Scripts fire untrusted events.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !hoverMode) return
    const own = (event: Event) => {
      if (event.isTrusted) onOwn(name)
    }
    stage.addEventListener("pointerdown", own, { capture: true, passive: true })
    stage.addEventListener("keydown", own, { capture: true, passive: true })
    return () => {
      stage.removeEventListener("pointerdown", own, { capture: true })
      stage.removeEventListener("keydown", own, { capture: true })
    }
  }, [name, onOwn, hoverMode])

  if (!item || !Demo) return null

  return (
    <div className="flex flex-col">
      <div
        ref={areaRef}
        data-showcase-tile
        data-autoplay={playing ? "playing" : undefined}
        className="relative flex h-[28rem] items-center justify-center overflow-hidden p-4"
      >
        <div ref={stageRef} className="contents">
          {near && (
            <Suspense fallback={null}>
              <Demo key={`${run}-${fresh}`} />
            </Suspense>
          )}
        </div>
        {hasScript && (
          <ReplayButton
            title={item.title}
            run={run}
            onReplay={() => {
              onReplay(name)
              replay()
            }}
          />
        )}
      </div>
      <Link
        href={`/components/${name}`}
        className="px-3 py-2.5 text-center text-sm font-medium transition-colors duration-160 hover:text-text-secondary"
      >
        {item.title}
      </Link>
    </div>
  )
}

/**
 * Autoplays the tiles' tours, by input. With a mouse nothing moves by itself: a tour starts for the tile the mouse has
 * rested on for HOVER_DELAY, stops when the mouse leaves, and the tile is reset on leaving so the next hover replays it;
 * a viewer who clicks into a demo owns it, and it is never replayed or reset. Without a mouse the tours go one at a
 * time, in showcase order: while no tile is touched, the first tile in view that has a script and hasn't played goes
 * next, a beat after the previous one ended. Everything moving at once costs the first load and loses the eye, and a
 * tour must never run under a viewer's cursor.
 */
export function ShowcaseGrid() {
  const hoverMode = useFinePointer()
  const [inView, setInView] = useState<ReadonlySet<string>>(new Set())
  const [hovered, setHovered] = useState<ReadonlySet<string>>(new Set())
  // Queue mode: tours already spent. Hover mode: tours settled during the current hover.
  const [played, setPlayed] = useState<ReadonlySet<string>>(new Set())
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set())
  const [playing, setPlaying] = useState<string | null>(null)

  const playingRef = useRef<string | null>(null)
  const ownedRef = useRef(owned)
  useEffect(() => {
    playingRef.current = playing
    ownedRef.current = owned
  })

  const finish = useCallback((name: string) => {
    setPlayed(set => withMember(set, name, true))
    setPlaying(current => (current === name ? null : current))
  }, [])
  // A cancelled run (scrolled out of view, unmounted) isn't a tour that happened, so the tile keeps its turn.
  const onSettle = useCallback((name: string, reason: SettleReason) => {
    if (reason !== "cancelled") finish(name)
  }, [finish])
  const onOwn = useCallback((name: string) => setOwned(set => withMember(set, name, true)), [])
  // A hand-pressed replay is the viewer's: on desktop it also ends the hover tour and keeps the demo as it is.
  const onReplay = useCallback(
    (name: string) => {
      if (hoverMode) setOwned(set => withMember(set, name, true))
      finish(name)
    },
    [finish, hoverMode],
  )
  // The playing tile scrolling out of the middle band stops its tour without spending it, so it never holds the queue
  // from view yet restarts from the top when it is back.
  const onView = useCallback((name: string, visible: boolean) => {
    setInView(set => withMember(set, name, visible))
    if (!visible) setPlaying(current => (current === name ? null : current))
  }, [])
  const onHover = useCallback(
    (name: string, over: boolean) => {
      setHovered(set => withMember(set, name, over))
      if (hoverMode) {
        if (over) return
        // Leaving ends the tour and lets the next hover play it again, unless the viewer took the demo over.
        setPlaying(current => (current === name ? null : current))
        if (!ownedRef.current.has(name)) setPlayed(set => withMember(set, name, false))
      } else if (over && playingRef.current === name) finish(name)
    },
    [finish, hoverMode],
  )

  useEffect(() => {
    if (hoverMode || playing || hovered.size > 0 || prefersReducedMotion()) return
    // A mouse resting on any tile holds the whole queue: the viewer is looking there, not at the next tour.
    const next = showcase.find(name => inView.has(name) && !played.has(name) && Object.hasOwn(showcaseScripts, name))
    if (!next) return
    const timer = window.setTimeout(() => setPlaying(next), PLAY_GAP)
    return () => window.clearTimeout(timer)
  }, [hoverMode, playing, inView, played, hovered])

  useEffect(() => {
    if (!hoverMode || playing || prefersReducedMotion()) return
    const next = showcase.find(name => hovered.has(name) && !played.has(name) && !owned.has(name) && Object.hasOwn(showcaseScripts, name))
    if (!next) return
    const timer = window.setTimeout(() => setPlaying(next), HOVER_DELAY)
    return () => window.clearTimeout(timer)
  }, [hoverMode, playing, hovered, played, owned])

  return (
    <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-surface border border-border bg-border sm:grid-cols-2">
      {showcase.map(name => (
        <li key={name} className="min-w-0 bg-surface">
          <ShowcaseTile
            name={name}
            playing={playing === name}
            hoverMode={hoverMode}
            owned={owned.has(name)}
            onView={onView}
            onHover={onHover}
            onSettle={onSettle}
            onOwn={onOwn}
            onReplay={onReplay}
          />
        </li>
      ))}
    </ul>
  )
}
