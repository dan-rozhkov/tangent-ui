"use client"

import { useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { CaretDownIcon } from "@phosphor-icons/react"
import { motion } from "motion/react"
import type { TargetAndTransition, Variants } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface AccordionItem {
  title: string
  content: ReactNode
}
export interface AccordionProps {
  items: AccordionItem[]
  defaultOpen?: number
  /** "lg" suits page-level FAQs: questions at the large text size, answers at body size. */
  size?: "md" | "lg"
}

/** Height follows the content on a spring that never overshoots; closed panels leave the accessibility tree once they finish collapsing. */
const panelOpen: TargetAndTransition = { height: "auto", opacity: 1, visibility: "visible" }
const panelClosed: TargetAndTransition = { height: 0, opacity: 0, transitionEnd: { visibility: "hidden" } }
/** The answer settles down into place with a brief focus pull as the panel opens. */
const contentOpen: TargetAndTransition = { y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }
const contentClosed: TargetAndTransition = { y: -6, filter: `blur(${motionTokens.blur.subtle}px)` }
const panelMotion: Variants = {
  open: {
    ...panelOpen,
    transition: {
      height: motionTokens.spring.smooth,
      opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
    },
  },
  closed: {
    ...panelClosed,
    transition: {
      height: motionTokens.spring.smooth,
      opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
    },
  },
}
const contentMotion: Variants = {
  open: {
    ...contentOpen,
    transition: {
      y: motionTokens.spring.smooth,
      filter: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
    },
  },
  closed: { ...contentClosed, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } },
}
/** Reduced motion: same end states in one step, so server and client render identical styles. */
const panelStill: Variants = {
  open: { ...panelOpen, transition: { duration: 0 } },
  closed: { ...panelClosed, transition: { duration: 0 } },
}
const contentStill: Variants = {
  open: { ...contentOpen, transition: { duration: 0 } },
  closed: { ...contentClosed, transition: { duration: 0 } },
}

/** Base UI dropped roving focus between accordion triggers; this keeps the arrow, Home, and End moves, wrapping at the ends. */
function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
  const root = event.currentTarget
  const target = event.target as HTMLElement
  const triggers = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-accordion-trigger]")).filter(
    trigger => trigger.closest("[data-tg-accordion]") === root && !trigger.disabled,
  )
  const current = triggers.indexOf(target as HTMLButtonElement)
  if (current < 0) return
  event.preventDefault()
  const last = triggers.length - 1
  const next =
    event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowDown" ? (current + 1) % triggers.length : current - 1 < 0 ? last : current - 1
  triggers[next]?.focus()
}

export function Accordion({ items, defaultOpen = 0, size = "md" }: AccordionProps) {
  const initialValue = defaultOpen >= 0 && defaultOpen < items.length ? String(defaultOpen) : ""
  const [openValue, setOpenValue] = useState(initialValue)
  const reduced = useReducedMotion()
  const lg = size === "lg"
  return (
    <AccordionPrimitive.Root
      data-tg-accordion=""
      className="w-full border-t border-border"
      value={openValue ? [openValue] : []}
      onValueChange={value => setOpenValue(value[0] ?? "")}
      onKeyDown={moveFocus}
    >
      {items.map((item, index) => {
        const open = openValue === String(index)
        return (
          <AccordionPrimitive.Item className="border-b border-border" value={String(index)} key={`${item.title}-${index}`}>
            <AccordionPrimitive.Header className="m-0">
              <AccordionPrimitive.Trigger
                data-accordion-trigger=""
                className={cn(
                  "group/trigger flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-0 text-left",
                  "[font:inherit] font-medium text-foreground [-webkit-tap-highlight-color:transparent]",
                  "transition-colors duration-160 ease-standard motion-reduce:transition-none pointer-fine:hover:text-text-secondary",
                  lg
                    ? "min-h-[76px] gap-8 py-5 text-(length:--text-lg) leading-body tracking-body max-[520px]:min-h-[68px] max-[520px]:text-(length:--text-base)"
                    : "min-h-control-lg gap-5 py-2 text-(length:--text-sm) leading-body",
                )}
              >
                <span>{item.title}</span>
                {/* Rotation is driven by a spring; CSS only handles color. */}
                <motion.span
                  className={cn(
                    "inline-flex flex-none text-text-muted transition-colors duration-160 ease-standard motion-reduce:transition-none",
                    "group-data-panel-open/trigger:text-foreground pointer-fine:group-hover/trigger:text-foreground",
                  )}
                  initial={false}
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                >
                  <CaretDownIcon size={17} aria-hidden="true" />
                </motion.span>
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            {/* Base UI keeps semantics and ids; motion owns the height so a toggle mid-flight retargets instead of restarting.
                The panel stays mounted and never takes the hidden attribute: motion collapses it, then hides it with visibility. */}
            <AccordionPrimitive.Panel
              keepMounted
              hidden={false}
              className={cn(
                "overflow-hidden text-text-secondary",
                lg
                  ? "text-(length:--text-base) leading-[1.65] max-[520px]:text-(length:--text-sm)"
                  : "text-(length:--text-sm) leading-body",
              )}
              render={
                <motion.div initial={false} animate={open ? "open" : "closed"} variants={reduced ? panelStill : panelMotion} />
              }
            >
              <motion.div
                className={cn("[overflow-wrap:anywhere]", lg ? "max-w-[62ch] pr-12 pb-6 max-[520px]:pr-6" : "pr-8 pb-5")}
                variants={reduced ? contentStill : contentMotion}
              >
                {item.content}
              </motion.div>
            </AccordionPrimitive.Panel>
          </AccordionPrimitive.Item>
        )
      })}
    </AccordionPrimitive.Root>
  )
}

export default Accordion
