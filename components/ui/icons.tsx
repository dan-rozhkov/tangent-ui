import type { SVGProps } from "react"

/* Icons Myna does not ship, drawn on its 24px grid: stroke 1.5, round caps and joins, currentColor. */
type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number | string }

function Base({ size = 24, strokeWidth = 1.5, children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

/** A faint track with a quarter arc on it. Spin it with animate-spin. */
export function SpinnerArc(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" opacity=".25" />
      <path d="M12 3a9 9 0 0 1 9 9" />
    </Base>
  )
}

export function Strikethrough(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M17 7c0-1.7-2.2-3-5-3s-5 1.3-5 3c0 1.3.9 2.2 2.2 2.9M7 17c0 1.7 2.2 3 5 3s5-1.3 5-3c0-1.4-.9-2.3-2.2-3M4 12h16" />
    </Base>
  )
}

export function SmilePlus(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 15c.85.63 1.885 1 3 1s2.15-.37 3-1m-5.5-4.5V10m5 .5V10" />
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M16.5 5h5M19 2.5v5" />
    </Base>
  )
}
