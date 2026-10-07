# Tangent UI

React components and blocks with calm, physical motion, built on [Base UI](https://base-ui.com), Tailwind CSS v4 and [Motion](https://motion.dev), following shadcn/ui conventions.

- `components/ui/` holds one file per component or block.
- `app/foundation.css` holds the design tokens (color, surface, radius, shadow, accent, light and dark themes); `app/globals.css` exposes them as Tailwind utilities.
- `lib/motion-tokens.ts` holds the shared springs, durations and easings.
- `components/demos/` holds a live demo for every component; the gallery lives in `app/`.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000. Switch the theme and accent from the header.

## Build

```bash
npm run build
```

The gallery is exported as a static site to `out/`.

## Record a demo

With the dev server running on port 3456:

```bash
node scripts/record-demo.mjs <name> [--dark]
```

## License

See `THIRD_PARTY_NOTICES` for third-party licenses. Demo photos are from Unsplash, listed in `public/media/CREDITS.md`.
