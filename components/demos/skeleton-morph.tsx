"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { MorphBlock, SkeletonMorph } from "@/components/ui/skeleton-morph"
import { avatar, photo } from "@/lib/media"

const cover = photo("living-room")

export default function Demo() {
  const [loading, setLoading] = useState(true)
  const [round, setRound] = useState(0)

  // Each round pretends to fetch for a moment, then resolves.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1400)
    return () => window.clearTimeout(timer)
  }, [round])

  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-5">
      <SkeletonMorph
        loading={loading}
        loadingLabel="Loading profile"
        as="article"
        className="flex w-full flex-col gap-4 rounded-panel border border-border bg-surface p-5 shadow-resting"
      >
        <div className="flex items-center gap-3">
          <MorphBlock radius="circle" width={44} height={44} className="flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar("jasmine-brooks")} alt="" width={44} height={44} className="block size-11 rounded-full object-cover" />
          </MorphBlock>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <MorphBlock width={128} lines={1} lineHeight={20}>
              <p className="m-0 text-sm leading-[20px] font-medium">Jasmine Brooks</p>
            </MorphBlock>
            <MorphBlock width={168} lines={1} lineHeight={18}>
              <p className="m-0 text-xs leading-[18px] text-text-secondary">Design lead · Lisbon studio</p>
            </MorphBlock>
          </div>
        </div>
        <MorphBlock height={152} radius={14}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover.src} alt={cover.alt} className="block h-[152px] w-full rounded-[14px] object-cover" />
        </MorphBlock>
        <MorphBlock lines={3} lineHeight={20}>
          <p className="m-0 text-sm leading-[20px] text-text-secondary">
            Shaping calm, honest interfaces for home goods. This week: a quieter checkout and a lamp that keeps turning up in every moodboard.
          </p>
        </MorphBlock>
        <div className="flex gap-6">
          {[
            ["Projects", "48", 56],
            ["Followers", "2.1k", 64],
            ["Following", "312", 60],
          ].map(([label, value, width]) => (
            <MorphBlock key={label as string} width={width as number} lines={2} lineHeight={18}>
              <p className="m-0 text-sm leading-[18px] font-medium tabular-nums">{value}</p>
              <p className="m-0 text-xs leading-[18px] text-text-muted">{label}</p>
            </MorphBlock>
          ))}
        </div>
      </SkeletonMorph>
      <Button
        size="sm"
        variant="secondary"
        disabled={loading}
        onClick={() => {
          setLoading(true)
          setRound(value => value + 1)
        }}
      >
        Load again
      </Button>
    </div>
  )
}
