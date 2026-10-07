"use client"

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AnimatePresence, motion } from "motion/react"
import type { Transition } from "motion/react"
import { X } from "@mynaui/icons-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

/** Mirrors the open state so the content can stay mounted while it animates out, and retarget mid-flight if it is reopened or closed early. */
const OpenContext = createContext<boolean | null>(null)

export type DialogProps = DialogPrimitive.Root.Props

export function Dialog({ open: openProp, defaultOpen = false, onOpenChange, ...props }: DialogProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const open = openProp ?? uncontrolled
  // When the open state last changed. A press on the trigger while the dialog leaves reopens it first,
  // so an outside press that started before that change must not close it again.
  const change = useRef({ open, at: 0 })
  useLayoutEffect(() => {
    change.current = { open, at: performance.now() }
  }, [open])
  const setOpen = useCallback(
    (next: boolean, details: DialogPrimitive.Root.ChangeEventDetails) => {
      if (!next && details.reason === "outside-press" && (!change.current.open || details.event.timeStamp < change.current.at)) {
        details.cancel()
        return
      }
      if (openProp === undefined) setUncontrolled(next)
      onOpenChange?.(next, details)
    },
    [openProp, onOpenChange],
  )
  return (
    <OpenContext.Provider value={open}>
      <DialogPrimitive.Root {...props} open={open} onOpenChange={setOpen} />
    </OpenContext.Provider>
  )
}

export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export interface DialogContentProps extends Omit<DialogPrimitive.Popup.Props, "title" | "children" | "className"> {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

const fade: Transition = { duration: motionTokens.duration.instant }
const leave: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }

/** When the title or description changes while open, the new copy rises in and the old copy leaves upward. */
function SwapText({ text }: { text: string }) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={text}
        className="block"
        initial={reduced ? false : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={
          reduced
            ? { opacity: 0, transition: { duration: 0 } }
            : {
                opacity: 0,
                y: "-0.3em",
                filter: `blur(${motionTokens.blur.subtle}px)`,
                transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
              }
        }
        transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  )
}

/* While the layers leave, clicks pass through, so the trigger can reopen the dialog mid-exit. */
const overlayClass = "fixed inset-0 z-50 bg-[oklch(10%_0_0/.46)] backdrop-blur-[7px] data-closed:pointer-events-none!"

/* Centered with auto margins (like a native modal dialog) so transform stays free for the entrance spring. */
const contentClass = [
  "fixed inset-0 z-51 m-auto h-fit w-[min(calc(100vw-var(--space-8)),440px)] max-h-[calc(100dvh-var(--space-8))] overflow-auto",
  "rounded-surface border border-border bg-surface-raised text-foreground shadow-floating outline-none",
  "data-closed:pointer-events-none!",
].join(" ")

/* Motion animates both layers. These transitions only run when DialogContent sits under a bare Base UI root. */
const overlayFallback = [
  "[transition:opacity_var(--duration-standard)_var(--ease-enter)] data-starting-style:opacity-0",
  "data-ending-style:opacity-0 data-ending-style:[transition:opacity_var(--duration-fast)_var(--ease-standard)]",
  "motion-reduce:[transition:opacity_var(--duration-instant)_var(--ease-standard)]!",
].join(" ")
const contentFallback = [
  "[transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-spring)_var(--ease-spring)]",
  "data-starting-style:opacity-0 data-starting-style:[transform:translateY(8px)_scale(.96)]",
  "data-ending-style:opacity-0 data-ending-style:[transform:translateY(4px)_scale(.98)]",
  "data-ending-style:[transition:opacity_var(--duration-fast)_var(--ease-standard),transform_var(--duration-fast)_var(--ease-standard)]",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_var(--duration-instant)_var(--ease-standard)]!",
].join(" ")

/* A compact icon button: quick press, spring release. The negative margin centres it on the title's first line. */
const closeClass = [
  "my-[calc((var(--text-lg)*var(--leading-body)-var(--space-8))/2)] grid size-8 flex-none cursor-pointer place-items-center",
  "rounded-control border border-border bg-[color-mix(in_oklab,var(--surface-muted)_50%,transparent)] text-text-secondary",
  "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
  "pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
  "active:[transform:scale(.96)] active:[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)]",
  "motion-reduce:transition-none! motion-reduce:active:[transform:none]",
].join(" ")

export function DialogContent({ title, description, children, className, ...props }: DialogContentProps) {
  const open = useContext(OpenContext)
  const reduced = useReducedMotion()
  const inner = (
    <>
      <div className="flex items-start justify-between gap-5 border-b border-border p-6">
        <div>
          {/* Line height sits on the text itself, so a page-level heading reset cannot shrink the title and pull the close button off its line. */}
          <DialogPrimitive.Title className="relative m-0 font-body text-lg leading-body font-medium tracking-body wrap-anywhere [&>span]:leading-body">
            <SwapText text={title} />
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="relative mt-2 mb-0 text-sm leading-body text-text-secondary wrap-anywhere">
              <SwapText text={description} />
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <DialogPrimitive.Close className={closeClass} aria-label="Close dialog">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </DialogPrimitive.Close>
      </div>
      <div className="p-6 text-sm leading-body">{children}</div>
    </>
  )
  // Under a bare Base UI root the open state is unknown here, so CSS transitions keyed off data-starting-style animate the layers instead.
  if (open === null)
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={cn(overlayClass, overlayFallback)} />
        <DialogPrimitive.Popup {...props} className={cn(contentClass, contentFallback, className)}>
          {inner}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    )
  // The overlay fades while the dialog rises 8px and scales up on a spring. Closing is shorter and quieter, and starts from wherever the entrance is.
  // Base UI waits for the Motion opacity animations before it hides the layers, so the portal stays mounted for the whole exit.
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal key="dialog" keepMounted>
          <DialogPrimitive.Backdrop
            className={overlayClass}
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
            {...props}
            className={cn(contentClass, className)}
            render={
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0, transition: fade } : { opacity: 0, y: 4, scale: 0.98, transition: leave }}
                transition={
                  reduced
                    ? fade
                    : {
                        default: motionTokens.spring.smooth,
                        opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] },
                      }
                }
              />
            }
          >
            {inner}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  )
}

