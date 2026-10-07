import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // A reaction counts up, then back down.
  const thumbs = await ctx.find('button[aria-label^="👍 1"]')
  await ctx.tap(thumbs)
  await ctx.wait(1000)
  await ctx.tap(await ctx.find('button[aria-label^="👍 2"]'))
  await ctx.wait(800)
  // Send: delivered, read, typing, then a reply.
  await ctx.type(await ctx.findByLabel("Message"), "Shipping the lamp page today", { delay: 40 })
  await ctx.wait(500)
  await ctx.tap(await ctx.findByLabel("Send"))
  await ctx.wait(4200)
}

export default script
