import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const filter = (name: string) => ctx.findByText(name, '[aria-label="Filter by category"] button')

  await ctx.wait(500)
  // The highlight glides between categories while the cards swap.
  const tabs = Array.from((await ctx.find('[aria-label="Filter by category"]')).querySelectorAll("button"))
  await ctx.tap(tabs[1])
  await ctx.wait(1400)
  await ctx.tap(tabs[2])
  await ctx.wait(1400)
  await ctx.tap(await filter("All"))
  await ctx.wait(1400)
  // A card's image morphs into the reader, then flies back.
  const card = await ctx.find("a[data-post]")
  ctx.hover(card)
  await ctx.wait(600)
  await ctx.tap(card)
  ctx.unhover(card)
  await ctx.wait(2200)
  await ctx.tap(await ctx.findByText(/All posts/, "button"))
  await ctx.wait(1600)
}

export default script
