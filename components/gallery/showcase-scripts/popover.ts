import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const trigger = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  await ctx.tap(await trigger("Share"))
  await ctx.wait(1600)
  await ctx.tap(await trigger("Share"))
  await ctx.wait(1000)

  // The second popover opens above its trigger and has its own close button.
  await ctx.tap(await trigger("Details"))
  await ctx.wait(1700)
  await ctx.tap(await ctx.findByText("Done", "button", { global: true }))
  await ctx.wait(1100)
}

export default script
