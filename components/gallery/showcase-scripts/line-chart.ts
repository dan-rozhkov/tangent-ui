import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const plot = () => ctx.findByLabel(/explore by/)
  // Sweeps the crosshair along the plot with the mouse; the headline number above follows it.
  const sweep = async (from: number, to: number, duration: number) => {
    const area = await plot()
    const { width, height } = area.getBoundingClientRect()
    await ctx.drag(area, { from: { x: width * from, y: height / 2 }, dx: width * (to - from), duration })
    ctx.unhover(area)
  }

  await ctx.wait(500)
  await ctx.wait(1500)
  await sweep(0.04, 0.96, 2600)
  await ctx.wait(700)
  await sweep(0.9, 0.35, 1500)
  await ctx.wait(700)

  // A shorter range redraws the lines.
  await ctx.tap(await ctx.findByText("7 days", "button"))
  await ctx.wait(1500)
  await sweep(0.05, 0.95, 1800)
  await ctx.wait(700)
  await ctx.tap(await ctx.findByText("30 days", "button"))
  await ctx.wait(1500)
}

export default script
