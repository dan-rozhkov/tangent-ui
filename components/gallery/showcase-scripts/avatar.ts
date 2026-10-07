import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const toggle = (label: string) => ctx.findByText(label, "button")

  await ctx.wait(500)
  // The status dot on the largest avatar swaps between online and offline.
  await ctx.tap(await toggle("Go offline"))
  await ctx.wait(1500)
  await ctx.tap(await toggle("Go online"))
  await ctx.wait(1500)
  await ctx.tap(await toggle("Go offline"))
  await ctx.wait(1300)
  await ctx.tap(await toggle("Go online"))
  await ctx.wait(1000)
}

export default script
