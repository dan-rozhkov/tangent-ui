"use client"

import { useMemo, useSyncExternalStore } from "react"

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
export const addDays = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
/** Whole calendar days from b to a, immune to DST. */
export const diffDays = (a: Date, b: Date) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5)

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const fromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/** Today turns over at local midnight; returning to the tab reads it again. */
const subscribeToday = (notify: () => void) => {
  let timer = 0
  const schedule = () => {
    const now = new Date()
    timer = window.setTimeout(
      () => {
        notify()
        schedule()
      },
      addDays(now, 1).getTime() - now.getTime() + 1000,
    )
  }
  const onVisible = () => {
    if (document.visibilityState === "visible") notify()
  }
  schedule()
  document.addEventListener("visibilitychange", onVisible)
  return () => {
    window.clearTimeout(timer)
    document.removeEventListener("visibilitychange", onVisible)
  }
}
const readToday = () => keyOf(new Date())
/** Empty on the server so markup never depends on its clock. */
const serverToday = () => ""

/** The viewer's local date, or undefined during server render and hydration. */
export function useToday() {
  const key = useSyncExternalStore(subscribeToday, readToday, serverToday)
  return useMemo(() => (key ? fromKey(key) : undefined), [key])
}
