"use client"

import { ThemeSwitch } from "@/components/ui/theme-switch"

import { useThemeTransition } from "./theme-switch"

export default function Demo() {
  const { theme, onThemeChange } = useThemeTransition()
  return <ThemeSwitch theme={theme} variant="rise" iconOnly onThemeChange={onThemeChange} />
}
