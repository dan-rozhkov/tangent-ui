"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"

import { demos } from "@/components/demos"
import { ReplayButton, useDemoAutoplay, type SettleReason } from "@/components/gallery/demo-autoplay"
import { showcaseScripts } from "@/components/gallery/showcase-scripts"
import { catalog } from "@/lib/catalog"
import { prefersReducedMotion } from "@/lib/reduced-motion"
import { showcase } from "@/lib/showcase"

/** Pause between one tile's tour ending and the next starting, so the motion doesn't chain back to back. */
const PLAY_GAP = 600

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
  /** This tile's turn in the grid's one-at-a-time autoplay queue. */
  playing: boolean
  onView: (name: string, inView: boolean) => void
  onHover: (name: string, hovered: boolean) => void
  onSettle: (name: string, reason: SettleReason) => void
  /** The viewer replayed this tile by hand, which counts as its tour. */
  onReplay: (name: string) => void
}

function ShowcaseTile({ name, playing, onView, onHover, onSettle, onReplay }: TileProps) {
  const item = catalog.find(entry => entry.name === name)
  const Demo = demos[name]
  const areaRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  // Bumped when a tour is cut short by scrolling away, so the demo comes back fresh for its restart.
  const [fresh, setFresh] = useState(0)
  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  })
  const { run, replay, hasScript } = useDemoAutoplay(name, areaRef, stageRef, {
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
        if (!entry.isIntersecting && playingRef.current) setFresh(count => count + 1)
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

  // The mouse counts as on the tile only once it moves there: Chrome also fires trusted pointerenter and pointerleave
  // when the page scrolls under a stationary cursor, which must not stop a tour. Scripts fire untrusted events.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const move = (event: PointerEvent) => {
      if (event.isTrusted && event.pointerType === "mouse" && (event.movementX !== 0 || event.movementY !== 0)) onHover(name, true)
    }
    const leave = (event: PointerEvent) => {
      if (event.isTrusted && event.pointerType === "mouse") onHover(name, false)
    }
    area.addEventListener("pointermove", move, { passive: true })
    area.addEventListener("pointerleave", leave, { passive: true })
    return () => {
      area.removeEventListener("pointermove", move)
      area.removeEventListener("pointerleave", leave)
      onHover(name, false)
    }
  }, [name, onHover])

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
        className="px-3 py-2.5 text-sm font-medium transition-colors duration-160 hover:text-text-secondary"
      >
        {item.title}
      </Link>
    </div>
  )
}

/**
 * Plays the tiles' tours one at a time, in showcase order: while the mouse isn't on a tile, the first tile that is in
 * view, has a script and hasn't played goes next, a beat after the previous one ended. Everything moving at once costs
 * the first load and loses the eye, and a tour must never run under a viewer's cursor.
 */
export function ShowcaseGrid() {
  const [inView, setInView] = useState<ReadonlySet<string>>(new Set())
  const [hovered, setHovered] = useState<ReadonlySet<string>>(new Set())
  const [played, setPlayed] = useState<ReadonlySet<string>>(new Set())
  const [playing, setPlaying] = useState<string | null>(null)

  const playingRef = useRef<string | null>(null)
  useEffect(() => {
    playingRef.current = playing
  })

  const finish = useCallback((name: string) => {
    setPlayed(set => withMember(set, name, true))
    setPlaying(current => (current === name ? null : current))
  }, [])
  // A cancelled run (scrolled out of view, unmounted) isn't a tour that happened, so the tile keeps its turn.
  const onSettle = useCallback((name: string, reason: SettleReason) => {
    if (reason !== "cancelled") finish(name)
  }, [finish])
  // The playing tile scrolling out of the middle band stops its tour without spending it, so it never holds the queue
  // from view yet restarts from the top when it is back.
  const onView = useCallback((name: string, visible: boolean) => {
    setInView(set => withMember(set, name, visible))
    if (!visible) setPlaying(current => (current === name ? null : current))
  }, [])
  const onHover = useCallback(
    (name: string, over: boolean) => {
      setHovered(set => withMember(set, name, over))
      if (over && playingRef.current === name) finish(name)
    },
    [finish],
  )

  useEffect(() => {
    // A mouse resting on any tile holds the whole queue: the viewer is looking there, not at the next tour.
    if (playing || hovered.size > 0 || prefersReducedMotion()) return
    const next = showcase.find(name => inView.has(name) && !played.has(name) && Object.hasOwn(showcaseScripts, name))
    if (!next) return
    const timer = window.setTimeout(() => setPlaying(next), PLAY_GAP)
    return () => window.clearTimeout(timer)
  }, [playing, inView, played, hovered])

  return (
    <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-surface border border-border bg-border sm:grid-cols-2">
      {showcase.map(name => (
        <li key={name} className="min-w-0 bg-surface">
          <ShowcaseTile name={name} playing={playing === name} onView={onView} onHover={onHover} onSettle={onSettle} onReplay={finish} />
        </li>
      ))}
    </ul>
  )
}
