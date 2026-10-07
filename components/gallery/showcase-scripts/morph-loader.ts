import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const shape = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // The same strokes regroup into each shape.
  for (const name of ["Bars", "Ring", "Square"]) {
    await ctx.tap(await shape(name))
    await ctx.wait(1500)
  }
  await ctx.tap(await shape("Dots"))
  await ctx.wait(1300)

  // Success draws a check, failure a cross; each holds, then gathers back into the loop.
  await ctx.tap(await ctx.findByText("Succeed", "button"))
  await ctx.wait(3000)
  await ctx.tap(await shape("Ring"))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByText("Fail", "button"))
  await ctx.wait(3000)
  await ctx.tap(await shape("Dots"))
  await ctx.wait(800)
}

export default script
