import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const option = (name: string) => ctx.findByText(new RegExp(`^${name}`), "label")

  await ctx.wait(500)
  // The highlight travels from row to row.
  await ctx.tap(await option("Enterprise"))
  await ctx.wait(1200)
  const solo = await option("Solo")
  ctx.hover(solo)
  await ctx.wait(500)
  await ctx.tap(solo)
  ctx.unhover(solo)
  await ctx.wait(1200)
  await ctx.tap(await option("Team"))
  await ctx.wait(1300)
}

export default script
