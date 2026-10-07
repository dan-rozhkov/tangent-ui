"use client"

import { useSiteMenu } from "@/components/gallery/site-menu-context"

/** The home hero's call to action: opens the fullscreen component menu, and gets focus back when it closes. */
export function OpenMenuButton() {
  const { open, setOpen, returnFocusRef } = useSiteMenu()
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={event => {
        returnFocusRef.current = event.currentTarget
        setOpen(true)
      }}
      className="inline-flex h-control-md cursor-pointer items-center rounded-control bg-foreground px-5 text-sm font-medium text-background transition-opacity duration-160 [-webkit-tap-highlight-color:transparent] hover:opacity-90"
    >
      Browse components
    </button>
  )
}
