import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Publish morphs through Publishing and Published on its own, then returns.
  await ctx.tap(await ctx.findByText(/^Publish/, "button"))
  await ctx.wait(3600)

  const follow = await ctx.findByText(/^Follow/, "button")
  await ctx.tap(follow)
  await ctx.wait(1300)
  await ctx.tap(follow)
  await ctx.wait(1300)
  await ctx.tap(follow)
  await ctx.wait(1300)
  await ctx.tap(follow)
  await ctx.wait(1000)
}

export default script
