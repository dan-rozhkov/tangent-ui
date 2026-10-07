import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The digits roll every second; the short timer runs out and flips to its completed label.
  await ctx.findByText("Live now", undefined, { timeout: 14000 })
  await ctx.wait(1800)
  // Restart rewinds it.
  await ctx.tap(await ctx.findByText("Restart", "button"))
  await ctx.wait(3000)
}

export default script
