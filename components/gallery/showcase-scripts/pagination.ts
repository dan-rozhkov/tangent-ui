import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const page = (number: number) => ctx.findByLabel(`Page ${number}`)

  await ctx.wait(500)
  // The mark glides to each page and the window of numbers slides along.
  await ctx.tap(await ctx.findByLabel("Next page"))
  await ctx.wait(900)
  await ctx.tap(await page(3))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel("Next page"))
  await ctx.wait(900)
  await ctx.tap(await ctx.findByLabel("Next page"))
  await ctx.wait(1000)
  // The last number in view is a long jump.
  const pages = Array.from(ctx.root.querySelectorAll<HTMLElement>('button[aria-label^="Page "]'))
  await ctx.tap(pages[pages.length - 1])
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByLabel("Previous page"))
  await ctx.wait(1000)
  for (let index = 0; index < 12; index++) {
    const back = (await ctx.findByLabel("Previous page")) as HTMLButtonElement
    if (back.disabled) break
    await ctx.tap(back)
    await ctx.wait(450)
  }
  await ctx.wait(900)
}

export default script
