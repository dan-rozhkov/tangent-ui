"use client"

import Link from "next/link"
import type { MouseEvent } from "react"
import { ChevronRight as NavArrowRight } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
  /** Runs when the crumb is chosen. Without an href the crumb renders as a button, for paths that live in local state. */
  onClick?: (event: MouseEvent<HTMLElement>) => void
}
export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  ariaLabel?: string
}

/* Each crumb reserves the width of its medium weight label, so becoming the current page never shifts the path. */
const crumb =
  "inline-flex flex-col rounded-[7px] px-0.5 py-1 after:pointer-events-none after:invisible after:h-0 after:overflow-hidden after:font-medium after:select-none after:content-[attr(data-label)]"
const interactive = cn(
  crumb,
  "text-text-secondary underline decoration-1 decoration-transparent underline-offset-4",
  "transition-[color,text-decoration-color] duration-160 ease-standard motion-reduce:transition-none",
  "pointer-fine:hover:text-accent-strong pointer-fine:hover:decoration-[color-mix(in_oklab,currentColor_45%,transparent)]",
)

/** Crumbs present on first render stay still; crumbs added later slide in from the path before them. */
export function Breadcrumb({ items, ariaLabel = "Breadcrumb" }: BreadcrumbProps) {
  const reduced = useReducedMotion() ?? false
  const still = { duration: 0 }
  const path = items.map((item) => item.label).join("/")
  return (
    <nav aria-label={ariaLabel}>
      {/* The gap between crumbs matches the gap inside one, so every chevron sits centered between its two labels. */}
      <ol className="relative m-0 flex list-none flex-wrap items-center gap-x-1.5 gap-y-0.5 p-0">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item, index) => {
            const current = index === items.length - 1
            return (
              <motion.li
                key={`${item.label}-${index}`}
                className="inline-flex items-center gap-1.5 text-(length:--text-sm) leading-body whitespace-nowrap text-text-muted"
                layout={reduced ? false : "position"}
                layoutDependency={path}
                initial={reduced ? false : { opacity: 0, x: -8, filter: `blur(${motionTokens.blur.subtle}px)` }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={
                  reduced
                    ? { opacity: 0, transition: still }
                    : {
                        opacity: 0,
                        x: -4,
                        filter: `blur(${motionTokens.blur.subtle}px)`,
                        transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
                      }
                }
                transition={reduced ? still : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], layout: motionTokens.spring.smooth }}
              >
                {index > 0 && <NavArrowRight className="size-4 flex-none text-border-strong [&]:stroke-[1.75]" width={14} height={14} aria-hidden="true" />}
                {!current && item.href ? (
                  <Link href={item.href} className={interactive} data-label={item.label} onClick={item.onClick}>
                    {item.label}
                  </Link>
                ) : !current && item.onClick ? (
                  <button
                    type="button"
                    className={cn(interactive, "m-0 cursor-pointer border-0 bg-none text-start font-[family-name:inherit] [font-weight:inherit] leading-[inherit]")}
                    data-label={item.label}
                    onClick={item.onClick}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span
                    className={cn(
                      crumb,
                      current && "font-medium text-accent-strong transition-[color] duration-160 ease-standard motion-reduce:transition-none",
                    )}
                    aria-current={current ? "page" : undefined}
                    data-label={item.label}
                  >
                    {item.label}
                  </span>
                )}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
    </nav>
  )
}

export default Breadcrumb
