import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Messages slide past each other; the countdown ticks while the first is up.
  await ctx.wait(1200)
  const next = await ctx.findByLabel("Next announcement")
  await ctx.tap(next)
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByLabel("Previous announcement"))
  await ctx.wait(1500)
  // Pause stops the rotation ring.
  await ctx.tap(await ctx.findByLabel("Pause announcements"))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel("Resume announcements"))
  await ctx.wait(900)
  const cta = await ctx.findByText(/^See plans/, "a")
  ctx.hover(cta)
  await ctx.wait(1000)
  ctx.unhover(cta)
  // Dismiss collapses the bar; the button below brings it back.
  await ctx.tap(await ctx.findByLabel("Dismiss"))
  await ctx.wait(1400)
  await ctx.tap(await ctx.findByText("Show again", "button"))
  await ctx.wait(1400)
}

export default script
