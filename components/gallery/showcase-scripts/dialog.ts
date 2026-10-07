import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const open = async (name: string) => {
    await ctx.tap(await ctx.findByText(name, "button"))
    await ctx.wait(1000)
  }
  const press = async (name: string, wait = 1000) => {
    await ctx.tap(await ctx.findByText(name, "button", { global: true }))
    await ctx.wait(wait)
  }

  await ctx.wait(500)
  // Rename: edit the field, then cancel.
  await open("Rename")
  await ctx.type(await ctx.find('[role="dialog"] input', { global: true }), "-ui", { delay: 90 })
  await ctx.wait(700)
  await press("Cancel")
  // The multi-step dialog resizes as its copy changes.
  await open("Invite")
  await press("Next", 1000)
  await press("Next", 1000)
  await press("Back", 900)
  await press("Next", 900)
  await press("Send", 1000)
  // A destructive confirm, backed out of.
  await open("Delete project")
  await press("Cancel", 900)
}

export default script
