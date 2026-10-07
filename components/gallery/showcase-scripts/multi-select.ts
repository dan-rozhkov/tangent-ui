import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const trigger = () => ctx.find('button[aria-haspopup="listbox"]')
  const option = (name: string) => ctx.findByText(name, '[role="option"]')

  await ctx.wait(500)
  await ctx.tap(await trigger())
  await ctx.wait(1000)
  // Chips join the field as rows are checked.
  await ctx.tap(await option("Feature"))
  await ctx.wait(900)
  await ctx.tap(await option("Docs"))
  await ctx.wait(900)
  await ctx.tap(await trigger())
  await ctx.wait(1100)

  await ctx.tap(await ctx.findByLabel("Clear selections"))
  await ctx.wait(1000)
  await ctx.tap(await trigger())
  await ctx.wait(800)
  await ctx.tap(await option("Bug"))
  await ctx.wait(800)
  await ctx.tap(await trigger())
  await ctx.wait(900)
}

export default script
