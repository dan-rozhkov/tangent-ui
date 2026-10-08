## What and why

<!-- One or two sentences. Link the issue: Closes #123 -->

## Checklist

- [ ] Built on Base UI primitives
- [ ] Tokens only: no literal colors, no default-palette utilities, no raw easing
- [ ] Motion from `useMotionTokens()`, reduced motion from `@/lib/reduced-motion`
- [ ] Works in light and dark, with every accent
- [ ] Phosphor icons, regular weight; no focus rings
- [ ] New component: demo in `components/demos`, `npm run gen:demos` run, entry in `lib/catalog.ts`
- [ ] `CHANGELOG.md` updated under Unreleased; deprecations follow the policy in CONTRIBUTING
- [ ] `npm run lint && npm run typecheck && npm run audit:tokens && npm run build` pass

## Screenshots or recording

<!-- Required for visual changes. -->
