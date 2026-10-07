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
  const photos = await slot("Photos")
  ctx.hover(photos)
  await ctx.wait(500)
  await ctx.tap(photos)
  ctx.unhover(photos)
  await ctx.wait(700)
  const notes = await slot("Notes")
  ctx.hover(notes)
  await ctx.wait(450)
  await ctx.tap(notes)
  ctx.unhover(notes)
  await ctx.wait(700)
  // A group opens its tray.
  await pickFromTray("Capture", "Voice memo")
  await ctx.wait(1000)
  await pickFromTray("Capture", "Scan document")
  await ctx.wait(1000)
  // Opening the inbox clears its count.
  await ctx.tap(await slot("Inbox"))
  await ctx.wait(900)
  // Drag an app to a new place.
  const maps = (await slot("Maps")).parentElement
  if (maps) await ctx.drag(maps, { dx: -130, duration: 900 })
  await ctx.wait(900)
  await ctx.tap(await slot("Music"))
  await ctx.wait(600)
}

export default script
