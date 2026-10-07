"use client"

import { useSyncExternalStore, type ReactNode } from "react"
import { MotionConfig } from "motion/react"

const QUERY = "(prefers-reduced-motion: reduce)"

let override: boolean | null = null
const listeners = new Set<() => void>()

/**
 * Forces reduced motion on or off for the whole page, or hands it back to the system setting with null.
 * Mirrors the choice on <html data-motion>, so the motion-reduce and motion-safe variants follow it too.
 */
export function setReducedMotion(value: boolean | null) {
  override = value
  if (value === null) delete document.documentElement.dataset.motion
  else document.documentElement.dataset.motion = value ? "reduce" : "full"
  listeners.forEach(listener => listener())
}

/** Whether motion should be reduced right now: the page's choice if one is set, otherwise the system's. */
export function prefersReducedMotion(): boolean {
  if (override !== null) return override
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches
}

function subscribe(listener: () => void) {
  const query = window.matchMedia(QUERY)
  listeners.add(listener)
  query.addEventListener("change", listener)
  return () => {
    listeners.delete(listener)
    query.removeEventListener("change", listener)
  }
}

/** Drop-in for Motion's useReducedMotion that also follows setReducedMotion(). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}

/** MotionConfig that follows useReducedMotion(), so Motion skips transform and layout animation when motion is reduced. */
export function ReducedMotionConfig({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion={useReducedMotion() ? "always" : "never"}>{children}</MotionConfig>
}
