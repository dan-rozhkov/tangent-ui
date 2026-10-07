import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const plot = await ctx.find('[role="group"][aria-roledescription="ridgeline chart"]')
  const { width, height } = plot.getBoundingClientRect()

  // A pen sweep across the ridges lifts the one under it and reads out its values.
  await ctx.trace(
    plot,
    [
      { x: width * 0.3, y: height * 0.18 },
      { x: width * 0.55, y: height * 0.4 },
      { x: width * 0.7, y: height * 0.62 },
      { x: width * 0.5, y: height * 0.8 },
    ],
    { duration: 2600 },
  )
  await ctx.wait(1000)

  // Keys walk the ridges from the top, then slide the cursor along the values.
  ctx.press("Home", plot)
  await ctx.wait(750)
  for (let i = 0; i < 3; i++) {
    ctx.press("ArrowDown", plot)
    await ctx.wait(750)
  }
  for (let i = 0; i < 6; i++) {
    ctx.press("ArrowRight", plot)
    await ctx.wait(220)
  }
  await ctx.wait(900)
  ctx.press("Escape", plot)
  await ctx.wait(900)
}

export default script
