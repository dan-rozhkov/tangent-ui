"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AnimatePresence, motion } from "motion/react"
import type { Transition } from "motion/react"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"

import { demos } from "@/components/demos"
import { CommandPalette, type CommandItem } from "@/components/ui/command-palette"
import { iconButton, iconGlyph } from "@/components/gallery/icon-button"
import { Dialog } from "@/components/ui/dialog"
import { catalogByCategory } from "@/lib/catalog"
import { motionTokens } from "@/lib/motion-tokens"
import { useReducedMotion } from "@/lib/reduced-motion"

const items: CommandItem[] = catalogByCategory(item => item.name in demos).flatMap(({ label, items }) =>
  items.map(item => ({
    id: item.name,
    label: item.title,
    group: label,
    keywords: [...item.name.split("-"), ...item.description.split(/\W+/)],
  })),
)

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
}

const fade: Transition = { duration: motionTokens.duration.instant }
const leave: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }

/** A header button that opens a modal palette of every ported component. Also opens with Cmd/Ctrl+K, and with "/" outside text fields. */
export function ComponentSearch() {
  const router = useRouter()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      const command = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k"
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)
      if (!command && !slash) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const close = useCallback(() => setOpen(false), [])
  const select = useCallback(
    (item: CommandItem) => {
      setOpen(false)
      router.push(`/components/${item.id}`)
    },
    [router],
  )
  const palette = useMemo(
    () => <CommandPalette items={items} label="Search components" placeholder="Search components" autoFocus onSelect={select} onClose={close} />,
    [select, close],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        // The palette handles Escape itself (clearing the query, or closing); the dialog's own handler must not act on the same press.
        if (!next && details.reason === "escape-key" && details.event.defaultPrevented) {
          details.cancel()
          return
        }
        setOpen(next)
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="Search components"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={iconButton}
      >
        <MagnifyingGlassIcon className={iconGlyph} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal key="search" keepMounted>
            <DialogPrimitive.Backdrop
              className="fixed inset-0 z-50 bg-[oklch(10%_0_0/.46)] backdrop-blur-[7px] data-closed:pointer-events-none!"
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: reduced ? fade : leave }}
                  transition={reduced ? fade : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
                />
              }
            />
            <DialogPrimitive.Popup
              finalFocus={trigger}
              className="fixed top-[15vh] left-1/2 z-51 w-[min(calc(100vw-2rem),560px)] -translate-x-1/2 outline-none data-closed:pointer-events-none!"
              render={
                <motion.div
                  exit={{ opacity: 0, transition: reduced ? fade : leave }}
                />
              }
            >
              <DialogPrimitive.Title className="sr-only">Search components</DialogPrimitive.Title>
              {palette}
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </Dialog>
  )
}
