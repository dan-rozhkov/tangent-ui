import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const reel = (name: string) => ctx.findByLabel(name)
  const mode = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // Flick the reels like a drum.
  await ctx.drag(await reel("Day"), { dy: -44, duration: 600 })
  await ctx.wait(900)
  await ctx.drag(await reel("Hour"), { dy: 70, duration: 500 })
  await ctx.wait(900)
  await ctx.tap(await ctx.findByText("Monday", "button"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByText("This evening", "button"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByText(/^Schedule/, "button"))
  await ctx.wait(2200)
  // Other modes remount with their own reels.
  await ctx.tap(await mode("Date"))
  await ctx.wait(1400)
  await ctx.drag(await reel("Year"), { dy: -40, duration: 500 })
  await ctx.wait(1000)
  await ctx.tap(await mode("Time"))
  await ctx.wait(1400)
  await ctx.tap(await mode("Date and time"))
  await ctx.wait(1000)
}

export default script
