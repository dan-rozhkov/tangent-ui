import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  await ctx.tap(await ctx.findByLabel("Copy code"))
  await ctx.wait(1500)
  // The source area springs open to the full file, and back.
  const toggle = await ctx.find("section > button")
  await ctx.tap(toggle)
  await ctx.wait(2200)
  await ctx.tap(toggle)
  await ctx.wait(1500)
}

export default script
