import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const field = await ctx.findByLabel("Comment")

  await ctx.wait(500)
  // "@" opens the people list, the arrows move through it, and Enter turns the choice into a token.
  await ctx.type(field, "Nice pass @", { delay: 70 })
  await ctx.wait(1000)
  for (let step = 0; step < 2; step++) {
    ctx.press("ArrowDown", field)
    await ctx.wait(600)
  }
  ctx.press("Enter", field)
  await ctx.wait(1000)

  // "#" opens channels the same way.
  await ctx.type(field, "ready for #", { delay: 70 })
  await ctx.wait(1000)
  ctx.press("Enter", field)
  await ctx.wait(1100)

  // Enter posts the comment and clears the field.
  ctx.press("Enter", field)
  await ctx.wait(1600)
}

export default script
