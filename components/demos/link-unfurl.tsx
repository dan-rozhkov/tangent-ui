"use client"

import { LinkUnfurl, type LinkUnfurlPreview } from "@/components/ui/link-unfurl"
import { photo } from "@/lib/media"

/** Square favicons drawn inline, so the demo makes no network requests. Brand marks here are sample content. */
const favicon = (letter: string, fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${fill}"/><text x="16" y="22" font-family="system-ui,sans-serif" font-size="17" font-weight="600" text-anchor="middle" fill="#fff">${letter}</text></svg>`,
  )}`

const samples: LinkUnfurlPreview[] = [
  {
    url: "https://machiya-hakubai.example/stay",
    site: "Machiya Hakubai",
    title: "Machiya Hakubai, a townhouse by the pagoda",
    description: "Five bedrooms, a long table for twelve, and a terrace that catches the evening light over Kyoto.",
    image: photo("kyoto-rooftops").src,
    favicon: favicon("M", "#c2410c"),
  },
  {
    url: "https://menya-kawa.example/groups",
    site: "Menya Kawa",
    title: "Group dinners at Menya Kawa",
    description: "A set menu for groups of eight to twenty, with hand-pulled noodles, green tea, and a private room.",
    image: photo("noodle-bar").src,
    favicon: favicon("K", "#0f766e"),
  },
  {
    url: "https://higashiyama-walks.example/private",
    site: "Higashiyama Walks",
    title: "Private walking tours through Higashiyama",
    description: "A local guide for your team, from Kiyomizu-dera to Gion with stops for photos.",
    image: photo("kyoto-street").src,
    favicon: favicon("H", "#ca8a04"),
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

/** A stand-in for an unfurl endpoint: fixed metadata after a short delay, no network. */
async function resolve(url: string, signal: AbortSignal): Promise<LinkUnfurlPreview | null> {
  await wait(1150, signal)
  const match = samples.find(sample => url.replace(/\/$/, "") === sample.url)
  if (match) return match
  // Any other address gets a small card: the host, and the last part of the path as its title.
  const { hostname, pathname } = new URL(url)
  const last = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "").replace(/[-_]+/g, " ")
  const site = hostname.replace(/^www\./, "")
  return { url, site, title: last ? last.charAt(0).toUpperCase() + last.slice(1) : site, description: url.replace(/^https?:\/\/(www\.)?/, "") }
}

export default function Demo() {
  return (
    <div className="flex min-h-[520px] w-[628px] max-w-full flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-surface-muted p-6 max-sm:p-3">
      <div className="w-full max-w-[522px]">
        <LinkUnfurl samples={samples} resolve={resolve} />
      </div>
      <p className="max-w-[522px] text-center text-xs leading-[1.4] text-balance text-text-secondary">
        A demo composer, so nothing is sent. Paste any link, click a link to fold its card, or drag a card up.
      </p>
    </div>
  )
}
