"use client"

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent, ReactNode, RefObject } from "react"
import { flushSync } from "react-dom"
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react"
import type { MotionValue } from "motion/react"
import { Search, X } from "lucide-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

export interface ExpandingSearchItem {
  id: string
  title: string
  /** One short line under the title, such as the type, owner, or last edit. */
  meta?: string
  /** Results gather under this heading, in the order groups first appear in `items`. */
  group?: string
  icon?: ReactNode
  /** Extra words that should also find this item. */
  keywords?: string[]
}

/**
 * A search that waits as an icon button until it is needed. Use it in headers and toolbars where a full field would crowd the layout.
 * The button morphs into the field, results unfold beneath it, and Escape, choosing a result, or leaving the field empty folds it back into the icon.
 * Place it in the space the field may grow into; it fills that space's width and keeps the button on the `anchor` edge.
 */
export interface ExpandingSearchProps {
  /** Names the button, the field, and the results, such as "Search projects and docs". */
  label: string
  items: ExpandingSearchItem[]
  /** Shown before anything is typed, such as recent searches. */
  suggestions?: ExpandingSearchItem[]
  suggestionsLabel?: string
  placeholder?: string
  onSelect?: (item: ExpandingSearchItem) => void
  onExpandedChange?: (expanded: boolean) => void
  /** The widest the field grows. It never grows past its container. */
  expandedWidth?: number
  maxResults?: number
  /** The edge the button sits on; the field grows away from it. */
  anchor?: "start" | "end"
  /** A short tip under the empty state. */
  emptyHint?: string
  className?: string
}

type Group = { name: string; items: ExpandingSearchItem[] }
type Mode = "suggestions" | "results" | "empty"

const enter = [...motionTokens.ease.enter] as [number, number, number, number]
const standard = [...motionTokens.ease.standard] as [number, number, number, number]
const FALLBACK_SIZE = 44

/** Title starts beat word starts, which beat matches inside a word, which beat keyword and meta matches. Ties keep the original order. */
function rank(items: ExpandingSearchItem[], query: string, limit: number) {
  const q = query.toLocaleLowerCase()
  const scored: { item: ExpandingSearchItem; score: number; order: number }[] = []
  items.forEach((item, order) => {
    const title = item.title.toLocaleLowerCase()
    const at = title.indexOf(q)
    const extra = [item.meta ?? "", ...(item.keywords ?? [])].some(word => word.toLocaleLowerCase().includes(q))
    const score = at === 0 ? 0 : at > 0 && /[\s\-/]/.test(title[at - 1]) ? 1 : at > 0 ? 2 : extra ? 3 : -1
    if (score >= 0) scored.push({ item, score, order })
  })
  return scored
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, limit)
    .map(entry => entry.item)
}

function groupBy(list: ExpandingSearchItem[], source: ExpandingSearchItem[]): Group[] {
  const order = new Map<string, number>()
  source.forEach((item, index) => {
    const name = item.group ?? ""
    if (!order.has(name)) order.set(name, index)
  })
  const groups = new Map<string, ExpandingSearchItem[]>()
  list.forEach(item => {
    const name = item.group ?? ""
    groups.set(name, [...(groups.get(name) ?? []), item])
  })
  return [...groups].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0)).map(([name, items]) => ({ name, items }))
}

function Match({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-medium text-foreground">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  )
}

/** The panel shares the field's width value, so on first open it unfolds out of the field; afterwards only its height follows the content.
 *  A floating layer: its content keeps the final width and rides the leading edge. */
function Panel({ width, reduced, start, children }: { width: MotionValue<number>; reduced: boolean; start: boolean; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const height = useMotionValue(0)
  useLayoutEffect(() => {
    const panel = panelRef.current,
      body = bodyRef.current
    if (!panel || !body || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      const next = body.offsetHeight + panel.offsetHeight - panel.clientHeight
      if (reduced) height.jump(next)
      else animate(height, next, motionTokens.spring.smooth)
    })
    observer.observe(body)
    return () => observer.disconnect()
  }, [height, reduced])
  // Reduced motion skips the unfold: the panel is its content's height from the first frame and only fades.
  return (
    <motion.div
      ref={panelRef}
      className={cn(
        "pointer-events-auto absolute top-[calc(100%+8px)] z-40 overflow-hidden rounded-panel border border-border bg-surface-raised shadow-floating",
        start ? "left-0" : "right-0",
      )}
      style={{ width, height: reduced ? "auto" : height }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: reduced ? 0.15 : motionTokens.duration.fast, ease: enter } }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.1 : motionTokens.duration.instant, ease: standard } }}
    >
      <div
        ref={bodyRef}
        className="relative max-h-[min(22rem,60vh)] w-[calc(var(--es-width,360px)-2px)] overflow-x-hidden overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]"
      >
        {children}
      </div>
    </motion.div>
  )
}

/** Offsets ignore transforms, so they describe where rows sit in the list, not where a gliding row happens to be mid-flight. */
function offsetWithin(node: HTMLElement, container: HTMLElement) {
  let top = 0
  let current: HTMLElement | null = node
  while (current && current !== container) {
    top += current.offsetTop
    current = current.offsetParent as HTMLElement | null
  }
  return top
}

interface ListboxProps {
  id: string
  label: string
  groups: Group[]
  query: string
  activeIndex: number
  optionId: (item: ExpandingSearchItem) => string
  reduced: boolean
  keyboard: RefObject<boolean>
  onHover: (index: number) => void
  onChoose: (item: ExpandingSearchItem) => void
}

function Listbox({ id, label, groups, query, activeIndex, optionId, reduced, keyboard, onHover, onChoose }: ListboxProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const flat = groups.flatMap(group => group.items)
  const layoutKey = flat.map(item => item.id).join("|")
  const activeItem = flat[activeIndex]
  const activeId = activeItem ? optionId(activeItem) : ""
  /** The highlight lives inside the active row, so it rides that row wherever it glides. Moving to another row, it starts where the old one was and springs home. */
  const travel = useMotionValue(0)
  const fade = useMotionValue(1)
  const last = useRef<{ id: string; set: string; top: number } | null>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    const row = activeId ? document.getElementById(activeId) : null
    if (!list || !row) {
      last.current = null
      return
    }
    const top = offsetWithin(row, list)
    const previous = last.current
    last.current = { id: activeId, set: layoutKey, top }
    // Same row: its highlight is already in place, and any travel still in flight stays relative to it.
    if (previous?.id === activeId) return
    if (previous && previous.set === layoutKey && !reduced) {
      const velocity = travel.getVelocity()
      travel.jump(previous.top + travel.get() - top)
      animate(travel, 0, { ...motionTokens.spring.snappy, velocity })
    } else {
      // Nothing was highlighted, or new results arrived: it fades in on its row, without travel.
      travel.jump(0)
      if (reduced) fade.jump(1)
      else {
        fade.jump(0)
        animate(fade, 1, { duration: motionTokens.duration.instant, ease: enter })
      }
    }
    if (keyboard.current) row.scrollIntoView({ block: "nearest" })
  }, [activeId, layoutKey, reduced, travel, fade, keyboard])

  return (
    /* A flex gap, not margins: a group popping out while it leaves never lets the next one's margin collapse through the list. */
    <div ref={listRef} id={id} role="listbox" aria-label={label} className="relative isolate flex flex-col gap-1">
      <AnimatePresence mode="popLayout" initial={false}>
        {groups.map(group => {
          const headingId = `${id}-${group.name || "results"}`.replace(/\s+/g, "-")
          return (
            <motion.div
              key={group.name}
              role="group"
              aria-labelledby={group.name ? headingId : undefined}
              className="relative"
              layout={reduced ? false : "position"}
              layoutDependency={layoutKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ opacity: { duration: motionTokens.duration.fast, ease: enter }, layout: motionTokens.spring.smooth }}
            >
              {group.name && (
                <div id={headingId} className="px-3 pt-2 pb-1 text-xs leading-body font-medium text-text-muted" role="presentation">
                  {group.name}
                </div>
              )}
              <AnimatePresence mode="popLayout" initial={false}>
                {group.items.map(item => {
                  const position = flat.indexOf(item)
                  const active = position === activeIndex
                  return (
                    /* Nested corners step down from the panel by its inset. The highlight paints under every row's content, so text never hides while it travels. */
                    <motion.div
                      key={item.id}
                      id={optionId(item)}
                      role="option"
                      aria-selected={active}
                      data-active={active || undefined}
                      className="relative flex min-h-12 cursor-pointer items-center gap-3 rounded-[calc(var(--radius-panel)-6px)] px-3 py-1.5 text-foreground select-none [-webkit-tap-highlight-color:transparent]"
                      layout={reduced ? false : "position"}
                      layoutDependency={layoutKey}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.08 } }}
                      transition={{ opacity: { duration: motionTokens.duration.fast, ease: enter }, layout: motionTokens.spring.smooth }}
                      onPointerMove={() => {
                        if (!active) {
                          keyboard.current = false
                          onHover(position)
                        }
                      }}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => onChoose(item)}
                    >
                      {active && (
                        <motion.span
                          className="pointer-events-none absolute inset-0 -z-1 rounded-[inherit] bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]"
                          style={{ y: travel, opacity: fade }}
                          aria-hidden="true"
                        />
                      )}
                      {item.icon && (
                        <span
                          className={cn(
                            "grid w-[18px] flex-none place-items-center [transition:color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
                            active ? "text-foreground" : "text-text-muted",
                          )}
                          aria-hidden="true"
                        >
                          {item.icon}
                        </span>
                      )}
                      <span className="grid min-w-0">
                        <span className="truncate text-sm leading-body text-foreground">
                          <Match text={item.title} query={query} />
                        </span>
                        {item.meta && <span className="truncate text-xs leading-body text-text-muted">{item.meta}</span>}
                      </span>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export function ExpandingSearch({
  label,
  items,
  suggestions = [],
  suggestionsLabel = "Recent",
  placeholder,
  onSelect,
  onExpandedChange,
  expandedWidth = 360,
  maxResults = 6,
  anchor = "end",
  emptyHint = "Try a shorter word or check the spelling.",
  className,
}: ExpandingSearchProps) {
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const rootRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [focused, setFocused] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(-1)
  const open = useRef(false)
  const size = useRef({ collapsed: FALLBACK_SIZE, expanded: expandedWidth })
  const width = useMotionValue(FALLBACK_SIZE)
  /** True while the last highlight move came from the keyboard, so only keyboard moves scroll the list. */
  const keyboard = useRef(false)

  // The corner radius follows the width: a circle while collapsed, the control radius once open. It rides the same spring, so the two never drift apart.
  const syncShape = useCallback((value: number) => {
    const { collapsed, expanded: full } = size.current
    shellRef.current?.style.setProperty(
      "--es-open",
      String(Math.min(1, Math.max(0, (value - collapsed) / Math.max(1, full - collapsed)))),
    )
  }, [])
  useMotionValueEvent(width, "change", syncShape)

  // The field grows to its own limit or its container, whichever is smaller. Container resizes are followed at once; they are not the person's action.
  useLayoutEffect(() => {
    const root = rootRef.current,
      shell = shellRef.current
    if (!root || !shell) return
    const measure = () => {
      const collapsed = shell.offsetHeight || FALLBACK_SIZE
      const full = Math.max(collapsed, Math.min(expandedWidth, root.clientWidth))
      size.current = { collapsed, expanded: full }
      root.style.setProperty("--es-width", `${full}px`)
      const goal = open.current ? full : collapsed
      if (width.isAnimating()) animate(width, goal, motionTokens.spring.morph)
      else width.jump(goal)
      syncShape(width.get())
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [expandedWidth, width, syncShape])

  // Opening grows on the morph spring with a hint of overshoot; folding back settles without one, so the circle never dips below its own size.
  const morphTo = (goal: number) => {
    if (reduced) width.jump(goal)
    else animate(width, goal, goal >= width.get() ? motionTokens.spring.morph : motionTokens.spring.smooth)
  }

  // Focus moves inside the same click, so touch keyboards open; the field is inert until this flush makes it focusable.
  function expand() {
    if (open.current) return
    open.current = true
    flushSync(() => {
      setExpanded(true)
      setFocused(true)
    })
    inputRef.current?.focus({ preventScroll: true })
    morphTo(size.current.expanded)
    onExpandedChange?.(true)
  }

  function collapse(returnFocus: boolean) {
    if (!open.current) return
    open.current = false
    flushSync(() => {
      setExpanded(false)
      setFocused(false)
      setQuery("")
      setActive(-1)
    })
    if (returnFocus) buttonRef.current?.focus({ preventScroll: true })
    morphTo(size.current.collapsed)
    onExpandedChange?.(false)
  }

  const trimmed = query.trim()
  const results = useMemo(() => (trimmed ? rank(items, trimmed, maxResults) : []), [items, trimmed, maxResults])
  const mode: Mode | null = !trimmed ? (suggestions.length ? "suggestions" : null) : results.length ? "results" : "empty"
  const groups = useMemo<Group[]>(
    () =>
      mode === "suggestions"
        ? [{ name: suggestionsLabel, items: suggestions }]
        : mode === "results"
          ? groupBy(results, items)
          : [],
    [mode, suggestions, suggestionsLabel, results, items],
  )
  const flat = groups.flatMap(group => group.items)
  const activeIndex = Math.min(active, flat.length - 1)
  const activeItem = flat[activeIndex]
  const optionId = (item: ExpandingSearchItem) => `${id}-${mode}-${item.id}`
  const listboxId = `${id}-${mode}-listbox`
  const panelOpen = expanded && focused && mode !== null
  const announcement = !panelOpen
    ? ""
    : mode === "empty"
      ? `No results for ${trimmed}`
      : mode === "results"
        ? `${flat.length} ${flat.length === 1 ? "result" : "results"}`
        : `${flat.length} ${suggestionsLabel.toLocaleLowerCase()} ${flat.length === 1 ? "item" : "items"}`

  function choose(item: ExpandingSearchItem) {
    collapse(true)
    onSelect?.(item)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      collapse(true)
      return
    }
    if (!panelOpen || !flat.length) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      keyboard.current = true
      setActive(activeIndex < 0 ? (step > 0 ? 0 : flat.length - 1) : (activeIndex + step + flat.length) % flat.length)
    } else if (event.key === "Enter" && activeItem) {
      event.preventDefault()
      choose(activeItem)
    }
  }

  const clearHidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }
  const start = anchor === "start"

  return (
    /* The root is the lane the field may grow into. Only the shell and the panel take pointer events, so an idle lane never blocks what sits under it. */
    <div
      ref={rootRef}
      className={cn("pointer-events-none relative h-control-md w-full min-w-control-md", className)}
      data-anchor={anchor}
    >
      {/* One shell is both the button and the field. Its width rides a spring and its radius follows the width, from a circle to the control radius. */}
      <motion.div
        ref={shellRef}
        className={cn(
          "pointer-events-auto absolute top-0 h-full overflow-hidden border border-border bg-surface text-text-secondary",
          "rounded-[calc(var(--control-height-md)_/_2_-_(var(--control-height-md)_/_2_-_var(--radius-control))_*_var(--es-open,0))]",
          "[transition:border-color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard),box-shadow_var(--duration-standard)_var(--ease-standard),transform_var(--duration-spring)_var(--ease-spring)]",
          "motion-reduce:transition-none",
          start ? "left-0" : "right-0",
          expanded
            ? "border-border-strong text-foreground pointer-fine:hover:not-has-[>input:focus]:border-foreground"
            : [
                "pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
                // A compact press while it is still a button; the morph takes over on release.
                "motion-safe:has-[>[data-slot=trigger]:active]:[transform:scale(.97)]",
                "has-[>[data-slot=trigger]:active]:[transition-duration:var(--duration-fast),var(--duration-fast),var(--duration-fast),var(--duration-standard),var(--duration-instant)]",
              ],
          "has-[>[data-slot=trigger]:focus-visible]:border-foreground has-[>[data-slot=trigger]:focus-visible]:text-foreground has-[>[data-slot=trigger]:focus-visible]:shadow-[0_0_0_3px_var(--focus-ring)]",
          "has-[>input:focus]:border-foreground has-[>input:focus]:text-foreground has-[>input:focus]:shadow-[0_0_0_3px_var(--focus-ring)]",
        )}
        data-expanded={expanded || undefined}
        style={{ width }}
      >
        <button
          ref={buttonRef}
          type="button"
          data-slot="trigger"
          className="absolute inset-0 z-1 m-0 cursor-pointer rounded-[inherit] border-0 bg-transparent p-0 outline-none [-webkit-tap-highlight-color:transparent]"
          aria-label={label}
          hidden={expanded}
          onClick={expand}
        />
        {/* The glass sits at the leading edge, so it is centered in the circle and rides that edge to its place in the open field. */}
        <Search
          className="pointer-events-none absolute top-[calc(50%-9px)] left-[calc(var(--control-height-md)_/_2_-_10px)]"
          width={18}
          height={18}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        {/* The placeholder waits for the shape to start moving, then fades in; on close it leaves first. */}
        <motion.input
          ref={inputRef}
          className="absolute inset-0 m-0 size-full border-0 bg-transparent py-0 pr-10 pl-[38px] text-sm leading-body tracking-body text-ellipsis text-foreground outline-none placeholder:text-text-muted placeholder:opacity-100 [&[inert]]:pointer-events-none"
          type="text"
          role="combobox"
          inert={!expanded}
          value={query}
          placeholder={placeholder ?? label}
          aria-label={label}
          aria-expanded={panelOpen}
          aria-controls={panelOpen && mode !== "empty" ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={panelOpen && activeItem ? optionId(activeItem) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          initial={false}
          animate={{ opacity: expanded ? 1 : 0 }}
          transition={
            expanded
              ? { duration: reduced ? 0.15 : 0.2, ease: enter, delay: reduced ? 0 : 0.08 }
              : { duration: reduced ? 0.1 : 0.08, ease: standard }
          }
          onChange={event => {
            const next = event.target.value
            setQuery(next)
            setActive(next.trim() ? 0 : -1)
            keyboard.current = false
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Switching windows keeps the search as it was; the field refocuses on return.
            if (typeof document !== "undefined" && !document.hasFocus()) return
            setFocused(false)
            if (open.current && !inputRef.current?.value.trim()) collapse(false)
          }}
          onKeyDown={handleKeyDown}
        />
        <AnimatePresence initial={false}>
          {expanded && query && (
            <motion.button
              key="clear"
              type="button"
              tabIndex={-1}
              className={cn(
                "absolute top-[calc(50%-14px)] right-[7px] z-1 m-0 grid size-7 cursor-pointer place-items-center rounded-pill border-0 bg-transparent p-0 text-text-muted [-webkit-tap-highlight-color:transparent]",
                "[transition:background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
                "pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground",
              )}
              aria-label="Clear search"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                setQuery("")
                setActive(-1)
                inputRef.current?.focus({ preventScroll: true })
              }}
              initial={clearHidden}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ ...clearHidden, transition: { duration: reduced ? 0.1 : motionTokens.duration.instant, ease: standard } }}
              transition={
                reduced
                  ? { duration: 0.15 }
                  : {
                      ...motionTokens.spring.snappy,
                      opacity: { duration: motionTokens.duration.fast },
                      filter: { duration: motionTokens.duration.fast },
                    }
              }
            >
              <X width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      <AnimatePresence>
        {panelOpen && (
          <Panel key="panel" width={width} reduced={reduced} start={start}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={mode}
                className="relative"
                initial={reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, transition: { duration: 0.1, ease: standard } }}
                transition={{ duration: reduced ? 0.15 : motionTokens.duration.fast, ease: enter }}
              >
                {mode === "empty" ? (
                  <div className="grid gap-0.5 px-3 pt-3 pb-[14px]">
                    <p className="m-0 text-sm leading-body font-medium wrap-anywhere text-foreground">No results for “{trimmed}”</p>
                    <p className="m-0 text-xs leading-body text-text-muted">{emptyHint}</p>
                  </div>
                ) : (
                  <Listbox
                    id={listboxId}
                    label={mode === "suggestions" ? suggestionsLabel : `Results for ${trimmed}`}
                    groups={groups}
                    query={mode === "results" ? trimmed : ""}
                    activeIndex={activeIndex}
                    optionId={optionId}
                    reduced={reduced}
                    keyboard={keyboard}
                    onHover={setActive}
                    onChoose={choose}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </Panel>
        )}
      </AnimatePresence>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}

export default ExpandingSearch
