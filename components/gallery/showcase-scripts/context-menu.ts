import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const target = () => ctx.find('[aria-haspopup="menu"]')
  const item = (name: string | RegExp) => ctx.findByText(name, '[role="menuitem"]', { global: true })
  const open = async () => {
    const element = await target()
    const rect = element.getBoundingClientRect()
    element.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: rect.left + rect.width * 0.4, clientY: rect.top + rect.height * 0.4 }),
    )
  }

  await ctx.wait(500)
  await open()
  await ctx.wait(900)
  // The highlight glides between rows.
  ctx.hover(await item("Copy link"))
  await ctx.wait(500)
  ctx.hover(await item("Rename"))
  await ctx.wait(500)
  const star = await item("Add star")
  ctx.hover(star)
  await ctx.wait(500)
  await ctx.tap(star)
  await ctx.wait(1200)
  await open()
  await ctx.wait(800)
  ctx.hover(await item("Delete project"))
  await ctx.wait(900)
  const starred = await item("Starred")
  ctx.hover(starred)
  await ctx.wait(500)
  await ctx.tap(starred)
  await ctx.wait(1200)
}

export default script
