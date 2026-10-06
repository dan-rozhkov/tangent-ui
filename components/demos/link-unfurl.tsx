"use client"

/* eslint-disable @next/next/no-img-element -- demo avatars are plain img tags. */

import { Hash } from "lucide-react"

import { LinkUnfurl, type LinkUnfurlPreview } from "@/components/ui/link-unfurl"
import { avatar, photo } from "@/lib/media"

/** Square favicons drawn inline, so the demo makes no network requests. Brand marks here are sample content. */
const favicon = (letter: string, fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${fill}"/><text x="16" y="22" font-family="system-ui,sans-serif" font-size="17" font-weight="600" text-anchor="middle" fill="#fff">${letter}</text></svg>`,
  )}`

const samples: LinkUnfurlPreview[] = [
  {
    url: "https://casa-alfama.example/stay",
    site: "Casa Alfama",
    title: "Casa Alfama, a rooftop house over the river",
    description: "Five bedrooms, a long table for twelve, and a terrace that catches the evening light over Lisbon.",
    image: photo("lisbon-rooftops").src,
    favicon: favicon("C", "#c2410c"),
  },
  {
    url: "https://tasca-do-rio.example/groups",
    site: "Tasca do Rio",
    title: "Group dinners at Tasca do Rio",
    description: "A set menu for groups of eight to twenty, with grilled fish, green wine, and a private room.",
    image: photo("restaurant").src,
    favicon: favicon("T", "#0f766e"),
  },
  {
    url: "https://tram28.example/private",
    site: "Tram 28",
    title: "Private tram rides through Alfama",
    description: "A vintage tram for your team, from Martim Moniz to Estrela with stops for photos.",
    image: photo("lisbon-tram").src,
    favicon: favicon("28", "#ca8a04"),
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
  await wait(1100, signal)
  const match = samples.find(sample => url.replace(/\/$/, "") === sample.url)
  if (match) return match
  const host = new URL(url).hostname.replace(/^www\./, "")
  return { url, site: host, title: url.replace(/^https?:\/\//, "").replace(/\/$/, "") }
}

const channels = ["general", "lisbon-offsite", "design-crit", "launch-q3"]

export default function Demo() {
  return (
    <div className="flex h-[480px] w-[720px] max-w-full overflow-hidden rounded-surface border border-border bg-surface">
      <nav className="hidden w-[240px] flex-none flex-col gap-0.5 border-r border-border bg-surface-muted/50 p-3 sm:flex" aria-label="Channels">
        <span className="px-2 pb-2 text-xs leading-body text-text-muted">Northwind</span>
        {channels.map(channel => (
          <span
            key={channel}
            className={
              channel === "lisbon-offsite"
                ? "flex items-center gap-1.5 rounded-[10px] bg-foreground/[0.07] px-2 py-1.5 text-sm leading-body font-medium"
                : "flex items-center gap-1.5 px-2 py-1.5 text-sm leading-body text-text-secondary"
            }
          >
            <Hash className="size-3.5 text-text-muted" aria-hidden="true" />
            {channel}
          </span>
        ))}
        <div className="mt-auto flex items-center gap-2 px-2" aria-hidden="true">
          <img src={avatar("emma-collins")} alt="" className="size-6 rounded-full object-cover" />
          <span className="text-xs leading-body text-text-secondary">Emma Collins</span>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden px-4 py-3" aria-hidden="true">
          <div className="flex gap-2.5">
            <img src={avatar("sofia-ramirez")} alt="" className="size-8 flex-none rounded-full object-cover" />
            <div className="flex flex-col">
              <span className="text-xs leading-body font-medium">
                Sofia Ramirez <span className="font-normal text-text-muted">10:42</span>
              </span>
              <span className="text-sm leading-body text-text-secondary">Dates are locked: 14 to 17 May. Who has ideas for a house?</span>
            </div>
          </div>
          <div className="flex gap-2.5">
            <img src={avatar("daniel-kim")} alt="" className="size-8 flex-none rounded-full object-cover" />
            <div className="flex flex-col">
              <span className="text-xs leading-body font-medium">
                Daniel Kim <span className="font-normal text-text-muted">10:47</span>
              </span>
              <span className="text-sm leading-body text-text-secondary">Somewhere central please, we want to walk to dinner.</span>
            </div>
          </div>
        </div>
        <div className="flex-none px-3 pb-3">
          <LinkUnfurl samples={samples} resolve={resolve} onSend={() => new Promise(done => setTimeout(done, 700))} />
        </div>
      </div>
    </div>
  )
}
