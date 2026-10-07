import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const global = { global: true }

  await ctx.wait(500)
  const thumb = await ctx.findByLabel(/^Open Spiral stair/)
  ctx.hover(thumb)
  await ctx.wait(500)
  // The photo grows out of its thumbnail.
  await ctx.tap(thumb)
  await ctx.wait(1500)

  for (let step = 0; step < 3; step++) {
    await ctx.tap(await ctx.findByLabel("Next photo", global))
    await ctx.wait(1000)
  }
  await ctx.tap(await ctx.findByLabel("Zoom in", global))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByLabel("Zoom out", global))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel("Previous photo", global))
  await ctx.wait(1000)

  await ctx.tap(await ctx.findByLabel("Close viewer", global))
  await ctx.wait(1300)
}

export default script
