import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(1800)
  // Placeholder to loaded row and back, twice.
  await ctx.tap(await ctx.findByText("Finish loading", "button"))
  await ctx.wait(1800)
  await ctx.tap(await ctx.findByText("Load again", "button"))
  await ctx.wait(1800)
  await ctx.tap(await ctx.findByText("Finish loading", "button"))
  await ctx.wait(1500)
}

export default script
