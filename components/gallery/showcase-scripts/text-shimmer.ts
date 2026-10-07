import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The shimmer sweeps while busy; stopping settles it to solid text.
  await ctx.wait(2200)
  await ctx.tap(await ctx.findByText("Stop", "button"))
  await ctx.wait(1800)
  await ctx.tap(await ctx.findByText("Run again", "button"))
  await ctx.wait(2600)
  await ctx.tap(await ctx.findByText("Stop", "button"))
  await ctx.wait(1500)
}

export default script
