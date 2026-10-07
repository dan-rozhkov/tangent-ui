import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (name: string) => ctx.findByLabel(name)
  const glide = async (name: string, ms = 800) => {
    ctx.hover(await button(name))
    await ctx.wait(ms)
    ctx.unhover(await button(name))
  }

  await ctx.wait(500)
  // The first tooltip waits for its delay; its neighbours open at once.
  await glide("Bold", 1200)
  await glide("Italic", 700)
  await glide("Underline", 700)
  await ctx.wait(800)
  await glide("Archive", 1200)

  // The label swaps in place and the bubble resizes.
  const copy = await button("Copy link")
  ctx.hover(copy)
  await ctx.wait(1200)
  await ctx.tap(copy)
  await ctx.wait(2400)
  ctx.unhover(copy)
  await ctx.wait(800)
}
export default script
