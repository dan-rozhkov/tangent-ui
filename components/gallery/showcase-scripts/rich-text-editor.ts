import type { AutoplayContext, AutoplayScript } from "@/components/gallery/showcase-autoplay"

/** Selects the first run of `text` inside the editor, the way a drag over it would. */
function select(editor: HTMLElement, text: string) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = (node as Text).data.indexOf(text)
    if (at < 0) continue
    const range = document.createRange()
    range.setStart(node, at)
    range.setEnd(node, at + text.length)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    return
  }
}

/** Puts the caret at the very end of the document. */
function caretToEnd(editor: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

async function typeInto(ctx: AutoplayContext, text: string, delay = 55) {
  for (const char of text) {
    await ctx.wait(delay)
    document.execCommand("insertText", false, char)
  }
}

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const editor = await ctx.find('[role="textbox"][aria-label="Post body"]')
  editor.focus({ preventScroll: true })
  await ctx.wait(400)

  // Selecting text raises the floating toolbar.
  select(editor, "Faster search")
  await ctx.wait(1200)
  await ctx.tap(await ctx.findByLabel("Bold"))
  await ctx.wait(900)

  // The toolbar morphs into a link field.
  select(editor, "dark")
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel("Link"))
  await ctx.wait(900)
  await ctx.type((await ctx.findByLabel("Link address")) as HTMLInputElement, "https://example.com/themes", { delay: 30 })
  await ctx.wait(500)
  await ctx.tap(await ctx.findByLabel("Apply link"))
  await ctx.wait(1100)

  // Leave the list, then type / to open the block menu.
  editor.focus({ preventScroll: true })
  caretToEnd(editor)
  await ctx.wait(500)
  document.execCommand("insertParagraph")
  await ctx.wait(300)
  document.execCommand("insertParagraph")
  await ctx.wait(500)
  await typeInto(ctx, "/")
  await ctx.wait(1000)
  for (let i = 0; i < 2; i++) {
    ctx.press("ArrowDown", editor)
    await ctx.wait(450)
  }
  ctx.press("Enter", editor)
  await ctx.wait(800)
  await typeInto(ctx, "Thanks for testing")
  await ctx.wait(800)

  await ctx.tap(await ctx.findByText("Publish", "button"))
  await ctx.wait(1500)
}

export default script
