import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Pasting a link turns it into a chip, then its preview card slides open below.
  await ctx.tap(await ctx.findByLabel("Insert Tallyleaf Help link"))
  await ctx.wait(2400)
  await ctx.tap(await ctx.findByLabel("Insert Tallyleaf Status link"))
  await ctx.wait(2400)

  // Folding a card away keeps the chip in the message.
  await ctx.tap(await ctx.findByLabel("Fold Tallyleaf Help card"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByLabel("Open Tallyleaf Help card"))
  await ctx.wait(1300)

  // Dropping a card removes its link too.
  await ctx.tap(await ctx.findByLabel(/^Drop link to Resolved/))
  await ctx.wait(1300)

  await ctx.tap(await ctx.findByLabel("Send reply"))
  await ctx.wait(1800)
}

export default script
