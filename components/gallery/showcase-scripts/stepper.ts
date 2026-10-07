import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  await ctx.tap(await button("Continue"))
  await ctx.wait(1100)
  await ctx.tap(await button("Continue"))
  await ctx.wait(1100)
  await ctx.tap(await button("Finish"))
  await ctx.wait(1400)
  // Step back, then jump straight to a finished step.
  await ctx.tap(await button("Back"))
  await ctx.wait(1100)
  await ctx.tap(await ctx.findByText(/^Cart/, "button[data-clickable]"))
  await ctx.wait(1200)
  await ctx.tap(await button("Continue"))
  await ctx.wait(1200)
}

export default script
