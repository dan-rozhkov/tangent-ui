# Contributing

Tangent UI is a small library with a strong point of view. Contributions are welcome, and the fastest way to land one is to talk first.

## Propose a component

Open a [component request](https://github.com/dan-rozhkov/tangent-ui/issues/new?template=component-request.yml) before writing code. Say what problem it solves, link a reference for the behavior, and note what the existing components can't do. Requests are public, so anyone can see what is planned and add to it.

Small fixes and bug reports don't need a proposal. Use the [bug report](https://github.com/dan-rozhkov/tangent-ui/issues/new?template=bug-report.yml) form or send a PR.

## Add a component

1. Create `components/ui/<name>.tsx`. One file per component or block. Name files in kebab-case.
2. Create `components/demos/<name>.tsx` with a default-exported `Demo` component.
3. Run `npm run gen:demos` to regenerate `components/demos/index.ts`. Don't edit it by hand.
4. Add an entry to `lib/catalog.ts` with `name`, `title`, `description`, `category` and `kind`.
5. Add a line under `## [Unreleased]` in `CHANGELOG.md`.

Run `npm run dev` and check the component page in both themes, with every accent, and with reduced motion on.

## Conventions

- Build on [Base UI](https://base-ui.com) primitives. Don't hand-roll what Base UI already provides.
- Tokens only. No hex, rgb, hsl or oklch literals in components, and no default Tailwind palette utilities (`bg-zinc-100`). Use the semantic utilities from `app/globals.css`, such as `bg-surface` and `text-text-secondary`.
- Motion comes from `useMotionTokens()` in `@/lib/motion-tokens-context`. No raw easing curves or magic durations.
- Reduced motion comes from `useReducedMotion` in `@/lib/reduced-motion`, not from `motion/react`. Reduced motion reaches the same end state in one step.
- Light and dark both work. Themes switch on `data-theme`, so never branch on `prefers-color-scheme` in a component.
- Icons are Phosphor `XxxIcon` components at the regular weight.
- No focus rings or outlines. This is a product decision, recorded in `app/foundation.css`. Don't add them back.
- Add `"use client"` where the component uses state, effects or Motion.
- Export a typed props interface. Spread remaining props onto the root element.

## Before you open a PR

```bash
npm run lint && npm run typecheck && npm run audit:tokens && npm run build
```

`audit:tokens` fails when hardcoded colors, default-palette utilities or raw easing grow in any file under `components/ui`. Use a token first: `shade` and `sheen` with alpha cover shadows, scrims and highlights (`bg-shade/40`, `color-mix(in oklab, var(--shade) 6%, transparent)`), `on-media` covers text over photos. Mask lines are skipped, since their colors only carry alpha. A literal that is not a theme decision (a brand mark, computed color data, an art material) gets `// token-audit-ignore: <reason>` on its line or the comment line above; the audit still lists it. If a count must change on purpose, run `npm run audit:tokens -- --update` and explain why in the PR.

Fill in the PR template. Add a screenshot or short recording for anything visual.

## Review and approval

Any maintainer can review and approve a PR. There is no CODEOWNERS file and no single gatekeeper. One approval is enough to merge; ask for a second on breaking changes.

If a PR sits for a week without a review, say so in the thread.

## Versioning and deprecation

The registry follows [semver](https://semver.org). Every release is described in [CHANGELOG.md](CHANGELOG.md).

- **Major:** a component or prop is removed, or a token is renamed or removed.
- **Minor:** a new component, prop or token.
- **Patch:** fixes that don't change the public surface.

### Deprecating something

1. Mark it with a JSDoc `@deprecated` tag that names the replacement.
2. Add a **Deprecated** entry to the CHANGELOG with the replacement and a migration snippet.
3. Keep it working for at least one minor release.
4. Remove it only in the next major, and list it under **Removed** in that release.

```tsx
/** @deprecated Use `variant="ghost"`. Removed in 1.0. */
subtle?: boolean
```

````md
### Deprecated

- `Button` prop `subtle`. Use `variant="ghost"`.

  ```diff
  - <Button subtle>Skip</Button>
  + <Button variant="ghost">Skip</Button>
  ```
````

### Renaming a token

Keep the old CSS variable as an alias of the new one for the whole deprecation window, and note it in the CHANGELOG.

```css
--surface-raised: var(--surface-elevated); /* deprecated, removed in 1.0 */
```
