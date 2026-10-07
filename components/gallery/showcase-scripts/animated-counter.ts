import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (name: string) => ctx.findByText(new RegExp(`^${name}`), "button")

  await ctx.wait(1400)
  // Digits roll to the new value; only the places that change move.
  for (const name of ["Add", "Add", "Add"]) {
    await ctx.tap(await button(name))
    await ctx.wait(1200)
  }
  for (const name of ["Remove", "Remove", "Remove"]) {
    await ctx.tap(await button(name))
    await ctx.wait(1000)
  }
  await ctx.wait(400)
}

export default script
