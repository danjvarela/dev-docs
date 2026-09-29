# dev-docs

Docs site for this org, built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build). Content comes from this repo's **GitHub Wiki**, not from files committed here — edit docs through GitHub's wiki editor, and a CI pipeline converts and redeploys the site automatically on every wiki edit (and on push to `master`).

See [AGENTS.md](./AGENTS.md) for how the sync pipeline works.

## Commands

| Command          | Action                                       |
| :---------------- | :-------------------------------------------- |
| `pnpm install`    | Install dependencies                          |
| `pnpm dev`        | Start local dev server at `localhost:4321`    |
| `pnpm build`      | Build production site to `./dist/`            |
| `pnpm preview`    | Preview a build locally before deploying      |
| `pnpm sync-wiki`  | Pull wiki content and regenerate docs locally |
| `pnpm test`       | Run the conversion module's test suite        |

Deployed to Cloudflare Workers via `wrangler deploy` in CI, gated by Cloudflare Access.
