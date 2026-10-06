"use client"

import { useEffect, useState } from "react"

import { useThemeTransition } from "@/components/demos/theme-switch"
import { MorphSelect } from "@/components/ui/morph-select"
import { ThemeSwitch } from "@/components/ui/theme-switch"

const accents = ["neutral", "violet", "blue", "green", "amber", "orange", "coral", "rose"] as const
type Accent = (typeof accents)[number]

const swatch: Record<Accent, string> = {
  neutral: "oklch(33% 0 0)",
  violet: "#7747ff",
  blue: "#0562ef",
  green: "#0db879",
  amber: "#f3ad20",
  orange: "#f48120",
  coral: "#f15f55",
  rose: "#ed4e9d",
}

const accentItems = accents.map(name => ({
  value: name,
  label: name[0].toUpperCase() + name.slice(1),
  icon: <span className="size-3 rounded-full" data-accent-swatch={name} style={{ background: swatch[name] }} />,
}))

/** Theme and accent switches for the gallery. The foundation reads both from attributes on <html>. */
export function Appearance() {
  const { theme, onThemeChange } = useThemeTransition()
  const [accent, setAccent] = useState<string>("neutral")

  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  return (
    <div className="flex items-center gap-2">
      <MorphSelect
        label="Accent"
        hideLabel
        items={accentItems}
        value={accent}
        onValueChange={setAccent}
        searchable={false}
        panelWidth={168}
        align="end"
      />
      <ThemeSwitch theme={theme} onThemeChange={onThemeChange} iconOnly />
    </div>
  )
}
