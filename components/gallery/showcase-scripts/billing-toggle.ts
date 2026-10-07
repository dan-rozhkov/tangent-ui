import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const option = (name: string) => ctx.findByText(new RegExp(`^${name}`), '[role="radio"]')

  await ctx.wait(500)
  const yearly = await option("Yearly")
  ctx.hover(yearly)
  await ctx.wait(500)
  await ctx.tap(yearly)
  ctx.unhover(yearly)
  await ctx.wait(1800)
  // Back to monthly: the price rolls up and the badge folds away.
  await ctx.tap(await option("Monthly"))
  await ctx.wait(1700)
  await ctx.tap(await option("Yearly"))
  await ctx.wait(1800)
  await ctx.tap(await option("Monthly"))
  await ctx.wait(1400)
  await ctx.tap(await option("Yearly"))
  await ctx.wait(1200)
}

export default script
