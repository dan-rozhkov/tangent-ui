"use client"

import Link from "next/link"
import { Suspense, useEffect, useRef, useState } from "react"

import { demos } from "@/components/demos"
import { ReplayButton, useDemoAutoplay } from "@/components/gallery/demo-autoplay"
import { catalog } from "@/lib/catalog"
import { showcase } from "@/lib/showcase"

function ShowcaseTile({ name }: { name: string }) {
  const item = catalog.find(entry => entry.name === name)
  const Demo = demos[name]
  const areaRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const { run, replay, hasScript } = useDemoAutoplay(name, areaRef, stageRef)

  // Mount the demo once its cell nears the viewport; it stays mounted.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setNear(true)
        observer.disconnect()
      },
      { rootMargin: "200px" },
    )
    observer.observe(area)
    return () => observer.disconnect()
  }, [])

  if (!item || !Demo) return null

  return (
    <div className="flex flex-col">
      <div ref={areaRef} data-showcase-tile className="relative flex h-[28rem] items-center justify-center overflow-hidden p-4">
        <div ref={stageRef} className="contents">
          {near && (
            <Suspense fallback={null}>
              <Demo key={run} />
            </Suspense>
          )}
        </div>
        {hasScript && <ReplayButton title={item.title} run={run} onReplay={replay} />}
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

export function ShowcaseGrid() {
  return (
    <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-surface border border-border bg-border sm:grid-cols-2">
      {showcase.map(name => (
        <li key={name} className="min-w-0 bg-surface">
          <ShowcaseTile name={name} />
        </li>
      ))}
    </ul>
  )
}
