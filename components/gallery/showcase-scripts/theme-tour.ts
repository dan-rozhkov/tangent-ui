import type { AutoplayContext } from "@/components/gallery/showcase-autoplay"

/**
 * Taps each theme toggle there and back, so the page ends in the theme it started in. The toggles store an explicit
 * theme, so the viewer's stored choice, "system" or none at all, is put back once the tour ends or is cut short.
 */
export async function themeTour(ctx: AutoplayContext, toggles: () => Promise<(HTMLElement | undefined)[]>) {
  const stored = localStorage.getItem("theme")
  try {
    await ctx.wait(500)
    for (const toggle of await toggles()) {
      if (!toggle) continue
      await ctx.tap(toggle)
      await ctx.wait(2000)
      await ctx.tap(toggle)
      await ctx.wait(2000)
    }
  } finally {
    if (stored === null) localStorage.removeItem("theme")
    else localStorage.setItem("theme", stored)
  }
}
