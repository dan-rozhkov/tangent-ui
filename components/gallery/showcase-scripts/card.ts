import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const cardOf = async (title: string) => {
    const heading = await ctx.findByText(title, "h3")
    return heading.closest("article") ?? heading
  }

  await ctx.wait(500)
  // Hover lifts the card and eases the photo in.
  const harbour = await cardOf("Harbour redesign")
  ctx.hover(harbour)
  await ctx.wait(1000)
  // The whole card opens into the quick look, then morphs back.
  await ctx.tap(await ctx.find("[data-card-trigger]"))
  await ctx.wait(1800)
  await ctx.tap(await ctx.findByLabel("Close quick look", { global: true }))
  await ctx.wait(1100)
  ctx.unhover(harbour)
  const garden = await cardOf("Garden room launch")
  ctx.hover(garden)
  await ctx.wait(1000)
  ctx.unhover(garden)
  await ctx.wait(500)
}

export default script
