import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const tab = (name: string) => ctx.findByText(name, '[role="tab"]')

  await ctx.wait(500)
  // The indicator slides and the panel morphs to the new content.
  await ctx.tap(await tab("Activity"))
  await ctx.wait(1300)
  await ctx.tap(await tab("Settings"))
  await ctx.wait(1300)
  await ctx.tap(await tab("Overview"))
  await ctx.wait(1300)

  // A long row of months scrolls to the chosen one.
  await ctx.tap(await tab("June"))
  await ctx.wait(1200)
  await ctx.tap(await tab("September"))
  await ctx.wait(1500)
  await ctx.tap(await tab("March"))
  await ctx.wait(1400)
}

export default script
