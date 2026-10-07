"use client"

import { JSAnimation } from "motion/react"

/**
 * Plays every animation on the page at one speed, without touching the components: Motion's JS animations get it as
 * their playback speed when they start, and Web Animations (Motion's accelerated ones, CSS transitions and keyframes)
 * get it as their playbackRate. Timers a component schedules itself, such as a toast's auto-dismiss, keep real time.
 */
let speed = 1
let installed = false
const scaled = new WeakSet<object>()

function install() {
  installed = true

  const play = JSAnimation.prototype.play
  JSAnimation.prototype.play = function (this: JSAnimation<number>) {
    // Only the first play: a resume after pause keeps whatever speed the animation has by then.
    if (!scaled.has(this)) {
      scaled.add(this)
      if (this.speed === 1) this.speed = speed
    }
    return play.call(this)
  }

  const animate = Element.prototype.animate
  Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
    const animation = animate.apply(this, args)
    if (speed !== 1) animation.playbackRate = speed
    return animation
  }

  const onStart = (event: Event) => {
    if (speed === 1 || !(event.target instanceof Element)) return
    for (const animation of event.target.getAnimations({ subtree: true })) {
      if (animation.playbackRate === 1) animation.playbackRate = speed
    }
  }
  document.addEventListener("transitionrun", onStart, true)
  document.addEventListener("animationstart", onStart, true)
}

export function setAnimationSpeed(next: number) {
  if (next === speed) return
  if (!installed) install()
  const previous = speed
  speed = next
  // Animations already running switch over too, unless something else gave them their own rate.
  for (const animation of document.getAnimations()) {
    if (animation.playbackRate === previous) animation.playbackRate = next
  }
}
