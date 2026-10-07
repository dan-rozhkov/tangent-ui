import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const chip = (name: string) => ctx.findByText(name, "button[data-chip]")
  const more = () => ctx.find("button[data-more]")

  await ctx.wait(500)
  for (const name of ["Design", "Motion", "Code"]) {
    await ctx.tap(await chip(name))
    await ctx.wait(750)
  }
  // The rest unfold past the visible limit.
  await ctx.tap(await more())
  await ctx.wait(1100)
  await ctx.tap(await chip("Writing"))
  await ctx.wait(900)
  await ctx.tap(await more())
  await ctx.wait(1100)
  // Deselect one.
  await ctx.tap(await chip("Motion"))
  await ctx.wait(1000)
  await ctx.tap(await chip("Research"))
  await ctx.wait(1000)
}

export default script
