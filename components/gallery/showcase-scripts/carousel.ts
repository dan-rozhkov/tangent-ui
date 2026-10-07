import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const next = () => ctx.findByLabel("Next slide")
  const previous = () => ctx.findByLabel("Previous slide")

  await ctx.wait(500)
  await ctx.tap(await next())
  await ctx.wait(1200)
  await ctx.tap(await next())
  await ctx.wait(1200)
  // A swipe flings the track to the following slide.
  const slide = await ctx.find('[role="tabpanel"]:not([inert])')
  await ctx.drag(slide, { dx: -170, duration: 450 })
  await ctx.wait(1400)
  // A dot jumps straight back to the first slide.
  const dots = ctx.root.querySelectorAll<HTMLElement>('[role="tab"]')
  await ctx.tap(dots[0])
  await ctx.wait(1400)
  await ctx.tap(await next())
  await ctx.wait(1100)
  await ctx.tap(await previous())
  await ctx.wait(1000)
}

export default script
