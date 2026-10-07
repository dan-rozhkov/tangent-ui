import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (label: string) => ctx.findByText(label, "button")

  await ctx.wait(500)
  // Members join and leave; the overflow counter rolls with them.
  await ctx.tap(await button("Add person"))
  await ctx.wait(1000)
  await ctx.tap(await button("Add person"))
  await ctx.wait(1100)
  for (let step = 0; step < 4; step++) {
    await ctx.tap(await button("Remove person"))
    await ctx.wait(1000)
  }
  for (let step = 0; step < 2; step++) {
    await ctx.tap(await button("Add person"))
    await ctx.wait(1000)
  }
  await ctx.wait(400)
}

export default script
