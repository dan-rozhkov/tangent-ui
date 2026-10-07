import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const layout = async (name: string) => ctx.tap(await ctx.findByText(name, "button"))

  await ctx.wait(500)
  // An empty send flags each field.
  await ctx.click(await ctx.findByText("Send message", "button"))
  await ctx.wait(1300)
  await ctx.type(await ctx.find('input[name="name"]'), "Emma Collins", { delay: 35 })
  await ctx.type(await ctx.find('input[name="email"]'), "emma@northwind.example", { delay: 25 })
  await ctx.wait(300)
  await ctx.tap(await ctx.findByText("Support", '[role="radio"]'))
  await ctx.wait(700)
  await ctx.type(await ctx.find('textarea[name="message"]'), "Our team needs a licence for twelve seats.", { delay: 25 })
  await ctx.wait(500)
  // The card springs into its confirmation.
  await ctx.click(await ctx.findByText("Send message", "button"))
  await ctx.wait(2800)
  await ctx.tap(await ctx.findByText("Send another message", "button"))
  await ctx.wait(1000)
  await layout("Channels")
  await ctx.wait(1200)
  await ctx.tap(await ctx.find('[role="tab"][aria-selected="false"]'))
  await ctx.wait(1300)
  await layout("Offices")
  await ctx.wait(1500)
  await layout("Form")
  await ctx.wait(1000)
}

export default script
