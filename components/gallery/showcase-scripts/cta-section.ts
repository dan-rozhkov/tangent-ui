import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const layout = async (name: string) => ctx.tap(await ctx.findByText(name, "button"))

  await ctx.wait(500)
  // The primary button confirms in place.
  const primary = ctx.root.querySelector<HTMLElement>("section .group\\/action")
  if (primary) {
    ctx.hover(primary)
    await ctx.wait(700)
    await ctx.tap(primary)
    await ctx.wait(1200)
    await ctx.tap(primary)
    ctx.unhover(primary)
    await ctx.wait(700)
  }
  // The frame springs to each layout's height.
  await layout("Split")
  await ctx.wait(2800)
  await layout("Banner")
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByLabel("Dismiss"))
  await ctx.wait(1400)
  await ctx.tap(await ctx.findByText("Show the banner again", "button"))
  await ctx.wait(1200)
  await layout("Centered")
  await ctx.wait(1200)
}

export default script
