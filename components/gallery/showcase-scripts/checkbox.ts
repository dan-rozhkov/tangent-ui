import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const box = (name: string) => ctx.findByText(name, "label").then(label => ((label as HTMLLabelElement).control ?? label) as HTMLElement)

  await ctx.wait(500)
  await ctx.tap(await box("I agree to the terms"))
  await ctx.wait(1000)
  // The parent box shows a dash for a partial pick and a tick for all.
  await ctx.tap(await box("Comments"))
  await ctx.wait(1000)
  await ctx.tap(await box("Weekly digest"))
  await ctx.wait(1100)
  await ctx.tap(await box("All notifications"))
  await ctx.wait(1000)
  await ctx.tap(await box("All notifications"))
  await ctx.wait(1000)
  await ctx.tap(await box("Comments"))
  await ctx.wait(700)
  await ctx.tap(await box("Weekly digest"))
  await ctx.wait(1000)
  await ctx.tap(await box("I agree to the terms"))
  await ctx.wait(800)
}

export default script
