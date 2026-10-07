"use client"

import Link from "next/link"
import { Suspense, useEffect, useRef, useState } from "react"

import { demos } from "@/components/demos"
import { catalog } from "@/lib/catalog"
import { showcase } from "@/lib/showcase"

function ShowcaseTile({ name }: { name: string }) {
  const item = catalog.find(entry => entry.name === name)
  const Demo = demos[name]
  const areaRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)

  // Mount the demo once its cell nears the viewport, then keep it mounted.
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
      <div ref={areaRef} data-showcase-tile className="flex h-[28rem] items-center justify-center overflow-hidden bg-surface p-4">
        {near && (
          <Suspense fallback={null}>
            <Demo />
          </Suspense>
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

export function ShowcaseGrid() {
  return (
    <ul className="grid grid-cols-1 border-t border-l border-border sm:grid-cols-2">
      {showcase.map(name => (
        <li key={name} className="min-w-0 border-r border-b border-border">
          <ShowcaseTile name={name} />
        </li>
      ))}
    </ul>
  )
}
