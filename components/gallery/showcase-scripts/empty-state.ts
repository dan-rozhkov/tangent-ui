import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The icon and copy swap as the action is pressed, and swap back.
  const clear = await ctx.findByText("Clear filters", "button")
  ctx.hover(clear)
  await ctx.wait(700)
  await ctx.tap(clear)
  ctx.unhover(clear)
  await ctx.wait(2200)
  const again = await ctx.findByText("Search again", "button")
  ctx.hover(again)
  await ctx.wait(600)
  await ctx.tap(again)
  ctx.unhover(again)
  await ctx.wait(1800)
  // Once more, so the swap is easy to follow.
  await ctx.tap(await ctx.findByText("Clear filters", "button"))
  await ctx.wait(2000)
  await ctx.tap(await ctx.findByText("Search again", "button"))
  await ctx.wait(1500)
}

export default script
