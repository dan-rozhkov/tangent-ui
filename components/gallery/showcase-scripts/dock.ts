import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const slot = (name: string) => ctx.find(`[role="toolbar"] button[aria-label^="${name}"]`)
  const member = (name: string) => ctx.find(`[role="group"] button[aria-label^="${name}"]`)

  const pickFromTray = async (group: string, name: string) => {
    await ctx.tap(await slot(group))
    const target = await member(name)
    await ctx.wait(600)
    await ctx.tap(target)
  }

  await ctx.wait(500)
  // Hover glides the label; a tap springs the selection across.
  const hand = await slot("Hand")
  ctx.hover(hand)
  await ctx.wait(500)
  await ctx.tap(hand)
  ctx.unhover(hand)
  await ctx.wait(700)
  const text = await slot("Text")
  ctx.hover(text)
  await ctx.wait(450)
  await ctx.tap(text)
  ctx.unhover(text)
  await ctx.wait(700)
  // A group opens its tray.
  await pickFromTray("Shapes", "Ellipse")
  await ctx.wait(1000)
  await pickFromTray("Shapes", "Diamond")
  await ctx.wait(1000)
  // Opening comments clears the badge.
  await ctx.tap(await slot("Comment"))
  await ctx.wait(900)
  // Drag a tool to a new place.
  const sticky = (await slot("Sticky note")).parentElement
  if (sticky) await ctx.drag(sticky, { dx: -130, duration: 900 })
  await ctx.wait(900)
  await ctx.tap(await slot("Move"))
  await ctx.wait(600)
}

export default script
