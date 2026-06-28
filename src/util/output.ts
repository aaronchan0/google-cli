// Output rendering for google-cli. Two modes: 'json' (pretty-printed JSON of
// the whole response) and 'text' (a multi-line block per place — one
// "field: value" line per requested field, blank line between places).

export type OutputMode = 'text' | 'json'

type Place = Record<string, unknown>

const REVIEW_SNIPPET_MAX = 160

// Flatten newlines and clamp a string for single-line display.
function snippet(text: string, max = REVIEW_SNIPPET_MAX): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max - 1) + '…' : oneLine
}

function localizedText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as {text: unknown}).text ?? '')
  }
  return ''
}

// Render the `reviews` array as readable, indented lines:
//   reviews:
//     - 5★ "Best tonkatsu…" — Jane D. (2 weeks ago)
function renderReviews(reviews: unknown[]): string {
  const lines = ['reviews:']
  for (const r of reviews) {
    const rev = (r ?? {}) as Record<string, unknown>
    const rating = rev.rating !== undefined ? `${rev.rating}★` : ''
    const text = snippet(localizedText(rev.text))
    const author = localizedText((rev.authorAttribution as Record<string, unknown> | undefined)?.displayName) ||
      String((rev.authorAttribution as Record<string, unknown> | undefined)?.displayName ?? '')
    const when = rev.relativePublishTimeDescription ? String(rev.relativePublishTimeDescription) : ''

    const parts: string[] = []
    if (rating) parts.push(rating)
    if (text) parts.push(`"${text}"`)
    let line = `  - ${parts.join(' ')}`.trimEnd()
    const meta: string[] = []
    if (author) meta.push(author)
    if (when) meta.push(when)
    if (meta.length) line += ` — ${meta.join(', ')}`
    lines.push(line)
  }
  return lines.join('\n')
}

// Render the `photos` array. Photos are binary, so we show each one's
// dimensions + author and a Google Maps link to view it (the photo's own
// googleMapsUri — no API key, unlike the getMedia endpoint):
//   photos:
//     - 1440x810  Ukai Japanese Bistro
//       https://www.google.com/maps/place//data=…
function renderPhotos(photos: unknown[]): string {
  const lines = ['photos:']
  for (const ph of photos) {
    const photo = (ph ?? {}) as Record<string, unknown>
    const w = photo.widthPx
    const h = photo.heightPx
    const dims = w !== undefined && h !== undefined ? `${w}x${h}` : ''
    const attrs = Array.isArray(photo.authorAttributions) ? photo.authorAttributions : []
    const author = attrs.length > 0 ? String((attrs[0] as Record<string, unknown>).displayName ?? '') : ''
    const uri = photo.googleMapsUri ? String(photo.googleMapsUri) : ''

    const head = [dims, author].filter(Boolean).join('  ')
    lines.push(`  - ${head}`.trimEnd())
    if (uri) lines.push(`    ${uri}`)
  }
  return lines.join('\n')
}

// Render a single requested field as its full text line(s), or '' to skip.
function renderField(place: Place, fieldPath: string): string {
  const key = fieldPath.replace(/^places\./, '').split('.')[0]
  const value = (place as Record<string, unknown>)[key]
  if (value === undefined || value === null) return ''

  // reviews / photos: multi-line, human-readable.
  if (key === 'reviews' && Array.isArray(value)) {
    return value.length === 0 ? '' : renderReviews(value)
  }
  if (key === 'photos' && Array.isArray(value)) {
    return value.length === 0 ? '' : renderPhotos(value)
  }

  const v = formatValue(key, value)
  return v === '' ? '' : `${key}: ${v}`
}

function formatValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return ''

  // Common Places shapes, flattened for readability.
  if (key === 'displayName' || key === 'primaryTypeDisplayName' || key === 'editorialSummary') {
    const t = localizedText(value)
    if (t) return t
  }
  if (key === 'location' && typeof value === 'object' && value !== null) {
    const loc = value as {latitude?: number; longitude?: number}
    if (loc.latitude !== undefined && loc.longitude !== undefined) {
      return `${loc.latitude},${loc.longitude}`
    }
  }
  if (Array.isArray(value)) {
    // Bulky arrays that aren't useful inline: summarize as a count.
    if (key === 'types' || key === 'addressComponents') {
      return `${value.length}`
    }
    // Other arrays: join scalar items; stringify object items.
    return value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join('|')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const TOP_LEVEL = new Set(['nextPageToken', 'routingSummaries', 'contextualContents'])

// Render each place as a multi-line block, one "field: value" line per
// requested field (raw field names, `places.` prefix stripped). `reviews` is
// expanded to indented per-review lines. Blank line between places; empty
// fields are skipped.
export function renderPlaces(places: Place[], requestedFields: string[]): string {
  // Per-place fields only; skip any top-level response fields.
  const fields = requestedFields.filter((f) => !TOP_LEVEL.has(f))

  if (places.length === 0) return '(no results)'

  const blocks: string[] = []
  for (const p of places) {
    const lines: string[] = []
    for (const f of fields) {
      const rendered = renderField(p, f)
      if (rendered === '') continue
      lines.push(rendered)
    }
    blocks.push(lines.join('\n'))
  }
  return blocks.join('\n\n')
}

export function emit(data: unknown, mode: OutputMode): void {
  if (mode === 'json') {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
    return
  }
  // text
  if (typeof data === 'string') {
    process.stdout.write(data + '\n')
    return
  }
  process.stdout.write(JSON.stringify(data, null, 2) + '\n')
}
