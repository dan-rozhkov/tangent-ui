"use client"

import { useState } from "react"
import { BookOpen, Briefcase, Building, Calendar, ChartBar, FileText, GraduationCap, Map, Package, Support, Users } from "@mynaui/icons-react"

import { MorphNav, type MorphNavItem } from "@/components/ui/morph-nav"

function Logo() {
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect width="26" height="26" rx="8" fill="currentColor" />
      <path d="M8 18 13 8l5 10" stroke="var(--surface-raised)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const feature = (title: string, text: string, href: string) => (
  <a
    href={href}
    className="flex h-full flex-col justify-end gap-px rounded-[14px] bg-foreground/[0.045] p-3 text-sm leading-body outline-none pointer-fine:hover:bg-foreground/[0.065]"
  >
    <span className="font-medium">{title}</span>
    <span className="text-xs text-text-muted">{text}</span>
  </a>
)

const items: MorphNavItem[] = [
  {
    value: "product",
    label: "Product",
    links: [
      { label: "Field reports", description: "Capture site visits with photos, notes, and sign-off", href: "#reports", icon: <FileText /> },
      { label: "Scheduling", description: "Plan crews and visits around real availability", href: "#scheduling", icon: <Calendar /> },
      { label: "Asset map", description: "Every site and asset on one live map", href: "#map", icon: <Map /> },
      { label: "Insights", description: "Trends across jobs, crews, and regions", href: "#insights", icon: <ChartBar /> },
      { label: "Integrations", description: "Sync with the tools your office already uses", href: "#integrations", icon: <Package /> },
      { label: "Teams", description: "Roles, permissions, and shared workspaces", href: "#teams", icon: <Users /> },
    ],
    feature: feature("What’s new", "Offline sync, faster photo uploads, and a new report builder", "#new"),
  },
  {
    value: "solutions",
    label: "Solutions",
    links: [
      { label: "Utilities", description: "Inspections and outage response at scale", href: "#utilities", icon: <Building /> },
      { label: "Construction", description: "Daily logs, punch lists, and handover", href: "#construction", icon: <Briefcase /> },
      { label: "Facilities", description: "Planned maintenance across every building", href: "#facilities", icon: <Building /> },
      { label: "Field services", description: "Dispatch, track, and invoice from one place", href: "#services", icon: <Calendar /> },
    ],
    feature: feature("Customer story", "How Northwind cut report turnaround from days to hours", "#story"),
  },
  {
    value: "resources",
    label: "Resources",
    links: [
      { label: "Docs", description: "Set up, configure, and extend Fieldwork", href: "#docs", icon: <BookOpen /> },
      { label: "Academy", description: "Short courses for admins and crews", href: "#academy", icon: <GraduationCap /> },
      { label: "Blog", description: "Product news and field notes", href: "#blog", icon: <FileText /> },
      { label: "Support", description: "Talk to a person, any time zone", href: "#support", icon: <Support /> },
    ],
    feature: feature("Field guide", "A practical playbook for rolling out mobile reporting", "#guide"),
  },
  { value: "pricing", label: "Pricing", href: "#pricing" },
]

const searchItems = [
  { label: "Field reports", group: "Product", href: "#reports", description: "Capture site visits", icon: <FileText /> },
  { label: "Scheduling", group: "Product", href: "#scheduling", description: "Plan crews and visits", icon: <Calendar /> },
  { label: "Customers", group: "Company", href: "#customers", description: "Teams using Fieldwork", icon: <Building /> },
  { label: "Docs", group: "Resources", href: "#docs", description: "Set up and configure", icon: <BookOpen />, keywords: "setup install" },
  { label: "Support", group: "Resources", href: "#support", description: "Talk to a person", icon: <Support /> },
  { label: "Careers", group: "Company", href: "#careers", description: "Open roles", icon: <Briefcase /> },
  { label: "Academy", group: "Resources", href: "#academy", description: "Short courses", icon: <GraduationCap /> },
]

export default function Demo() {
  const [scrolled, setScrolled] = useState(false)
  const [section, setSection] = useState("product")
  const [last, setLast] = useState<string | null>(null)

  return (
    <div
      className="relative h-[460px] w-full max-w-[760px] overflow-y-auto rounded-surface border border-border bg-surface"
      onScroll={event => setScrolled(event.currentTarget.scrollTop > 24)}
    >
      <div className="sticky top-0 z-10 px-2 pt-3">
        <MorphNav
          brand={{ name: "Fieldwork", mark: <Logo />, href: "#" }}
          items={items}
          search={{ placeholder: "Search Fieldwork", items: searchItems }}
          action={{ label: "Get started", href: "#start" }}
          current={section}
          compact={scrolled}
          onNavigate={destination => {
            if (destination.section && items.some(item => item.value === destination.section)) setSection(destination.section)
            setLast(destination.label)
          }}
        />
      </div>
      <div className="flex flex-col gap-3 px-6 pt-10 pb-24">
        <p className="text-sm text-text-muted">
          {last ? `Navigated to ${last}` : "Hover a section, press the search icon, or scroll to tighten the bar."}
        </p>
        {Array.from({ length: 9 }, (_, index) => (
          <div key={index} className="h-16 rounded-control border border-border bg-surface-muted" aria-hidden="true" />
        ))}
      </div>
    </div>
  )
}
