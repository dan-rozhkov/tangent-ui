import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const [signups, errors] = Array.from(ctx.root.querySelectorAll<HTMLElement>('[role="slider"]'))

  // Scrub along each line: the readout follows the point.
  for (const plot of [signups, errors]) {
    if (!plot) continue
    const { width, height } = plot.getBoundingClientRect()
    await ctx.drag(plot, { from: { x: width * 0.05, y: height / 2 }, dx: width * 0.9, duration: 1800 })
    await ctx.wait(500)
    await ctx.drag(plot, { from: { x: width * 0.95, y: height / 2 }, dx: -width * 0.4, duration: 900 })
    await ctx.wait(700)
    ctx.unhover(plot)
    await ctx.wait(900)
  }
}

export default script
