import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const form = () => ctx.find("form")
  const submit = async () => ctx.click(await ctx.find("form button"))

  await ctx.wait(500)
  // A bad address is refused with a shake and a message.
  const input = (await ctx.find('input[type="email"]')) as HTMLInputElement
  await ctx.type(input, "ana@acme", { delay: 70 })
  await ctx.wait(500)
  await submit()
  await ctx.wait(1500)

  // Fixing it lets the send go through.
  await ctx.type(input, ".com", { delay: 90 })
  await ctx.wait(500)
  await submit()
  await ctx.wait(2800)
  await form()

  // Start over, and let the next send fail.
  await ctx.tap(await ctx.findByText("Use a different email", "button"))
  await ctx.wait(900)
  await ctx.tap(await ctx.find('[role="switch"]'))
  await ctx.wait(700)
  await ctx.type((await ctx.find('input[type="email"]')) as HTMLInputElement, "lee@acme.com", { delay: 55 })
  await ctx.wait(400)
  await submit()
  await ctx.wait(2600)
  await ctx.tap(await ctx.find('[role="switch"]'))
  await ctx.wait(500)
  await submit()
  await ctx.wait(2600)

  // The card layout.
  await ctx.tap(await ctx.findByText("Card", "button"))
  await ctx.wait(1800)
  await ctx.tap(await ctx.findByText("Inline", "button"))
  await ctx.wait(1200)
}

export default script
