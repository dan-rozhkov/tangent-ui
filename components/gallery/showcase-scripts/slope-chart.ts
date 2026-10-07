import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const stage = await ctx.find('[role="group"][aria-roledescription="slope chart"]')

  // Step through the channels in Q2 order: each line lights up and the rest recede.
  for (let i = 0; i < 5; i++) {
    ctx.press("ArrowDown", stage)
    await ctx.wait(1000)
  }
  ctx.press("ArrowUp", stage)
  await ctx.wait(1000)
  ctx.press("Home", stage)
  await ctx.wait(1000)
  ctx.press("Escape", stage)
  await ctx.wait(900)
}

export default script
