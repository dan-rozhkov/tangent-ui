import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const button = await ctx.findByLabel("Hold to delete project")
  // A short hold fills part of the way, then drains back on release.
  await ctx.drag(button, { hold: 650, duration: 40 })
  await ctx.wait(1300)
  // The full hold fills the button and confirms.
  await ctx.drag(button, { hold: 1800, duration: 40 })
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByText("Undo", "button"))
  await ctx.wait(1200)
}

export default script
