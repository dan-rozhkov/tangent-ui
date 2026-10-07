"use client"

import { PastePreview, type PasteCard } from "@/components/ui/paste-preview"
import { photo } from "@/lib/media"

/** Square favicons drawn inline, so the demo makes no network requests. Brand marks here are sample content. */
const favicon = (letter: string, fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${fill}"/><text x="16" y="22" font-family="system-ui,sans-serif" font-size="17" font-weight="600" text-anchor="middle" fill="#fff">${letter}</text></svg>`,
  )}`

const suggestions: PasteCard[] = [
  {
    url: "https://help.tallyleaf.example/export-your-data",
    source: "Tallyleaf Help",
    title: "Export your workspace as CSV or JSON",
    description: "Download every project, tag, and comment in one archive. Large workspaces are emailed as a link within ten minutes.",
    image: photo("studio-desk").src,
    favicon: favicon("T", "#4d7c0f"),
  },
  {
    url: "https://status.tallyleaf.example/incidents/sync-delays",
    source: "Tallyleaf Status",
    title: "Resolved: delayed sync on mobile",
    description: "Edits made offline took up to an hour to appear on other devices. A fix shipped at 14:20 UTC and queues have cleared.",
    image: photo("window-nook").src,
    favicon: favicon("S", "#0369a1"),
  },
  {
    url: "https://tallyleaf.example/changelog/shared-views",
    source: "Tallyleaf Changelog",
    title: "Shared views, now with saved filters",
    description: "Pin a filtered board for your whole team, and everyone sees the same cards without rebuilding it.",
    image: photo("plant-studio").src,
    favicon: favicon("C", "#a21caf"),
  },
]

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })

/** A stand-in for a link-preview endpoint: fixed metadata after a short delay, no network. */
async function lookup(url: string, signal: AbortSignal): Promise<PasteCard | null> {
  await wait(1150, signal)
  const match = suggestions.find(item => url.replace(/\/$/, "") === item.url)
  if (match) return match
  // Any other address gets a small card: the host, and the last part of the path as its title.
  const { hostname, pathname } = new URL(url)
  const last = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "").replace(/[-_]+/g, " ")
  const site = hostname.replace(/^www\./, "")
  return { url, source: site, title: last ? last.charAt(0).toUpperCase() + last.slice(1) : site, description: url.replace(/^https?:\/\/(www\.)?/, "") }
}

export default function Demo() {
  return (
    <div className="flex min-h-[520px] w-[522px] max-w-full flex-col items-center justify-center gap-3">
      <div className="w-full">
        <PastePreview suggestions={suggestions} lookup={lookup} />
      </div>
      <p className="px-3 text-center text-xs leading-[1.4] text-balance text-text-secondary">
        A demo composer, so no reply is sent. Paste any link, click a link to fold its card, or drag a card up.
      </p>
    </div>
  )
}
