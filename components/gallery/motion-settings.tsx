"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { setAnimationSpeed } from "@/components/gallery/animation-speed"
import { ReducedMotionConfig, setReducedMotion } from "@/lib/reduced-motion"

const speeds = [0.1, 0.25, 0.5, 1, 1.5, 2]

export const accents = ["neutral", "violet", "blue", "green", "amber", "orange", "coral", "rose"] as const
export type Accent = (typeof accents)[number]

/** The gallery's settings: a speed for every animation, reduced motion forced on or off (null follows the system), and the accent color. */
type Settings = { speed: number; reduce: boolean | null; accent: Accent }

const KEY = "tangent-motion"
const defaults: Settings = { speed: 1, reduce: null, accent: "neutral" }
let settings = defaults
let loaded = false
const listeners = new Set<() => void>()

function apply() {
  setAnimationSpeed(settings.speed)
  setReducedMotion(settings.reduce)
  document.documentElement.dataset.accent = settings.accent
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
      if (saved && speeds.includes(saved.speed ?? 1)) {
        const accent = accents.find(name => name === saved.accent)
        settings = { speed: saved.speed ?? 1, reduce: saved.reduce ?? null, accent: accent ?? "neutral" }
      }
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

export const motionSpeeds = speeds

export const setMotionSpeed = (value: number) => update({ speed: value })
export const setMotionReduce = (value: boolean | null) => update({ reduce: value })
export const setAccent = (value: Accent) => update({ accent: value })

/** The settings the header panel shows: the animation speed and the accent color. */
export function useMotionSettings() {
  const { speed, accent } = useSettings()
  return { speed, accent }
}
