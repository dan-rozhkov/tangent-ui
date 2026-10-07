"use client"

import { createContext, useContext, useMemo, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"

type SiteMenuState = {
  open: boolean
  setOpen: (open: boolean) => void
  /** Set by an opener other than the burger, so closing the menu returns focus to it. Cleared after use. */
  returnFocusRef: RefObject<HTMLElement | null>
}

const SiteMenuContext = createContext<SiteMenuState | null>(null)

/** Holds the fullscreen menu's open state, so the header burger and the home hero can both open it. */
export function SiteMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const value = useMemo(() => ({ open, setOpen, returnFocusRef }), [open])
  return <SiteMenuContext.Provider value={value}>{children}</SiteMenuContext.Provider>
}

export function useSiteMenu() {
  const state = useContext(SiteMenuContext)
  if (!state) throw new Error("useSiteMenu must be used inside SiteMenuProvider")
  return state
}
