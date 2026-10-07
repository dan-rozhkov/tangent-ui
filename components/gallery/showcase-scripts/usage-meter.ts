import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const row = (name: string) => ctx.find(`[role="group"] button[aria-label^="${name},"]`)

  await ctx.wait(500)
  // Hovering a category dims the rest of the bar.
  for (const name of ["Files", "Media", "Backups"]) {
    const legend = await row(name)
    ctx.hover(legend)
    await ctx.wait(900)
    ctx.unhover(legend)
  }
  // Pinning holds the highlight.
  const media = await row("Media")
  await ctx.tap(media)
  ctx.unhover(media)
  await ctx.wait(1400)
  await ctx.tap(media)
  ctx.unhover(media)
  await ctx.wait(1000)
}
export default script
