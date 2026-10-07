import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const layout = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // The band remounts on each layout, so the numbers count up and the visuals draw in again.
  await ctx.wait(2500)
  await ctx.tap(await layout("Plain"))
  await ctx.wait(3000)
  await ctx.tap(await layout("Divided"))
  await ctx.wait(3000)
}

export default script
