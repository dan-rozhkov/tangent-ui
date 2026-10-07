import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (text: string | RegExp) => ctx.findByText(text, "button")
  const tab = (name: string) => ctx.findByText(new RegExp(`^${name}`), '[role="tab"]')

  await ctx.wait(500)
  // Follow, with a toast.
  await ctx.tap(await button("Follow"))
  await ctx.wait(1500)

  await ctx.tap(await tab("Issues"))
  await ctx.wait(1100)
  await ctx.tap(await ctx.findByLabel("New issue"))
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByLabel(/^Mark CHK-138 done$/))
  await ctx.wait(1500)

  // Scrolling condenses the header into one compact bar.
  const scroller = ctx.root.querySelector<HTMLElement>('[role="tabpanel"]')?.closest<HTMLElement>(".overflow-y-auto")
  scroller?.scrollTo({ top: 160, behavior: "smooth" })
  await ctx.wait(1700)
  await ctx.tap(await tab("Updates"))
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByLabel(/back to top$/))
  await ctx.wait(1500)

  await ctx.tap(await tab("Overview"))
  await ctx.wait(1000)
  await ctx.tap(await button("Following"))
  await ctx.wait(1000)
}

export default script
