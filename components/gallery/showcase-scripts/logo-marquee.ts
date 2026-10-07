import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The row drifts on its own, holds still under the pointer, and the button pauses it for good.
  await ctx.wait(2200)
  const row = await ctx.findByLabel("Illustrative tool logos")
  ctx.hover(row)
  await ctx.wait(1600)
  ctx.unhover(row)
  await ctx.wait(1600)
  await ctx.tap(await ctx.findByLabel("Pause logo motion"))
  await ctx.wait(1600)
  await ctx.tap(await ctx.findByLabel("Play logo motion"))
  await ctx.wait(1800)
}

export default script
