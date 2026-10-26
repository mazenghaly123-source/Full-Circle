# A Worker for the pages' markdown versions

Every public page has a markdown version for AI agents (Mazen, 26 Oct 2026), and agents reach it
three ways: `/about.md`, `/about` with `Accept: text/markdown`, and `/api/md/about`. The `.md` files
are built like the rest of the site (`src/pages/[page].md.ts`, from `src/md/registry.ts`), but
choosing by the Accept header, the `/api/md/` paths and the markdown headers need code at request
time. So the site now has one small Worker, `src/worker.ts`, which changes
[ADR 0002](./0002-cloudflare-workers-static-assets.md)'s "no Worker code"; there is still no Astro
adapter, and the pages are still static files.

## Consequences

- The Worker runs only on the paths `assets.run_worker_first` lists in `wrangler.jsonc`: the eight
  public pages, `*.md` and `/api/md/*`. Photos, scripts, styles and the other files are served
  straight from the assets as before, free and unmetered.
- Requests for those pages count as Worker requests (100,000 a day on the free plan, then the paid
  plan's price). Each one only reads an asset and sets headers.
- `public/_headers` still applies to the assets the Worker reads (the pages keep their security
  headers); the Worker adds `Vary: Accept` and the `Link` to llms.txt and ai.txt to the pages, and
  makes the markdown responses' headers itself, keeping the security ones.
- A page that gains a markdown version is added to `run_worker_first` too (`tests/unit/md.spec.ts`
  fails until it is).
- Without the Worker (a static-only deploy) the `.md` files, `llms.txt`, `llms-full.txt` and
  `ai.txt` still work; only the Accept header and `/api/md/` stop.
