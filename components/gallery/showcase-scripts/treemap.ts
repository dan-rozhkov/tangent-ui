import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const tile = async (name: string) => {
    const label = await ctx.findByText(name, "span")
    return label.parentElement as HTMLElement
  }

  await ctx.wait(500)
  for (const name of ["United States", "Germany", "Japan"]) {
    ctx.hover(await tile(name))
    await ctx.wait(900)
  }
  // A region tile zooms in; the path above zooms back out.
  await ctx.tap(await tile("Europe"))
  await ctx.wait(1600)
  ctx.hover(await tile("United Kingdom"))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByText("All regions", 'nav button'))
  await ctx.wait(1600)
  ctx.unhover(await tile("Japan"))
  await ctx.wait(600)
}
export default script
