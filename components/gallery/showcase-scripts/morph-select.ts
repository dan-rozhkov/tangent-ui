import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const triggers = async () => {
    await ctx.find('button[role="combobox"]')
    return Array.from(ctx.root.querySelectorAll<HTMLElement>('button[role="combobox"]'))
  }
  const option = (name: string) => ctx.findByText(new RegExp(`^${name}`), '[role="option"]')

  await ctx.wait(500)
  // The trigger morphs into the list; picking a row folds it back.
  const [zone, language] = await triggers()
  await ctx.tap(zone)
  await ctx.wait(1200)
  await ctx.tap(await option("New York"))
  await ctx.wait(1300)

  // With many options the lid becomes a search field.
  await ctx.tap(language)
  await ctx.wait(1100)
  await ctx.type((await ctx.findByLabel("Search language")) as HTMLInputElement, "sp", { delay: 130 })
  await ctx.wait(900)
  await ctx.tap(await option("Spanish"))
  await ctx.wait(1300)

  await ctx.tap(zone)
  await ctx.wait(900)
  await ctx.tap(await option("Zurich"))
  await ctx.wait(1000)
}

export default script
