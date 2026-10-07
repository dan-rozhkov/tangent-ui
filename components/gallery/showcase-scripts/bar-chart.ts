import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(1200)
  const scrubber = await ctx.find('[role="slider"]')
  const { width, height } = scrubber.getBoundingClientRect()
  const y = height / 2
  // The readout rolls to each day under the pointer and the bar lights up.
  await ctx.trace(scrubber, [{ x: width * 0.96, y }, { x: width * 0.06, y }], { duration: 3200, pointerType: "mouse" })
  await ctx.wait(500)
  await ctx.trace(scrubber, [{ x: width * 0.08, y }, { x: width * 0.62, y }], { duration: 1500, pointerType: "mouse" })
  await ctx.wait(900)
  // Leaving returns the readout to the weekly average.
  ctx.unhover(scrubber)
  await ctx.wait(1300)
}

export default script
