# frontend/

React 19 + TypeScript, Vite, Tailwind v4, shadcn/ui-style components, TanStack Query, React Router. Setup and run: see "Run it" in the root README.

- `src/modules/<module>/index.tsx` exports `routes: ModuleRoute[]` (`{path, layout: "desktop" | "mobile" | "tablet", element}`). The module owns its folder.
- `src/app/`: providers, `routes.tsx` and `nav.ts` (shared zone, one line per module), layouts (m2 takes them over).
- `src/ui/`: shared components (Button, Input, Checkbox, Card, Badge, Tabs, Dialog, Toaster, Table; m2 adds more). Use these and the tokens in `src/styles/tokens.css` only; see `docs/design.md`.
- `src/lib/`: `api.get/post`, `useSimClock()`, `fmtTime`, `t()`, core `types.ts`.
- Tests: vitest, `*.test.ts` next to the code. `npm run lint` is `tsc --noEmit`.
