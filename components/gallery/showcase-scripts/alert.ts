import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // Tone swaps recolour the icon and surface in place.
  for (const tone of ["info", "success", "danger", "warning"]) {
    await ctx.tap(await button(tone))
    await ctx.wait(1100)
  }
  // Hide and show from the outside, then dismiss from the alert itself.
  await ctx.tap(await button("Hide"))
  await ctx.wait(1200)
  await ctx.tap(await button("Show"))
  await ctx.wait(1400)
  await ctx.tap(await ctx.findByLabel(/^Dismiss:/))
  await ctx.wait(1200)
  await ctx.tap(await button("Show"))
  await ctx.wait(1300)
}

export default script
