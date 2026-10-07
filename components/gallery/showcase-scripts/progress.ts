import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // The bar and the readout move together.
  for (let index = 0; index < 3; index++) {
    await ctx.tap(await button("Send more"))
    await ctx.wait(1100)
  }
  await ctx.tap(await button("Back"))
  await ctx.wait(1100)
  await ctx.tap(await button("Reset"))
  await ctx.wait(1200)
  await ctx.tap(await button("Send more"))
  await ctx.wait(1000)
  await ctx.tap(await button("Send more"))
  await ctx.wait(1100)
}

export default script
