"use client"

import { useEffect, useId, useLayoutEffect, useRef } from "react"
import { animate, motion } from "motion/react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface RadioGroupProps {
  label: string
  options: { value: string; label: string; description?: string }[]
  value: string
  onValueChange: (value: string) => void
  name?: string
}

/** Sizes the highlight to the chosen row. A new choice glides on the morph spring; the first paint and resizes place it at once. */
function place(highlight: HTMLElement | null, row: HTMLElement | null | undefined, at: { current: string }, glide: boolean) {
  const next = row ? `${row.offsetTop} ${row.offsetHeight}` : ""
  if (!highlight || next === at.current) return
  const visible = at.current !== ""
  at.current = next
  if (!row) {
    animate(highlight, { opacity: 0 }, { duration: 0 })
    return
  }
  const target = { y: row.offsetTop, height: row.offsetHeight, opacity: 1 }
  if (glide && visible) {
    animate(highlight, target, { ...motionTokens.spring.morph, opacity: { duration: 0 } })
    return
  }
  // Written to the element too, so the paint that drops the server fallback already shows the highlight in place.
  Object.assign(highlight.style, { transform: `translateY(${target.y}px)`, height: `${target.height}px`, opacity: "1" })
  animate(highlight, target, { duration: 0 })
}

/** One highlight travels to the chosen row while the new dot springs in and the old one shrinks away, so a change reads as a single physical move. Arrow keys take the same path. Rows and text never resize. */
export function RadioGroup({ label, options, value, onValueChange, name }: RadioGroupProps) {
  const id = useId()
  const reduced = useReducedMotion()
  const listRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)
  const rows = useRef<(HTMLLabelElement | null)[]>([])
  const shown = useRef<number | null>(null)
  const at = useRef("")
  const selected = options.findIndex(option => option.value === value)
  useLayoutEffect(() => {
    place(highlightRef.current, rows.current[selected], at, shown.current !== null && shown.current !== selected && !reduced)
    shown.current = selected
    listRef.current?.setAttribute("data-ready", "")
  }, [selected, reduced])
  useEffect(() => {
    const list = listRef.current
    if (!list || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => place(highlightRef.current, rows.current[shown.current ?? -1], at, false))
    observer.observe(list)
    rows.current.forEach(row => row && observer.observe(row))
    return () => observer.disconnect()
  }, [options.length])
  return (
    <fieldset className="m-0 grid min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 text-sm font-medium">{label}</legend>
      {/* One highlight travels between the rows: above their borders and fills, below their text, so it never crosses a label. */}
      <div ref={listRef} className="relative grid gap-2">
        <span
          ref={highlightRef}
          className={cn(
            "pointer-events-none absolute top-0 right-0 left-0 z-1 box-border rounded-control border border-control-on opacity-0",
            "bg-[color-mix(in_oklab,var(--control-on)_5%,transparent)]",
          )}
          aria-hidden="true"
        />
        {options.map((option, index) => {
          const checked = value === option.value
          return (
            /* Rows answer a press with color only; the mark is what moves.
               The mark sits centered on the left edge of the row, whether or not the option has a description. */
            <label
              className={cn(
                "group/option relative flex cursor-pointer items-center gap-3 rounded-control border border-border p-3 [-webkit-tap-highlight-color:transparent]",
                "transition-[background-color,border-color] duration-160 ease-standard motion-reduce:transition-none",
                "pointer-fine:hover:bg-surface-muted active:bg-surface-muted",
                // Until the highlight is placed (server paint or no script), the checked row carries the same look itself.
                checked && "[:not([data-ready])>&]:border-control-on",
                checked && "[:not([data-ready])>&]:bg-[color-mix(in_oklab,var(--control-on)_5%,transparent)]",
              )}
              key={option.value}
              ref={node => {
                rows.current[index] = node
              }}
            >
              <input
                className="absolute opacity-0"
                type="radio"
                name={name ?? id}
                value={option.value}
                checked={checked}
                onChange={() => onValueChange(option.value)}
              />
              {/* Rows are not stacking contexts, so their mark and copy rise above the highlight while their border and fill stay below it. */}
              <span
                className={cn(
                  "relative z-2 grid size-[17px] flex-none place-items-center rounded-full border border-border-strong",
                  "[transition:border-color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
                  // 7px keeps the dot on whole pixels inside the 15px interior of the mark.
                  // A faint dot previews the choice while the pointer is down, then the real dot springs in on release.
                  "after:size-[7px] after:rounded-full after:bg-foreground after:opacity-0 after:[grid-area:1/1]",
                  "after:transition-opacity after:duration-120 after:ease-standard",
                  !checked && "group-active/option:after:opacity-22",
                  // The mark alone answers a press: a quick dip, then a spring back.
                  "motion-safe:group-active/option:[transform:scale(.88)]",
                  "motion-safe:group-active/option:[transition:border-color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard),transform_100ms_var(--ease-standard)]",
                  "motion-reduce:transition-none motion-reduce:after:transition-none",
                  checked && "border-control-on bg-control-on",
                )}
                aria-hidden="true"
              >
                <motion.span
                  className={cn("size-[7px] rounded-full [grid-area:1/1]", checked ? "bg-control-glyph" : "bg-foreground")}
                  initial={false}
                  animate={checked ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          ...motionTokens.spring.snappy,
                          opacity: { duration: checked ? motionTokens.duration.fast : motionTokens.duration.instant },
                        }
                  }
                />
              </span>
              <span className="relative z-2">
                <strong
                  className={cn(
                    "block text-sm font-medium transition-[color] duration-240 ease-standard motion-reduce:transition-none",
                    checked ? "text-foreground" : "text-text-secondary",
                  )}
                >
                  {option.label}
                </strong>
                {option.description && <small className="mt-0.5 block text-xs text-text-muted">{option.description}</small>}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
