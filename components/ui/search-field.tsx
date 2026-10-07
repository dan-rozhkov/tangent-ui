"use client"

import { forwardRef, useId, useRef } from "react"
import type { InputHTMLAttributes } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Search, X } from "@mynaui/icons-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string
  value: string
  onValueChange: (value: string) => void
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { label, value, onValueChange, id, className, ...props },
  ref
) {
  const generated = useId()
  const controlId = id ?? generated
  const reduced = useReducedMotion()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }
  // Clearing returns focus to the field, since the clear button unmounts under the pointer.
  function clear() {
    onValueChange("")
    inputRef.current?.focus()
  }
  return (
    <div className="grid min-w-0 gap-2">
      <label className="text-sm leading-body font-medium tracking-body" htmlFor={controlId}>
        {label}
      </label>
      {/* Focus darkens the border; the shell never changes size. */}
      <div
        className={cn(
          "group/shell flex min-h-control-md items-center gap-2 rounded-control border border-border-strong bg-surface px-3",
          "transition-[border-color] duration-160 ease-standard motion-reduce:transition-none",
          "focus-within:border-foreground pointer-fine:hover:not-focus-within:border-foreground"
        )}
        data-filled={value ? "true" : undefined}
      >
        {/* The glass wakes up with the field: muted at rest, full contrast while searching. */}
        <Search
          width={18}
          height={18}
          aria-hidden="true"
          className={cn(
            "flex-none text-text-muted transition-colors duration-160 ease-standard motion-reduce:transition-none",
            "group-focus-within/shell:text-foreground group-data-[filled=true]/shell:text-foreground"
          )}
        />
        <input
          {...props}
          ref={setRefs}
          id={controlId}
          type="search"
          value={value}
          onChange={event => onValueChange(event.target.value)}
          className={cn(
            "w-full min-w-0 border-0 bg-transparent tracking-body text-foreground outline-none placeholder:text-text-muted",
            "text-sm [&::-webkit-search-cancel-button]:hidden",
            className
          )}
        />
        {/* The clear button has a reserved slot, so the field never changes width when it appears or leaves. */}
        <span className="grid size-6 flex-none place-items-center">
          <AnimatePresence initial={false}>
            {value ? (
              <motion.button
                key="clear"
                type="button"
                tabIndex={0}
                onClick={clear}
                aria-label="Clear search"
                className={cn(
                  "grid size-6 flex-none cursor-pointer place-items-center rounded-control border-0 bg-transparent text-text-muted",
                  "transition-[background-color,color] duration-160 ease-standard motion-reduce:transition-none",
                  "pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground"
                )}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: `blur(${motionTokens.blur.subtle}px)` }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={
                  reduced
                    ? { opacity: 0, transition: { duration: 0 } }
                    : {
                        opacity: 0,
                        scale: 0.8,
                        filter: `blur(${motionTokens.blur.subtle}px)`,
                        transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
                      }
                }
                whileTap={
                  reduced
                    ? undefined
                    : {
                        scale: 0.96,
                        transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
                      }
                }
                transition={
                  reduced
                    ? { duration: motionTokens.duration.instant }
                    : {
                        ...motionTokens.spring.snappy,
                        opacity: { duration: motionTokens.duration.fast },
                        filter: { duration: motionTokens.duration.fast },
                      }
                }
              >
                <X width={16} height={16} aria-hidden="true" />
              </motion.button>
            ) : null}
          </AnimatePresence>
        </span>
      </div>
    </div>
  )
})

SearchField.displayName = "SearchField"
