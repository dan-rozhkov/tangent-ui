"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { setAnimationSpeed } from "@/components/gallery/animation-speed"
import { MorphSelect } from "@/components/ui/morph-select"
import { Switch } from "@/components/ui/switch"
import { ReducedMotionConfig, setReducedMotion, useReducedMotion } from "@/lib/reduced-motion"

const speeds = [0.1, 0.25, 0.5, 1, 1.5, 2]
const speedItems = speeds.map(value => ({ value: String(value), label: `${value}×` }))

/** The gallery's motion settings: a speed for every animation, and reduced motion forced on or off (null follows the system). */
type Settings = { speed: number; reduce: boolean | null }

const KEY = "tangent-motion"
const defaults: Settings = { speed: 1, reduce: null }
let settings = defaults
let loaded = false
const listeners = new Set<() => void>()

function apply() {
  setAnimationSpeed(settings.speed)
  setReducedMotion(settings.reduce)
}

function update(next: Partial<Settings>) {
  settings = { ...settings, ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {}
  apply()
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  if (!loaded) {
    loaded = true
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Settings> | null
      if (saved && speeds.includes(saved.speed ?? 1)) settings = { speed: saved.speed ?? 1, reduce: saved.reduce ?? null }
    } catch {}
    apply()
    queueMicrotask(() => listeners.forEach(listener => listener()))
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function useSettings() {
  return useSyncExternalStore(subscribe, () => settings, () => defaults)
}

/** Restores the saved settings on load and lets Motion skip transform and layout animation while motion is reduced. */
export function MotionSettingsRoot({ children }: { children: ReactNode }) {
  useSettings()
  return <ReducedMotionConfig>{children}</ReducedMotionConfig>
}

/** Header controls for the motion settings. */
export function MotionSettings() {
  const { speed } = useSettings()
  const reduced = useReducedMotion()

  return (
    <>
      <MorphSelect
        label="Animation speed"
        hideLabel
        items={speedItems}
        value={String(speed)}
        onValueChange={value => update({ speed: Number(value) })}
        searchable={false}
        panelWidth={112}
        align="end"
      />
      <Switch
        label="Reduce motion"
        className="[&>span:last-child]:max-sm:sr-only"
        checked={reduced}
        onCheckedChange={reduce => update({ reduce })}
      />
    </>
  )
}
