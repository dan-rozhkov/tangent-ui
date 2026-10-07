/** A pointer position at a moment: `t` in ms (use `event.timeStamp`), `x` and `y` in px. */
export type Sample = { t: number; x: number; y: number }

/** Shortest elapsed time (s) a velocity is divided by, so two near-simultaneous samples never give Infinity. */
const MIN_ELAPSED = 0.008

type VelocityOptions = {
  /** Only samples this many ms before `now` count. */
  window?: number
  /** A newest sample older than this many ms means the pointer paused, so the velocity is 0. */
  stale?: number
}

/**
 * The first and last recent samples with the seconds between them (floored at MIN_ELAPSED), or null when there is no
 * usable motion, including samples that all share one timestamp.
 */
function recentSpan<T>(
  samples: T[],
  now: number,
  time: (sample: T) => number,
  { window = 80, stale = 60 }: VelocityOptions,
): [T, T, number] | null {
  const recent = samples.filter((sample) => now - time(sample) <= window)
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last || first === last || now - time(last) > stale) return null
  const elapsed = (time(last) - time(first)) / 1000
  if (elapsed <= 0) return null
  return [first, last, Math.max(MIN_ELAPSED, elapsed)]
}

/**
 * Pointer velocity in px/s from the samples inside `window` ms of `now`.
 * Returns 0 on both axes when fewer than two samples are recent, or the newest is older than `stale` ms.
 */
export function pointerVelocity(samples: Sample[], now: number, options: VelocityOptions = {}) {
  const span = recentSpan(samples, now, (sample) => sample.t, options)
  if (!span) return { x: 0, y: 0 }
  const [first, last, seconds] = span
  return { x: (last.x - first.x) / seconds, y: (last.y - first.y) / seconds }
}

/** Same as `pointerVelocity` for one axis: `value` reads that axis off a sample (`(s) => s.x`). */
export function axisVelocity<T extends { t: number }>(
  samples: T[],
  now: number,
  value: (sample: T) => number,
  options: VelocityOptions = {},
) {
  const span = recentSpan(samples, now, (sample) => sample.t, options)
  if (!span) return 0
  const [first, last, seconds] = span
  return (value(last) - value(first)) / seconds
}

/** Clamps `value` into `[min, max]`. */
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Clamps `value` into `[0, 1]`. */
export const clampUnit = (value: number) => clamp(value, 0, 1)

/**
 * iOS rubber band: the first pixels follow the finger at `k` of the pull, then the shown distance tends to `limit`
 * however far you pull.
 */
export const rubberBand = (distance: number, limit: number, k = 0.55) => (1 - 1 / ((distance * k) / limit + 1)) * limit

/**
 * The pull that `rubberBand` shows as `shown`. Capped 1px short of `limit`, where the pull would be infinite;
 * a `limit` of 1 or less has no room for that cap, so it falls back to `shown / k`.
 */
export const unRubberBand = (shown: number, limit: number, k = 0.55) =>
  limit <= 1 ? shown / k : ((1 / (1 - Math.min(shown, limit - 1) / limit) - 1) * limit) / k

/** Signed rubber band with a free zone: 1:1 up to `free` px either side of 0, then `rubberBand` toward `free + limit`. */
export const resistPast = (raw: number, free: number, limit: number) => {
  const distance = Math.abs(raw)
  return distance <= free ? raw : Math.sign(raw) * (free + rubberBand(distance - free, limit))
}

/** The raw travel that `resistPast` shows as `shown`. */
export const unresistPast = (shown: number, free: number, limit: number) => {
  const distance = Math.abs(shown)
  return distance <= free ? shown : Math.sign(shown) * (free + unRubberBand(distance - free, limit))
}

/** Spring for a thrown element leaving or returning, so it takes the release velocity and settles without bounce. */
export const throwSpring = { type: "spring", visualDuration: 0.5, bounce: 0 } as const
