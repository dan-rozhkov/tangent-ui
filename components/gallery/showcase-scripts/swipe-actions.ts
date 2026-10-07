import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const row = async (name: string) => {
    const li = (await ctx.findByText(name, "span")).closest("li")
    if (!li) throw new Error(`Autoplay: row ${name} not found`)
    return li
  }
  const surface = (li: HTMLElement) => li.lastElementChild as HTMLElement

  await ctx.wait(600)
  // A short swipe right reveals the leading action, a long one commits it.
  const emma = await row("Emma Collins")
  await ctx.drag(surface(emma), { dx: 80, duration: 700 })
  await ctx.wait(1100)
  await ctx.drag(surface(emma), { dx: 300, duration: 800 })
  await ctx.wait(1200)
  // Swipe left to reveal two actions, then tap one.
  const marcus = await row("Marcus Johnson")
  await ctx.drag(surface(marcus), { dx: -170, duration: 700 })
  await ctx.wait(1200)
  const archive = Array.from(marcus.querySelectorAll<HTMLElement>('button[data-side="trailing"]')).find(b => b.textContent?.includes("Archive"))
  if (archive) await ctx.tap(archive)
  await ctx.wait(1300)
  // A full swipe left commits the outermost action on its own.
  const jasmine = await row("Jasmine Brooks")
  await ctx.drag(surface(jasmine), { dx: -320, duration: 800 })
  await ctx.wait(1500)
  // Bring the list back.
  await ctx.tap(await ctx.findByText("Restore messages", "button"))
  await ctx.wait(1000)
}

export default script
