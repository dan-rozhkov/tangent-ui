import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const input = (await ctx.find('input[type="search"]')) as HTMLInputElement
  ctx.hover(input)
  await ctx.wait(500)

  // The clear button springs in with the first letter.
  await ctx.type(input, "dialog", { delay: 90 })
  await ctx.wait(1200)
  await ctx.tap(await ctx.findByLabel("Clear search"))
  await ctx.wait(1000)
  await ctx.type(input, "tabs", { delay: 90 })
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel("Clear search"))
  await ctx.wait(900)
  ctx.unhover(input)
}

export default script
