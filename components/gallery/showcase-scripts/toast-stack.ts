import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // Loading resolves into a success after a moment.
  await ctx.tap(await button("Publish"))
  await ctx.wait(700)
  await ctx.tap(await button("Archive"))
  await ctx.wait(900)
  await ctx.tap(await button("Show error"))
  await ctx.wait(2200)
  // Undo morphs the toast instead of closing it.
  await ctx.tap(await button("Undo"))
  await ctx.wait(1500)
  await ctx.tap(await button("Clear all"))
  await ctx.wait(1200)
}
export default script
