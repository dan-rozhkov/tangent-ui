import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const png = (name: string, from: string, to: string) =>
  new Promise<File>(resolve => {
    const canvas = document.createElement("canvas")
    canvas.width = 160
    canvas.height = 120
    const g = canvas.getContext("2d")
    if (g) {
      const fill = g.createLinearGradient(0, 0, 160, 120)
      fill.addColorStop(0, from)
      fill.addColorStop(1, to)
      g.fillStyle = fill
      g.fillRect(0, 0, 160, 120)
    }
    canvas.toBlob(blob => resolve(new File([blob ?? new Blob()], name, { type: "image/png" })), "image/png")
  })

const script: AutoplayScript = async ctx => {
  const zone = await ctx.find('[role="button"]')
  const drop = (files: File[]) => {
    const data = new DataTransfer()
    for (const file of files) data.items.add(file)
    const send = (type: string) => zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }))
    return { enter: () => send("dragenter"), drop: () => send("drop") }
  }

  await ctx.wait(500)
  // The zone reacts to files hovering over it, then rows fill with progress.
  const first = drop([await png("cover.png", "#f0a35e", "#5e7ff0"), await png("hero.png", "#5ee0b0", "#7e5ef0")])
  first.enter()
  await ctx.wait(1300)
  first.drop()
  await ctx.wait(4000)
  // A failing upload stops halfway and offers a retry.
  const bad = drop([await png("fail-banner.png", "#e05e7e", "#f0c05e")])
  bad.enter()
  await ctx.wait(500)
  bad.drop()
  await ctx.wait(3200)
  await ctx.tap(await ctx.findByLabel("Remove fail-banner.png"))
  await ctx.wait(1200)
  await ctx.tap(await ctx.findByLabel("Remove hero.png"))
  await ctx.wait(1300)
}

export default script
