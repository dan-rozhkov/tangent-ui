import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const header = await ctx.findByText(/^Pro plan/, "button")
  ctx.hover(header)
  await ctx.wait(600)
  // The card grows in width and height on one spring, and closes as its mirror.
  await ctx.tap(header)
  await ctx.wait(2400)
  await ctx.tap(header)
  await ctx.wait(1600)
  await ctx.tap(header)
  await ctx.wait(1800)
  await ctx.tap(header)
  ctx.unhover(header)
  await ctx.wait(1300)
}

export default script
