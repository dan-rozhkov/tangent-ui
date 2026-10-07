import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const front = (ctx: Parameters<AutoplayScript>[0]) =>
  ctx.find('[data-pbc-slot="0"] [data-pbc-card]')

const script: AutoplayScript = async (ctx) => {
  await ctx.wait(600)

  // Hover the front card: the blur grows upward and the bio rises in.
  const first = await front(ctx)
  ctx.hover(first)
  await ctx.wait(1800)

  // Connect morphs into Connected.
  await ctx.tap(await ctx.find('[data-pbc-slot="0"] [data-pbc-connect]'))
  await ctx.wait(1400)
  ctx.unhover(first)
  await ctx.wait(900)

  // Bring the card behind forward and look at it.
  await ctx.tap(await ctx.find('[data-pbc-slot="1"] [data-pbc-back]'))
  await ctx.wait(900)
  const second = await front(ctx)
  ctx.hover(second)
  await ctx.wait(1800)
  ctx.unhover(second)
  await ctx.wait(700)

  // And one more.
  await ctx.tap(await ctx.find('[data-pbc-slot="2"] [data-pbc-back]'))
  await ctx.wait(1400)
}

export default script
