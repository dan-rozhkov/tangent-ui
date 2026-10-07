import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const option = (group: string, name: string) =>
    ctx.findByText(new RegExp(`^${name}`), `[role="group"][aria-label="${group}"] button`)

  await ctx.wait(500)
  // The thumb slides to each option.
  await ctx.tap(await option("Range", "Month"))
  await ctx.wait(1000)
  await ctx.tap(await option("Range", "Day"))
  await ctx.wait(1000)
  await ctx.tap(await option("Range", "Week"))
  await ctx.wait(1000)

  // The narrow track scrolls inside itself to keep the chosen option in view.
  for (const name of ["Sent", "Spam", "Archive", "Drafts", "Inbox"]) {
    await ctx.tap(await option("Folder", name))
    await ctx.wait(1000)
  }
}

export default script
