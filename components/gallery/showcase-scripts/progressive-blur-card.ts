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

  // Throw the front card: it flies off and slips to the back of the deck.
  await ctx.drag(await front(ctx), { dx: 220, dy: -14, duration: 380 })
  await ctx.wait(1500)

  // A short drag is not enough: the card springs back.
  await ctx.drag(await front(ctx), { dx: 60, duration: 420 })
  await ctx.wait(900)

  // And the other way.
  await ctx.drag(await front(ctx), { dx: -220, dy: 10, duration: 380 })
  await ctx.wait(1500)
  const second = await front(ctx)
  ctx.hover(second)
  await ctx.wait(1500)
  ctx.unhover(second)
  await ctx.wait(600)

  // Or click a card behind to bring it forward.
  await ctx.tap(await ctx.find('[data-pbc-slot="2"] [data-pbc-back]'))
  await ctx.wait(1400)
}

export default script
