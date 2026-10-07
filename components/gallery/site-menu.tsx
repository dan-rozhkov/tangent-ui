"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AnimatePresence, motion } from "motion/react"
import { XIcon } from "@phosphor-icons/react"

import { demos } from "@/components/demos"
import { iconButton, iconGlyph } from "@/components/gallery/icon-button"
import { useSiteMenu } from "@/components/gallery/site-menu-context"
import { Dialog } from "@/components/ui/dialog"
import { catalogByCategory, type CatalogItem } from "@/lib/catalog"
import { useMotionTokens, type MotionTokens } from "@/lib/motion-tokens-context"
import { useReducedMotion } from "@/lib/reduced-motion"
import { cn } from "@/lib/utils"

const ported = (item: CatalogItem) => item.name in demos

const sections = [
  { label: "Menu", links: [{ href: "/", title: "Home" }] },
  ...catalogByCategory(ported).map(({ label, items }) => ({
    label,
    links: items.map(item => ({ href: `/components/${item.name}`, title: item.title })),
  })),
]

/** Two-bar menu glyph, drawn on Phosphor's 256 grid at its regular stroke so it sits with the other header icons. */
function MenuGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M40 100h176M40 156h176" />
    </svg>
  )
}

/** Burger button in the site header. Opens a fullscreen menu listing Home and every ported component by category. */
export function SiteMenu() {
  const { open, setOpen, returnFocusRef } = useSiteMenu()
  const pathname = usePathname()
  const { duration, ease, stagger } = useMotionTokens()
  const reduced = useReducedMotion()
  let index = 0

  // The open state lives above the routes, so back/forward navigation must close the menu too.
  useEffect(() => {
    setOpen(false)
  }, [pathname, setOpen])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger aria-label="Open menu" className={cn(iconButton, "-ml-2")}>
        <MenuGlyph className={iconGlyph} />
      </DialogPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal key="menu" keepMounted>
            <DialogPrimitive.Popup
              finalFocus={() => {
                const target = returnFocusRef.current
                returnFocusRef.current = null
                return target?.isConnected ? target : true
              }}
              className="fixed inset-0 z-50 flex flex-col bg-background outline-none data-closed:pointer-events-none!"
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: duration.standard, ease: ease.enter } }}
                  exit={{ opacity: 0, transition: { duration: duration.exit, ease: ease.exit } }}
                />
              }
            >
              <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
              <div className="flex h-14 shrink-0 items-center gap-2 px-4 sm:px-6">
                <DialogPrimitive.Close aria-label="Close menu" className={cn(iconButton, "-ml-2")}>
                  <XIcon className={iconGlyph} aria-hidden="true" />
                </DialogPrimitive.Close>
                <span aria-hidden="true" className="font-display text-base font-medium tracking-display">
                  Menu
                </span>
              </div>
              <nav aria-label="Site" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-6 pb-16 sm:px-6">
                <div className="flex flex-col gap-12">
                  {sections.map(section => (
                    <div key={section.label} className="flex flex-col gap-4">
                      <motion.h2 className="text-sm text-text-muted" {...row(index++, reduced, duration.standard, ease.enter, stagger.item)}>
                        {section.label}
                      </motion.h2>
                      <ul className="flex flex-col gap-3">
                        {section.links.map(link => {
                          const active = pathname === link.href
                          return (
                            <motion.li key={link.href} {...row(index++, reduced, duration.standard, ease.enter, stagger.item)}>
                              <Link
                                href={link.href}
                                onClick={() => {
                                  // The opener may unmount on navigation; let focus fall to the burger instead.
                                  returnFocusRef.current = null
                                  setOpen(false)
                                }}
                                aria-current={active ? "page" : undefined}
                                className="inline-flex items-center gap-3 font-display text-3xl leading-tight font-medium tracking-display text-foreground transition-colors duration-160 ease-standard pointer-fine:hover:text-text-secondary motion-reduce:transition-none"
                              >
                                {link.title}
                                {active && <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />}
                              </Link>
                            </motion.li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </nav>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </Dialog>
  )
}

/** Entrance for one menu row: fade with a small rise, staggered by position and capped so long lists stay quick. */
function row(i: number, reduced: boolean, durationValue: number, easeValue: MotionTokens["ease"]["enter"], step: number) {
  return {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: durationValue, ease: easeValue, delay: Math.min(i, 12) * step },
    },
  }
}
