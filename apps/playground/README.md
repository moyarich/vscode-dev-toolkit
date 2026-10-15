# Toolkit playground

This app presents repository-owned documentation and working browser examples. Source pages live in `docs/` and demos in `examples/`; the app contains only the viewer and tooling.

From the repository root:

```sh
npm install
npm run dev
npm run build:playground
```

The development server serves the generated site at http://localhost:4173. GitHub Pages deploys `apps/playground/dist`.
