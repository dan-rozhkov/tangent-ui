"use client"

import { createContext, useContext, type ReactNode } from "react"

import { motionTokens } from "@/lib/motion-tokens"

type Spring = {
  readonly type: "spring"
  readonly stiffness?: number
  readonly damping?: number
  readonly mass?: number
  readonly visualDuration?: number
  readonly bounce?: number
}

type Numbers<T> = { readonly [K in keyof T]: number }

/** The token shape with numbers widened, so a spring can be retuned between physics and duration forms. */
export type MotionTokens = {
  readonly duration: Numbers<typeof motionTokens.duration>
  readonly ease: typeof motionTokens.ease
  readonly spring: { readonly [K in keyof typeof motionTokens.spring]: Spring }
  readonly stagger: Numbers<typeof motionTokens.stagger>
  readonly blur: Numbers<typeof motionTokens.blur>
}

const MotionTokensContext = createContext<MotionTokens>(motionTokens)

/** Overrides motion tokens for a subtree. The gallery uses it to tune a demo live. */
export function MotionTokensProvider({ value, children }: { value: MotionTokens; children: ReactNode }) {
  return <MotionTokensContext.Provider value={value}>{children}</MotionTokensContext.Provider>
}

/** Motion tokens for this subtree: the shared presets unless a provider above overrides them. */
export function useMotionTokens(): MotionTokens {
  return useContext(MotionTokensContext)
}
