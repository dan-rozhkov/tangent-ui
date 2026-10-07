import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const group = await ctx.find("[role='group'][aria-labelledby]")
  const card = (index: number) => ctx.findByLabel(new RegExp(`, ${index} of 4,`))

  // Hovering fans the stack open.
  ctx.hover(group)
  await ctx.wait(1100)

  // Drag down to bring the next cards forward.
  await ctx.drag(await card(1), { dy: 150, duration: 650 })
  await ctx.wait(900)
  await ctx.drag(await card(2), { dy: 150, duration: 650 })
  await ctx.wait(900)
  ctx.unhover(group)
  await ctx.wait(500)

  // Open the front card: the balance counts up and the activity slides in.
  await ctx.tap(await card(3))
  await ctx.wait(2200)

  // Switch to another card while one is open.
  await ctx.tap(await card(4))
  await ctx.wait(1800)

  // Drag the open card down to put it back.
  await ctx.drag(await card(4), { dy: 150, duration: 600 })
  await ctx.wait(900)
  await ctx.tap(await card(1))
  await ctx.wait(2000)
}

export default script
