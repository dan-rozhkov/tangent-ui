"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { useEffect, useRef, useSyncExternalStore } from "react"

import { catalog } from "@/lib/catalog"
import { useReducedMotion } from "@/lib/reduced-motion"
import { showcase, showcaseSrc } from "@/lib/showcase"

function ShowcaseTile({ name }: { name: string }) {
  const item = catalog.find(entry => entry.name === name)
  const { resolvedTheme } = useTheme()
  const reduced = useReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const inViewRef = useRef(false)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const theme = resolvedTheme === "dark" ? "dark" : "light"

  const play = () => {
    videoRef.current?.play().catch(() => {})
  }
  const pause = () => videoRef.current?.pause()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting
        if (reduced) return
        if (entry.isIntersecting) play()
        else pause()
      },
      { threshold: 0.4 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [reduced])

  // A swapped src resets the element, so resume once the new source is in place.
  useEffect(() => {
    if (!mounted) return
    const video = videoRef.current
    if (!video) return
    video.load()
    if (inViewRef.current && !reduced) play()
  }, [mounted, theme, reduced])

  if (!item) return null

  return (
    <Link
      href={`/components/${name}`}
      onPointerEnter={reduced ? play : undefined}
      onPointerLeave={reduced ? pause : undefined}
      className="flex flex-col transition-colors duration-160 hover:text-text-secondary"
    >
      <div className="aspect-[16/10] overflow-hidden bg-surface">
        <video
          ref={videoRef}
          src={mounted ? showcaseSrc(name, theme, "mp4") : undefined}
          poster={mounted ? showcaseSrc(name, theme, "jpg") : undefined}
          width={800}
          height={500}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          className="size-full object-cover"
        />
      </div>
      <span className="px-3 py-2.5 text-sm font-medium">{item.title}</span>
    </Link>
  )
}

export function ShowcaseGrid() {
  return (
    <ul className="grid grid-cols-1 border-t border-l border-border sm:grid-cols-2 lg:grid-cols-3">
      {showcase.map(name => (
        <li key={name} className="min-w-0 border-r border-b border-border">
          <ShowcaseTile name={name} />
        </li>
      ))}
    </ul>
  )
}
