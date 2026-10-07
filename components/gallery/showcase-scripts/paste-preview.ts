import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Pasting a link turns it into a chip, then an unfurled preview card slides open below.
  await ctx.tap(await ctx.findByLabel("Paste Machiya Hakubai link"))
  await ctx.wait(2400)
  await ctx.tap(await ctx.findByLabel("Paste Menya Kawa link"))
  await ctx.wait(2400)

  // Folding a card away keeps the chip in the message.
  await ctx.tap(await ctx.findByLabel("Collapse Machiya Hakubai preview"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByLabel("Show Machiya Hakubai preview"))
  await ctx.wait(1300)

  // Removing a card drops its link too.
  await ctx.tap(await ctx.findByLabel(/^Remove link to Group dinners/))
  await ctx.wait(1300)

  await ctx.tap(await ctx.findByLabel("Send message"))
  await ctx.wait(1800)
}

export default script
