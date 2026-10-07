import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The icon swaps to a check, then settles back.
  for (const label of ["Copy", "Copy link", "Copy key", "Copy command"]) {
    const button = await ctx.find(`button[aria-label="${label}"]:not(:disabled)`)
    ctx.hover(button)
    await ctx.wait(350)
    await ctx.tap(button)
    ctx.unhover(button)
    await ctx.wait(1100)
  }
  await ctx.wait(1200)
}

export default script
