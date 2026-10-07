import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const layer = (name: string) => ctx.findByText(name, "button[aria-pressed]")

  await ctx.wait(500)
  const plot = await ctx.find('[aria-roledescription="stream graph"]')
  const { width, height } = plot.getBoundingClientRect()

  // Sweep through time, then dip across the layers.
  await ctx.drag(plot, { from: { x: width * 0.1, y: height * 0.5 }, dx: width * 0.8, duration: 2200 })
  await ctx.wait(500)
  await ctx.drag(plot, { from: { x: width * 0.6, y: height * 0.8 }, dy: -height * 0.6, duration: 900 })
  await ctx.wait(700)
  ctx.unhover(plot)
  await ctx.wait(700)

  // Hover a layer to spotlight it, then hide it and bring it back.
  const billing = await layer("Billing")
  ctx.hover(billing)
  await ctx.wait(1100)
  await ctx.tap(billing)
  ctx.unhover(billing)
  await ctx.wait(1400)
  await ctx.tap(await layer("Billing"))
  await ctx.wait(1400)
}

export default script
