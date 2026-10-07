import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const divider = (label: string) => ctx.find(`[role="separator"][aria-controls="${label}"]`)

  await ctx.wait(500)
  // Dragging a divider trades width between its two panes.
  await ctx.drag(await divider("messages"), { dx: -90, duration: 1000 })
  await ctx.wait(900)
  await ctx.drag(await divider("messages"), { dx: 130, duration: 1100 })
  await ctx.wait(1000)

  // Enter hides the folders pane; Enter again brings it back.
  const folders = await divider("folders")
  folders.focus({ preventScroll: true })
  ctx.press("Enter", folders)
  await ctx.wait(1500)
  ctx.press("Enter", folders)
  await ctx.wait(1300)

  // A double-click resets the layout.
  const handle = await divider("messages")
  handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
  await ctx.wait(1300)
  folders.blur()
}

export default script
