import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const layout = (name: string) => ctx.findByText(name, "button")
  const question = (text: string) => ctx.findByText(text, "button")

  await ctx.wait(500)
  // Accordion: answers open and close.
  await ctx.tap(await question("Does it work with my design system?"))
  await ctx.wait(1200)
  await ctx.tap(await question("Is reduced motion supported?"))
  await ctx.wait(1400)
  await ctx.tap(await question("Is reduced motion supported?"))
  await ctx.wait(900)
  // Two columns: the topic rail slides its highlight between categories.
  await ctx.tap(await layout("Two column"))
  await ctx.wait(1400)
  const topics = Array.from((await ctx.findByLabel("Question topics")).querySelectorAll<HTMLElement>("button"))
  for (const topic of topics.slice(1, 3)) {
    await ctx.tap(topic)
    await ctx.wait(1300)
  }
  if (topics[0]) await ctx.tap(topics[0])
  await ctx.wait(1000)
  // Search filters the answers as you type.
  await ctx.tap(await layout("Searchable"))
  await ctx.wait(1400)
  const search = await ctx.find('input[type="search"], input')
  await ctx.type(search, "install", { delay: 110 })
  await ctx.wait(1500)
  await ctx.type(search, "zzz", { delay: 110 })
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByText("Clear search", "button"))
  await ctx.wait(1000)
  await ctx.tap(await layout("Accordion"))
  await ctx.wait(1000)
}

export default script
