import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const region = (name: string) => ctx.find(`[role="region"][aria-label="${name}"]`)

  await ctx.wait(500)
  // The scrollbar fades in while scrolling and the list edges fade with it.
  const activity = await region("Recent activity")
  ctx.hover(activity)
  await ctx.wait(500)
  activity.scrollTo({ top: activity.scrollHeight * 0.4, behavior: "smooth" })
  await ctx.wait(1500)
  activity.scrollTo({ top: activity.scrollHeight, behavior: "smooth" })
  await ctx.wait(1500)
  activity.scrollTo({ top: 0, behavior: "smooth" })
  await ctx.wait(1700)
  ctx.unhover(activity)

  // The templates strip snaps card by card.
  const templates = await region("Templates")
  for (const left of [150, 300, 450, 0]) {
    templates.scrollTo({ left, behavior: "smooth" })
    await ctx.wait(1000)
  }
}

export default script
