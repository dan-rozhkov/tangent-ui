"use client"

import { useState } from "react"
import { BookOpenIcon, BriefcaseIcon, BuildingsIcon, CalendarBlankIcon, ChartBarIcon, FileTextIcon, GraduationCapIcon, LifebuoyIcon, MapTrifoldIcon, PackageIcon, UsersIcon } from "@phosphor-icons/react"

import { FluidHeader, type FluidHeaderSection } from "@/components/ui/fluid-header"

function Logo() {
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect width="26" height="26" rx="8" fill="currentColor" />
      <path d="M7 17c0-5 3-8 6-8s6 3 6 8M13 9V6" stroke="var(--surface-raised)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const spotlight = (title: string, text: string, href: string) => (
  <a
    href={href}
    className="flex h-full flex-col justify-end gap-px rounded-[14px] bg-foreground/[0.045] p-3 text-sm leading-body outline-none pointer-fine:hover:bg-foreground/[0.065]"
  >
    <span className="font-medium">{title}</span>
    <span className="text-xs text-text-muted">{text}</span>
  </a>
)

const sections: FluidHeaderSection[] = [
  {
    id: "cook",
    title: "Cook",
    entries: [
      { label: "Recipes", description: "Thousands of dishes with step photos and timers", href: "#recipes", icon: <BookOpenIcon size={24} /> },
      { label: "Meal plans", description: "Fill the week in a few taps", href: "#plans", icon: <CalendarBlankIcon size={24} /> },
      { label: "Shopping lists", description: "Grouped by aisle and shared with your household", href: "#lists", icon: <PackageIcon size={24} /> },
      { label: "Pantry", description: "Track what is on the shelf and what expires", href: "#pantry", icon: <MapTrifoldIcon size={24} /> },
      { label: "Nutrition", description: "Macros and trends across what you cook", href: "#nutrition", icon: <ChartBarIcon size={24} /> },
      { label: "Households", description: "Shared plans, tastes, and allergies", href: "#households", icon: <UsersIcon size={24} /> },
    ],
    spotlight: spotlight("Fresh this week", "Hands-free mode, batch cooking, and a smarter substitution finder", "#fresh"),
  },
  {
    id: "learn",
    title: "Learn",
    entries: [
      { label: "Techniques", description: "Knife work, sauces, and the basics done right", href: "#techniques", icon: <GraduationCapIcon size={24} /> },
      { label: "Classes", description: "Live and recorded sessions with working chefs", href: "#classes", icon: <CalendarBlankIcon size={24} /> },
      { label: "Guides", description: "Seasonal shopping and storage cheat sheets", href: "#guides", icon: <FileTextIcon size={24} /> },
      { label: "Chefs", description: "Profiles and signature dishes", href: "#chefs", icon: <UsersIcon size={24} /> },
    ],
    spotlight: spotlight("Member story", "How a night-shift nurse batch-cooks a week of dinners on Sunday", "#story"),
  },
  {
    id: "community",
    title: "Community",
    entries: [
      { label: "Forum", description: "Ask, answer, and swap what works", href: "#forum", icon: <UsersIcon size={24} /> },
      { label: "Events", description: "Cook-alongs and local supper clubs", href: "#events", icon: <CalendarBlankIcon size={24} /> },
      { label: "Newsletter", description: "One good recipe, every Thursday", href: "#newsletter", icon: <FileTextIcon size={24} /> },
      { label: "Help", description: "Real people, replies within a day", href: "#help", icon: <LifebuoyIcon size={24} /> },
    ],
    spotlight: spotlight("Cook-along", "Join the monthly bake with three thousand home cooks", "#bake"),
  },
  { id: "plans", title: "Plans", href: "#plans-pricing" },
]

const searchItems = [
  { label: "Recipes", group: "Cook", href: "#recipes", description: "Browse every dish", icon: <BookOpenIcon size={24} /> },
  { label: "Meal plans", group: "Cook", href: "#plans", description: "Plan the week", icon: <CalendarBlankIcon size={24} /> },
  { label: "Pantry", group: "Cook", href: "#pantry", description: "Track your shelf", icon: <MapTrifoldIcon size={24} /> },
  { label: "Classes", group: "Learn", href: "#classes", description: "Live and recorded", icon: <GraduationCapIcon size={24} />, keywords: "course lesson teach" },
  { label: "Help", group: "Community", href: "#help", description: "Talk to a person", icon: <LifebuoyIcon size={24} /> },
  { label: "Careers", group: "Company", href: "#careers", description: "Open roles", icon: <BriefcaseIcon size={24} /> },
  { label: "About Saltbox", group: "Company", href: "#about", description: "Who we are", icon: <BuildingsIcon size={24} /> },
]

export default function Demo() {
  const [scrolled, setScrolled] = useState(false)
  const [section, setSection] = useState("cook")
  const [last, setLast] = useState<string | null>(null)

  return (
    <div
      className="relative h-[460px] w-full max-w-[760px] overflow-y-auto rounded-surface border border-border bg-surface"
      onScroll={event => setScrolled(event.currentTarget.scrollTop > 24)}
    >
      <div className="sticky top-0 z-10 px-2 pt-3">
        <FluidHeader
          logo={{ name: "Saltbox", glyph: <Logo />, href: "#" }}
          sections={sections}
          search={{ placeholder: "Search Saltbox", items: searchItems }}
          cta={{ label: "Start cooking", href: "#start" }}
          page={section}
          slim={scrolled}
          onVisit={destination => {
            if (destination.section && sections.some(item => item.id === destination.section)) setSection(destination.section)
            setLast(destination.label)
          }}
        />
      </div>
      <div className="flex flex-col gap-3 px-6 pt-10 pb-24">
        <p className="text-sm text-text-muted">
          {last ? `Navigated to ${last}` : "Hover a heading, press the magnifier, or scroll to slim the bar."}
        </p>
        {Array.from({ length: 9 }, (_, index) => (
          <div key={index} className="h-16 rounded-control border border-border bg-surface-muted" aria-hidden="true" />
        ))}
      </div>
    </div>
  )
}
