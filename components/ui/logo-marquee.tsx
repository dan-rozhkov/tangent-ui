"use client"

import { useEffect, useId, useRef, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export interface LogoMarqueeBrand {
  name: string
  /** Monochrome SVG, drawn as a mask in the text color. */
  icon: string
  /** Single brand color for the mark in color tone. Leave out for brands whose mark is black or white. */
  color?: string
  /** Full color SVG for multicolor marks, used in color tone instead of `icon`. */
  colorIcon?: string
}

export type LogoMarqueeTone = "color" | "mono"

export interface LogoMarqueeProps {
  title?: string
  description?: string
  brands?: LogoMarqueeBrand[]
  /** `color` shows each mark in its official colors; `mono` draws every mark in the text color. */
  tone?: LogoMarqueeTone
}

const exampleBrands: LogoMarqueeBrand[] = [
  { name: "Dropbox", icon: "/logos/dropbox.svg", color: "#0061FF" }, // token-audit-ignore: official brand color
  { name: "Asana", icon: "/logos/asana.svg", color: "#F06A6A" }, // token-audit-ignore: official brand color
  { name: "Airtable", icon: "/logos/airtable.svg", color: "#18BFFF" }, // token-audit-ignore: official brand color
  { name: "Discord", icon: "/logos/discord.svg", color: "#5865F2" }, // token-audit-ignore: official brand color
  { name: "GitLab", icon: "/logos/gitlab.svg", color: "#FC6D26" }, // token-audit-ignore: official brand color
  { name: "Shopify", icon: "/logos/shopify.svg", color: "#7AB55C" }, // token-audit-ignore: official brand color
  { name: "Netlify", icon: "/logos/netlify.svg", color: "#00C7B7" }, // token-audit-ignore: official brand color
]

const markClass =
  "block size-[22px] flex-none @max-[639px]/logos:size-5"

function BrandMark({ brand, tone }: { brand: LogoMarqueeBrand; tone: LogoMarqueeTone }) {
  if (tone === "color" && brand.colorIcon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cn(markClass, "bg-none object-contain")} src={brand.colorIcon} alt="" width={22} height={22} draggable={false} />
  }
  return (
    <span
      className={cn(markClass, "bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]")}
      style={{ maskImage: `url("${brand.icon}")`, WebkitMaskImage: `url("${brand.icon}")`, color: tone === "color" ? brand.color : undefined }}
      aria-hidden="true"
    />
  )
}

function BrandList({ brands, tone, duplicate = false }: { brands: LogoMarqueeBrand[]; tone: LogoMarqueeTone; duplicate?: boolean }) {
  return (
    <ul
      className={cn(
        "m-0 flex flex-none list-none items-center gap-14 py-0 pr-14 pl-0",
        "@max-[639px]/logos:gap-10 @max-[639px]/logos:pr-10",
        "motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-5 motion-reduce:p-0 motion-reduce:px-6",
        duplicate && "motion-reduce:hidden",
      )}
      aria-label={duplicate ? undefined : "Illustrative tool logos"}
      aria-hidden={duplicate || undefined}
    >
      {brands.map((brand, index) => (
        <li
          className="inline-flex flex-none items-center gap-2.5 whitespace-nowrap text-text-secondary group-data-[tone=color]/logos:text-foreground"
          key={`${brand.name}-${index}`}
        >
          <BrandMark brand={brand} tone={tone} />
          <span className="text-(length:--text-lg) font-medium tracking-body @max-[639px]/logos:text-base">{brand.name}</span>
        </li>
      ))}
    </ul>
  )
}

export function LogoMarquee({
  title = "Good work moves between tools",
  description = "From the first idea to the final handoff, a familiar set of tools stays close to the work.",
  brands = exampleBrands,
  tone = "color",
}: LogoMarqueeProps) {
  const titleId = useId()
  const [paused, setPaused] = useState(false)
  const track = useRef<HTMLDivElement>(null)
  const travel = useRef<Animation | null>(null)
  const reduced = useReducedMotion()

  // The original's `travel` keyframes (0 to -50% over 39s, linear, infinite) run as one Web Animation, so pause and play keep the position.
  useEffect(() => {
    const node = track.current
    if (!node || reduced) return
    const animation = node.animate([{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }], {
      duration: 39000,
      iterations: Infinity,
      easing: "linear",
    })
    travel.current = animation
    return () => {
      animation.cancel()
      travel.current = null
    }
  }, [reduced])

  useEffect(() => {
    if (paused) travel.current?.pause()
    else travel.current?.play()
  }, [paused])

  // Hovering the row holds it still, so a logo can be read.
  const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches

  return (
    <section
      className="group/logos @container/logos w-full min-w-0 overflow-hidden rounded-surface border border-border bg-surface font-sans text-sm leading-body tracking-body text-foreground"
      data-tone={tone}
      aria-labelledby={titleId}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)] items-end gap-12 px-10 pt-10 pb-9 @max-[639px]/logos:grid-cols-1 @max-[639px]/logos:gap-3 @max-[639px]/logos:px-5 @max-[639px]/logos:pt-7 @max-[639px]/logos:pb-6">
        <h2
          id={titleId}
          className="m-0 max-w-[540px] font-display text-(length:--text-3xl) leading-display font-normal tracking-display text-balance @max-[639px]/logos:text-(length:--text-2xl)"
        >
          {title}
        </h2>
        <p className="m-0 mb-[3px] max-w-[36ch] text-base leading-body text-text-secondary text-pretty @max-[639px]/logos:text-sm">{description}</p>
      </div>

      <div
        className="relative overflow-hidden border-y border-border-subtle py-8 [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)] @max-[639px]/logos:py-6"
        role="region"
        aria-label="Illustrative tool logos"
        onPointerEnter={() => {
          if (canHover()) travel.current?.pause()
        }}
        onPointerLeave={() => {
          if (!paused) travel.current?.play()
        }}
      >
        <div ref={track} className="flex w-max will-change-transform motion-reduce:w-auto motion-reduce:justify-center motion-reduce:will-change-auto">
          <BrandList brands={brands} tone={tone} />
          <BrandList brands={brands} tone={tone} duplicate />
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 px-4 py-2.5 @max-[639px]/logos:px-3 motion-reduce:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="text-text-secondary"
          aria-label={paused ? "Play logo motion" : "Pause logo motion"}
          onClick={() => setPaused(value => !value)}
        >
          {paused ? (
            <>
              <PlayIcon size={14} weight="fill" aria-hidden="true" />
              Play
            </>
          ) : (
            <>
              <PauseIcon size={14} weight="fill" aria-hidden="true" />
              Pause
            </>
          )}
        </Button>
        <span className="absolute size-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]" aria-live="polite">
          {paused ? "Motion paused" : ""}
        </span>
      </div>
    </section>
  )
}

export default LogoMarquee
