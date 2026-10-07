import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

// Display-only: the arcs sweep and the numbers count up on entry, and the gauges have no hover response, so the script
// just waits for the sweep and rests the pointer on each gauge.
const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const meters = Array.from(ctx.root.querySelectorAll<HTMLElement>('[role="meter"]'))
  await ctx.wait(2200)
  for (const meter of meters) {
    ctx.hover(meter)
    await ctx.wait(900)
    ctx.unhover(meter)
  }
  await ctx.wait(600)
}

export default script
