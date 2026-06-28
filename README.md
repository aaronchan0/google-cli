# google-cli

A small TypeScript CLI for the **Google Places API (New)** — `text-search` and
`nearby` — authed with a single `GOOGLE_API_KEY`. Built on
[oclif](https://oclif.io) v4 (ESM), matching the conventions of `slack-cli`.

## Install

```bash
./install.sh          # npm install → build → npm link
# or:
npm install && npm run build && npm link
```

## Auth

The CLI reads your key from the `GOOGLE_API_KEY` environment variable (or the
`--api-key` flag, which wins):

```bash
export GOOGLE_API_KEY="AIza…"
```

Requires the **Places API (New)** to be enabled on the key's Google Cloud
project (the old "Places API" is Legacy and can no longer be enabled).

## Commands

### `text-search <query>`

Natural-language search. Returns **one page (≤20)** by default; `--max <1-60>`
auto-paginates as needed (the API ceiling is 60 results / 3 pages).

```bash
google-cli text-search "onsen ryokan near Beppu Onsen"
google-cli text-search "onsen ryokan near Beppu Onsen" --max 60 --json
google-cli text-search "ryokan Kannawa" --add-fields editorialSummary,reviews
google-cli text-search "hotels in Yufuin" --lat 33.264 --lng 131.355 --radius 4000
```

Flags: `--max`, `--page-size`, `--language` (def `en`), `--region` (def `JP`),
`--lat`/`--lng`/`--radius` (locationBias), `--rank RELEVANCE|DISTANCE`, plus the
common flags below.

### `nearby`

Places within a radius of a point. **Hard-capped at 20 results, no pagination.**

```bash
google-cli nearby --lat 33.279426 --lng 131.491446 --radius 5000
google-cli nearby --lat 33.279426 --lng 131.491446 --type japanese_inn,hotel
google-cli nearby --lat 33.279426 --lng 131.491446 --radius 3000 --json
```

Flags: `--lat`/`--lng` (required), `--radius` (def 5000, ≤50000),
`--type` (def `japanese_inn`, comma list → `includedTypes`), `--max` (1-20),
`--rank POPULARITY|DISTANCE` (def `DISTANCE`), `--language`, `--region`.

## Common flags (all commands)

| Flag | Purpose |
|------|---------|
| `--json` | Emit raw JSON instead of the text output (default: text) |
| `--fields a,b,c` | **Replace** the default field set entirely |
| `--add-fields a,b` | **Add** fields to the defaults |
| `--drop-fields a` | **Remove** fields from the defaults |
| `--api-key <key>` | Override `GOOGLE_API_KEY` |
| `--debug` | Log request URL, body, field mask, HTTP status to stderr |
| `-h`, `--help` | Help (per command too: `google-cli text-search -h`) |

Bare field names are auto-prefixed with `places.` (so `rating` →
`places.rating`). `--fields` takes precedence over `--add-fields`/`--drop-fields`.

### Default fields

```
displayName, formattedAddress, location, rating, userRatingCount, primaryType, websiteUri
```

## Billing note (the field mask drives cost)

The `X-Goog-FieldMask` determines which **SKU tier** you're billed at — you pay
the highest tier among the fields you request:

- `rating` / `userRatingCount` → **Enterprise** SKU (the defaults land here)
- `reviews` / `editorialSummary` / amenity fields → **Enterprise + Atmosphere**
- IDs / address / location / displayName only → **Pro** / **Essentials**

Each request is one billable event (and each `text-search` page is a separate
request). The 2025 model gives a per-SKU free monthly cap (Essentials 10k / Pro
5k / Enterprise 1k events) — light usage stays free. Check usage in
**Cloud Billing → Reports → Group by SKU**.

## Notes

- macOS / Node 20+ (uses native `fetch`).
- Routes / Geocoding are out of scope for now but can be added as sibling
  commands (`routes`, `geocode`) using the same client/base layout.
