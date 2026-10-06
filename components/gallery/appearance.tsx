"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

const accents = ["neutral", "violet", "blue", "green", "amber", "orange", "coral", "rose"] as const

/** Theme and accent switches for the gallery. The foundation reads both from attributes on <html>. */
export function Appearance() {
  const { resolvedTheme, setTheme } = useTheme()
  const [accent, setAccent] = useState<string>("neutral")

  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Accent">
        {accents.map(name => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={accent === name}
            aria-label={name}
            onClick={() => setAccent(name)}
            className={cn(
              "grid size-6 cursor-pointer place-items-center rounded-full border border-transparent transition-colors duration-160",
              accent === name && "border-border-strong",
            )}
          >
            <span className="size-3.5 rounded-full" data-accent-swatch={name} style={{ background: swatch[name] }} />
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="h-8 cursor-pointer rounded-control border border-border px-3 text-sm text-text-secondary transition-colors duration-160 hover:bg-surface-muted hover:text-foreground"
      >
        {/* Label from CSS, so the server render matches whichever theme the client starts in. */}
        <span className="dark:hidden">Dark</span>
        <span className="hidden dark:inline">Light</span>
      </button>
    </div>
  )
}

const swatch: Record<(typeof accents)[number], string> = {
  neutral: "oklch(33% 0 0)",
  violet: "#7747ff",
  blue: "#0562ef",
  green: "#0db879",
  amber: "#f3ad20",
  orange: "#f48120",
  coral: "#f15f55",
  rose: "#ed4e9d",
}
