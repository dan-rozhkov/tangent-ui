import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const shape = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // The same strokes regroup into each shape.
  for (const name of ["Columns", "Orbit", "Frame"]) {
    await ctx.tap(await shape(name))
    await ctx.wait(1500)
  }
  await ctx.tap(await shape("Pulse"))
  await ctx.wait(1300)

  // Finishing draws a check, breaking a cross; each holds, then gathers back into the loop.
  await ctx.tap(await ctx.findByText("Finish", "button"))
  await ctx.wait(3000)
  await ctx.tap(await shape("Orbit"))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByText("Break", "button"))
  await ctx.wait(3000)
  await ctx.tap(await shape("Pulse"))
  await ctx.wait(800)
}

export default script
