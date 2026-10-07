import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const option = (name: string) => ctx.findByText(new RegExp(`^${name}`), '[role="radio"]')

  await ctx.wait(500)
  // The ring springs from card to card; the disabled card refuses the press.
  await ctx.tap(await option("Express"))
  await ctx.wait(1300)
  const overnight = await option("Overnight")
  ctx.hover(overnight)
  await ctx.tap(overnight)
  await ctx.wait(1300)
  ctx.unhover(overnight)
  await ctx.tap(await option("Standard"))
  await ctx.wait(1300)
  await ctx.tap(await option("Express"))
  await ctx.wait(1000)
}

export default script
