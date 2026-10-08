# Tangent UI

React components and blocks with calm, physical motion, built on [Base UI](https://base-ui.com), Tailwind CSS v4 and [Motion](https://motion.dev), following shadcn/ui conventions.

- `components/ui/` holds one file per component or block.
- `app/foundation.css` holds the design tokens (color, surface, radius, shadow, accent, light and dark themes); `app/globals.css` exposes them as Tailwind utilities.
- `lib/motion-tokens.ts` holds the shared springs, durations and easings.
- `components/demos/` holds a live demo for every component; the gallery lives in `app/`.

## Use in your project

Components are served as a shadcn registry. Add the namespace to your `components.json`:

```json
{
  "registries": { "@tangent": "https://<site>/r/{name}.json" }
}
```

Then add components by name:

```bash
npx shadcn add @tangent/button
```

Replace `<site>` with the host the gallery is deployed to. The registry follows semver; see [CHANGELOG.md](CHANGELOG.md) for releases and deprecations.

## Tokens and agent context

All of these are generated from source on `npm run dev` and `npm run build`, and are not committed.

- `/tokens.json`: design tokens in the W3C DTCG shape (`$value`, `$type` where one fits, aliases), with light, dark and accent modes in `$extensions["tangent.modes"]` (`npm run gen:tokens`).
- `/r/registry.json` and `/r/<name>.json`: the shadcn registry (`npm run gen:registry`).
- `/llms.txt`: a plain index of the library for agents (`npm run gen:registry`).

`npm run audit:tokens` fails when hardcoded colors, default-palette utilities or raw easing grow in any file under `components/ui`. Run `npm run audit:tokens -- --update` to accept new counts on purpose.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions, checks and the deprecation policy, and [CHANGELOG.md](CHANGELOG.md) for what changed.

## License

See `THIRD_PARTY_NOTICES` for third-party licenses. Demo photos are from Unsplash, listed in `public/media/CREDITS.md`.
