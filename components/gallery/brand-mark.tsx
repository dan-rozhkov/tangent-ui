/** The Tangent monogram, filled with the current text color. Size it from the caller. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 342 363" fill="currentColor" width={19} height={20} aria-hidden className={className}>
      <path d="M0 115 94 83v105L0 220Z" />
      <path d="M119 73 342 0v104l-117 39v56a58 58 0 0 0 58 58h59v106h-59A164 164 0 0 1 119 199Z" />
    </svg>
  )
}
