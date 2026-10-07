import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const png = () =>
  new Promise<File>(resolve => {
    const canvas = document.createElement("canvas")
    canvas.width = 160
    canvas.height = 120
    const g = canvas.getContext("2d")
    if (g) {
      const fill = g.createLinearGradient(0, 0, 160, 120)
      fill.addColorStop(0, "#f0a35e")
      fill.addColorStop(1, "#5e7ff0")
      g.fillStyle = fill
      g.fillRect(0, 0, 160, 120)
    }
    canvas.toBlob(blob => resolve(new File([blob ?? new Blob()], "cover.png", { type: "image/png" })), "image/png")
  })

const script: AutoplayScript = async ctx => {
  const zone = await ctx.findByText(/^Add files/, "button")
  const transfer = (files: File[]) => {
    const data = new DataTransfer()
    for (const file of files) data.items.add(file)
    return data
  }
  const send = (type: string, data: DataTransfer) =>
    zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }))

  await ctx.wait(500)
  // Files hover over the zone: it lights up, then takes the drop.
  const data = transfer([await png(), new File(["x".repeat(2400)], "brief.pdf", { type: "application/pdf" })])
  send("dragenter", data)
  await ctx.wait(300)
  send("dragover", data)
  await ctx.wait(1400)
  send("drop", data)
  // Rows stream progress until done.
  await ctx.wait(4200)
  // Drop one more, then remove a file.
  const more = transfer([new File(["x".repeat(900)], "notes.pdf", { type: "application/pdf" })])
  send("dragenter", more)
  await ctx.wait(700)
  send("drop", more)
  await ctx.wait(1200)
  await ctx.tap(await ctx.findByLabel("Remove brief.pdf"))
  await ctx.wait(1500)
}

export default script
