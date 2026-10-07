import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const row = (title: string) => ctx.findByText(new RegExp(title), "button[data-timeline-trigger]")

  await ctx.wait(500)
  await ctx.tap(await row("Production deploy finished"))
  await ctx.wait(1300)
  // The failed deploy starts open.
  await ctx.tap(await row("Staging deploy failed"))
  await ctx.wait(1200)
  await ctx.tap(await row("Production deploy finished"))
  await ctx.wait(1000)

  // Older days sit below the fold.
  const scroller = await ctx.find("[data-scrolls]")
  scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" })
  await ctx.wait(1600)
  scroller.scrollTo({ top: 0, behavior: "smooth" })
  await ctx.wait(1400)
  await ctx.tap(await row("Staging deploy failed"))
  await ctx.wait(1000)
}
export default script
