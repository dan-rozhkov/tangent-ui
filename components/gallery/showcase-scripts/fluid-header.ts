import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const top = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // Hovering a section opens its panel; moving to the next one morphs the panel in place.
  for (const name of ["Product", "Solutions", "Resources"]) {
    const item = await top(name)
    ctx.hover(item)
    await ctx.wait(1300)
  }
  ctx.unhover(await top("Resources"))
  await ctx.wait(1000)

  // The search icon turns the bar into a search panel.
  await ctx.tap(await ctx.findByLabel("Search"))
  await ctx.wait(900)
  await ctx.type((await ctx.find("[data-search-input]")) as HTMLInputElement, "doc", { delay: 120 })
  await ctx.wait(1200)
  ctx.press("Escape", await ctx.find("[data-search-input]"))
  await ctx.wait(900)

  // Scrolling tightens the bar, then it relaxes again.
  const scroller = ctx.root.querySelector<HTMLElement>(".overflow-y-auto")
  scroller?.scrollTo({ top: 140, behavior: "smooth" })
  await ctx.wait(1400)
  scroller?.scrollTo({ top: 0, behavior: "smooth" })
  await ctx.wait(1200)
}

export default script
