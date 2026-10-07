import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // The total spins to a new figure, digit by digit.
  for (let index = 0; index < 3; index++) {
    await ctx.tap(await button("New total"))
    await ctx.wait(1500)
  }
  await ctx.tap(await button("Toggle"))
  await ctx.wait(1400)
  await ctx.tap(await button("Toggle"))
  await ctx.wait(1400)
}

export default script
