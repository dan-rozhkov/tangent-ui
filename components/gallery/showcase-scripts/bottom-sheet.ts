import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  await ctx.tap(await ctx.findByText("Trip details", "button"))
  await ctx.wait(1500)
  // Drag up to the tall detent, then back down to the short one.
  const grabber = await ctx.find("[data-grabber]", { global: true })
  await ctx.drag(grabber, { dy: -230, duration: 800 })
  await ctx.wait(1300)
  await ctx.drag(grabber, { dy: 200, duration: 800 })
  await ctx.wait(1200)
  await ctx.tap(await ctx.findByText("Done", "button", { global: true }))
  await ctx.wait(1300)
}

export default script
