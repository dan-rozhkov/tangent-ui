import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const row = (title: string) => ctx.findByLabel(new RegExp(`^${title}`), { global: true })
  const button = (text: string) => ctx.findByText(text, "button", { global: true })

  await ctx.wait(500)
  await ctx.tap(await ctx.findByLabel(/^Notifications/))
  await ctx.wait(1500)

  // A row expands to its actions; marking it read drops the badge count.
  await ctx.tap(await row("Emma commented"))
  await ctx.wait(1200)
  await ctx.tap(await button("Mark read"))
  await ctx.wait(1100)
  await ctx.tap(await row("Emma commented"))
  await ctx.wait(900)

  await ctx.tap(await button("Unread"))
  await ctx.wait(1200)
  await ctx.tap(await button("Mark all read"))
  await ctx.wait(1600)
  await ctx.tap(await button("All"))
  await ctx.wait(1200)

  await ctx.tap(await ctx.findByLabel("Close notifications", { global: true }))
  await ctx.wait(1000)
}

export default script
