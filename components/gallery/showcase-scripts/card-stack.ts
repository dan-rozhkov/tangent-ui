import type { AutoplayContext, AutoplayScript } from "@/components/gallery/showcase-autoplay"

const top = (ctx: AutoplayContext) => ctx.find("[data-top]")
const button = (ctx: AutoplayContext, label: string) => ctx.findByText(label, "button")

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)

  // Throw the top card to the right with a drag.
  await ctx.drag(await top(ctx), { dx: 190, dy: -14, duration: 520 })
  await ctx.wait(1100)

  // Then to the left.
  await ctx.drag(await top(ctx), { dx: -190, dy: 10, duration: 520 })
  await ctx.wait(1100)

  // The buttons decide too.
  await ctx.tap(await button(ctx, "Shortlist"))
  await ctx.wait(1000)
  await ctx.tap(await button(ctx, "Skip"))
  await ctx.wait(1000)

  // Undo brings the last card back.
  await ctx.tap(await button(ctx, "Undo"))
  await ctx.wait(1200)
  await ctx.tap(await button(ctx, "Shortlist"))
  await ctx.wait(1000)
}

export default script
