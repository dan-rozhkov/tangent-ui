import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The reveal replays each time a variant is picked.
  for (const variant of ["blur", "word", "tracking", "wipe", "line"]) {
    const button = await ctx.findByText(variant, "button")
    ctx.hover(button)
    await ctx.wait(250)
    await ctx.tap(button)
    ctx.unhover(button)
    await ctx.wait(1700)
  }
}

export default script
