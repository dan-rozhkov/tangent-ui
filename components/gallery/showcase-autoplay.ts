/**
 * Scripted playback for the home showcase: a script drives a live demo through the same DOM events a person would
 * fire (taps, hovers, drags, typing), so the real component code animates without any autoplay hooks of its own.
 */

export interface AutoplayContext {
  /** The tile element the demo renders into. */
  root: HTMLElement
  /** Aborts when the viewer takes over, the tile replays, or it unmounts. */
  signal: AbortSignal
  /** Resolves after `ms`, or rejects once the run is aborted. */
  wait(ms: number): Promise<void>
  /** Waits for the first element matching a CSS selector inside the tile. */
  find(selector: string, options?: FindOptions): Promise<HTMLElement>
  /**
   * Waits for an element (optionally narrowed by `selector`) whose trimmed text content matches `text`. With several
   * matches it takes the last in document order, so a label wins over the wrapper that also contains its text.
   */
  findByText(text: string | RegExp, selector?: string, options?: FindOptions): Promise<HTMLElement>
  /** Waits for the first element whose aria-label matches `label`. */
  findByLabel(label: string | RegExp, options?: FindOptions): Promise<HTMLElement>
  /**
   * A click at the element's centre, without pointerdown: other tiles run at the same time, and a synthetic
   * pointerdown reaching the document reads as an outside press to any popover open in them.
   */
  tap(element: Element): Promise<void>
  /** Full press: pointerdown, mousedown, pointerup, mouseup, click. Only for controls that act on pointerdown. */
  pressTap(element: Element): Promise<void>
  /** Plain element.click(), for controls that only listen to click. */
  click(element: Element): void
  /** Pointer and mouse over/enter at the element's centre. */
  hover(element: Element): void
  /** Pointer and mouse out/leave. */
  unhover(element: Element): void
  /** Press, move by (dx, dy) over `duration` ms with an ease-in-out curve, release. */
  drag(element: Element, options: DragOptions): Promise<void>
  /** Press at the first point, move through the rest over `duration` ms at an even pace, release. Points are relative to the element's top-left. */
  trace(element: Element, points: { x: number; y: number }[], options?: { duration?: number; pointerType?: "mouse" | "touch" | "pen" }): Promise<void>
  /** Types `text` one character at a time into an input or textarea, firing React-visible input events. */
  type(element: Element, text: string, options?: { delay?: number }): Promise<void>
  /** keydown + keyup for `key` on the element (or the focused element). */
  press(key: string, element?: Element | null, init?: KeyboardEventInit): void
}

export interface FindOptions {
  /** Give up after this many ms. Defaults to 10000, which covers the demo's lazy chunk loading on a slow connection. */
  timeout?: number
  /** Search the whole document instead of the tile, for content portalled out of it. */
  global?: boolean
}

export interface DragOptions {
  dx?: number
  dy?: number
  duration?: number
  /** Start point relative to the element's top-left; defaults to its centre. */
  from?: { x: number; y: number }
  /** Hold still this long after pressing, for press-and-hold gestures. */
  hold?: number
  /** Skip the release, leaving the pointer down. */
  release?: boolean
  pointerType?: "mouse" | "touch" | "pen"
}

export type AutoplayScript = (context: AutoplayContext) => Promise<void>

/** Each context presses with its own pointer, clear of the real mouse (1), so concurrent tiles' gestures stay apart. */
let nextPointerId = 100

let captureGuardInstalled = false

/** Synthetic pointers have no capture target, so set/releasePointerCapture throw; swallow only that case. */
function installCaptureGuard() {
  if (captureGuardInstalled) return
  captureGuardInstalled = true
  const { setPointerCapture, releasePointerCapture } = Element.prototype
  Element.prototype.setPointerCapture = function (pointerId) {
    try {
      setPointerCapture.call(this, pointerId)
    } catch {}
  }
  Element.prototype.releasePointerCapture = function (pointerId) {
    try {
      releasePointerCapture.call(this, pointerId)
    } catch {}
  }
}

function abortError() {
  return new DOMException("Autoplay aborted", "AbortError")
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function centre(element: Element) {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function pointerInit(x: number, y: number, pointerType: string, buttons: number): PointerEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    pointerType,
    isPrimary: true,
    button: 0,
    buttons,
    width: 1,
    height: 1,
    pressure: buttons ? 0.5 : 0,
  }
}

/** Presses dispatched by a script, so the outside-press guard can tell them from a person's. */
const scriptedPresses = new WeakSet<Event>()
const PRESS_TYPES = new Set(["pointerdown", "mousedown"])

let outsidePressGuardInstalled = false

/**
 * Every tile plays at once, and a scripted press bubbles up to the document, where popovers in the other tiles read
 * it as a press outside them and close mid-tour. Press listeners added to the document or window from here on
 * (popovers attach theirs when they open) skip scripted presses; React's root listeners predate this and still see
 * them, as do listeners on the pressed element, so the pressed component itself responds as usual.
 */
function installOutsidePressGuard() {
  if (outsidePressGuardInstalled) return
  outsidePressGuardInstalled = true
  const { addEventListener, removeEventListener } = EventTarget.prototype
  const wrapped = new WeakMap<EventListenerOrEventListenerObject, EventListener>()
  const isGlobal = (target: EventTarget) => target === document || target === window

  const wrap = (listener: EventListenerOrEventListenerObject) => {
    let guarded = wrapped.get(listener)
    if (!guarded) {
      guarded = function (this: unknown, event: Event) {
        if (scriptedPresses.has(event)) return
        if (typeof listener === "function") return listener.call(this, event)
        return listener.handleEvent(event)
      }
      wrapped.set(listener, guarded)
    }
    return guarded
  }

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    const guard = listener && PRESS_TYPES.has(type) && isGlobal(this)
    return addEventListener.call(this, type, guard ? wrap(listener) : listener, options)
  }
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    const guarded = listener && PRESS_TYPES.has(type) && isGlobal(this) ? wrapped.get(listener) : undefined
    return removeEventListener.call(this, type, guarded ?? listener, options)
  }
}

function fire(target: EventTarget, type: string, init: PointerEventInit) {
  const event = type.startsWith("pointer") ? new PointerEvent(type, init) : new MouseEvent(type, init)
  if (PRESS_TYPES.has(type)) scriptedPresses.add(event)
  return target.dispatchEvent(event)
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export function createAutoplayContext(root: HTMLElement, signal: AbortSignal): AutoplayContext {
  installCaptureGuard()
  installOutsidePressGuard()

  const pointerId = nextPointerId++
  const init = (x: number, y: number, pointerType: string, buttons: number): PointerEventInit => ({
    ...pointerInit(x, y, pointerType, buttons),
    pointerId,
  })

  // Gestures are planned in viewport coordinates at their start; if the page scrolls mid-gesture the points shift with
  // it, so the pointer stays on the same spot of the element.
  const scrollAnchor = () => {
    const sx = window.scrollX
    const sy = window.scrollY
    return (point: { x: number; y: number }) => ({ x: point.x - (window.scrollX - sx), y: point.y - (window.scrollY - sy) })
  }

  // A press still held when the run aborts is released, so the demo isn't left mid-gesture.
  let held: { element: Element; x: number; y: number; pointerType: string } | null = null
  const letGo = () => {
    if (!held) return
    const { element, x, y, pointerType } = held
    held = null
    fire(element, "pointerup", init(x, y, pointerType, 0))
    if (pointerType === "mouse") fire(element, "mouseup", init(x, y, pointerType, 0))
  }
  signal.addEventListener("abort", letGo, { once: true })

  const guard = () => {
    if (signal.aborted) throw abortError()
  }

  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(abortError())
      const timer = window.setTimeout(() => {
        signal.removeEventListener("abort", onAbort)
        resolve()
      }, ms)
      const onAbort = () => {
        window.clearTimeout(timer)
        reject(abortError())
      }
      signal.addEventListener("abort", onAbort, { once: true })
    })

  const frame = () =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(abortError())
      requestAnimationFrame(() => (signal.aborted ? reject(abortError()) : resolve()))
    })

  async function poll<T>(lookup: () => T | null | undefined, describe: string, timeout = 10000): Promise<T> {
    const deadline = performance.now() + timeout
    for (;;) {
      guard()
      const found = lookup()
      if (found) return found
      if (performance.now() > deadline) throw new Error(`Autoplay: ${describe} not found`)
      await frame()
    }
  }

  const scope = (options?: FindOptions): ParentNode => (options?.global ? document : root)

  const matches = (value: string, pattern: string | RegExp) =>
    typeof pattern === "string" ? value === pattern : pattern.test(value)

  const context: AutoplayContext = {
    root,
    signal,
    wait,
    find: (selector, options) =>
      poll(() => scope(options).querySelector<HTMLElement>(selector), `"${selector}"`, options?.timeout),
    findByText: (text, selector = "*", options) =>
      poll(
        () => {
          const candidates = Array.from(scope(options).querySelectorAll<HTMLElement>(selector))
          return candidates.reverse().find(element => matches(element.textContent?.trim() ?? "", text))
        },
        `text ${String(text)}`,
        options?.timeout,
      ),
    findByLabel: (label, options) =>
      poll(
        () =>
          Array.from(scope(options).querySelectorAll<HTMLElement>("[aria-label]")).find(element =>
            matches(element.getAttribute("aria-label") ?? "", label),
          ),
        `label ${String(label)}`,
        options?.timeout,
      ),
    async tap(element) {
      guard()
      const { x, y } = centre(element)
      fire(element, "pointerover", init(x, y, "mouse", 0))
      fire(element, "click", { ...init(x, y, "mouse", 0), detail: 1 })
    },
    async pressTap(element) {
      guard()
      const { x, y } = centre(element)
      fire(element, "pointerover", init(x, y, "mouse", 0))
      fire(element, "pointerdown", init(x, y, "mouse", 1))
      fire(element, "mousedown", init(x, y, "mouse", 1))
      held = { element, x, y, pointerType: "mouse" }
      await wait(60)
      letGo()
      fire(element, "click", { ...init(x, y, "mouse", 0), detail: 1 })
    },
    click(element) {
      guard()
      if (element instanceof HTMLElement) element.click()
    },
    hover(element) {
      guard()
      const { x, y } = centre(element)
      for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"]) {
        const bubbles = !type.endsWith("enter")
        fire(element, type, { ...init(x, y, "mouse", 0), bubbles })
      }
    },
    unhover(element) {
      guard()
      const { x, y } = centre(element)
      for (const type of ["pointerout", "pointerleave", "mouseout", "mouseleave"]) {
        const bubbles = !type.endsWith("leave")
        fire(element, type, { ...init(x, y, "mouse", 0), bubbles })
      }
    },
    async drag(element, { dx = 0, dy = 0, duration = 600, from, hold = 0, release = true, pointerType = "mouse" }) {
      guard()
      const rect = element.getBoundingClientRect()
      const start = from ? { x: rect.left + from.x, y: rect.top + from.y } : centre(element)
      fire(element, "pointerover", init(start.x, start.y, pointerType, 0))
      fire(element, "pointerdown", init(start.x, start.y, pointerType, 1))
      if (pointerType === "mouse") fire(element, "mousedown", init(start.x, start.y, pointerType, 1))
      held = { element, ...start, pointerType }
      const follow = scrollAnchor()
      if (hold) await wait(hold)
      const began = performance.now()
      let progress = 0
      let last = start
      while (progress < 1) {
        await frame()
        progress = Math.min(1, (performance.now() - began) / duration)
        const eased = easeInOut(progress)
        last = follow({ x: start.x + dx * eased, y: start.y + dy * eased })
        held = { element, ...last, pointerType }
        // Moves go to the element and bubble to window, where most drag handlers listen once the press has begun.
        fire(element, "pointermove", init(last.x, last.y, pointerType, 1))
        if (pointerType === "mouse") fire(element, "mousemove", init(last.x, last.y, pointerType, 1))
      }
      if (release) letGo()
    },
    async trace(element, points, { duration = 800, pointerType = "pen" } = {}) {
      guard()
      if (points.length === 0) return
      const rect = element.getBoundingClientRect()
      const at = (point: { x: number; y: number }) => ({ x: rect.left + point.x, y: rect.top + point.y })
      const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y))
      const total = lengths.reduce((sum, length) => sum + length, 0) || 1
      const pointAt = (distance: number) => {
        for (let index = 0; index < lengths.length; index++) {
          if (distance <= lengths[index] || index === lengths.length - 1) {
            const t = lengths[index] ? Math.min(1, distance / lengths[index]) : 1
            const a = points[index]
            const b = points[index + 1]
            return at({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
          }
          distance -= lengths[index]
        }
        return at(points[0])
      }
      const start = at(points[0])
      fire(element, "pointerover", init(start.x, start.y, pointerType, 0))
      fire(element, "pointerdown", init(start.x, start.y, pointerType, 1))
      held = { element, ...start, pointerType }
      const follow = scrollAnchor()
      const began = performance.now()
      let progress = 0
      let last = start
      while (progress < 1) {
        await frame()
        progress = Math.min(1, (performance.now() - began) / duration)
        last = follow(pointAt(progress * total))
        held = { element, ...last, pointerType }
        fire(element, "pointermove", init(last.x, last.y, pointerType, 1))
      }
      letGo()
    },
    async type(element, text, { delay = 55 } = {}) {
      guard()
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
        throw new Error("Autoplay: type() needs an input or textarea")
      }
      // Focus only when nothing else holds it, so a script never pulls focus from what the viewer is typing in.
      const active = document.activeElement
      if (!active || active === document.body || root.contains(active)) element.focus({ preventScroll: true })
      const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
      const setValue = Object.getOwnPropertyDescriptor(prototype, "value")?.set
      for (const char of text) {
        await wait(delay)
        element.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }))
        setValue?.call(element, element.value + char)
        element.dispatchEvent(new Event("input", { bubbles: true }))
        element.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true }))
      }
    },
    press(key, element, init) {
      guard()
      const target = element ?? document.activeElement ?? root
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }))
      target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true, ...init }))
    },
  }

  return context
}
