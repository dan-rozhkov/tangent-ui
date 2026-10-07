import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (text: string) => ctx.findByText(text, "button")

  await ctx.wait(500)
  // Replies fold away and come back.
  await ctx.tap(await button("Hide replies"))
  await ctx.wait(1200)
  await ctx.tap(await ctx.findByText(/^Show 2 replies$/, "button"))
  await ctx.wait(1200)
  // A reaction takes your count, and a new comment slides in.
  await ctx.tap(await ctx.find('button[aria-label^="👀 2"]'))
  await ctx.wait(1000)
  await ctx.type(await ctx.findByLabel("Reply, or @mention someone"), "Shortened it to two lines on mobile.", { delay: 35 })
  await ctx.wait(500)
  await ctx.tap(await button("Send"))
  await ctx.wait(1400)
  // Resolving folds the whole thread into a chip.
  await ctx.tap(await button("Resolve"))
  await ctx.wait(1600)
  await ctx.tap(await button("Reopen"))
  await ctx.wait(1200)
}

export default script
