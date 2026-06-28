// Output rendering for google-cli. Two modes: 'json' (pretty-printed JSON of
// the whole response) and 'text' (a labeled, multi-line block per place — one
// "Label: value" line per requested field, blank line between places).

export type OutputMode = 'text' | 'json'

type Place = Record<string, unknown>

// Pull a (possibly nested) value out of a place object given a mask path like
// `places.displayName` or `displayName.text`, and render it as a compact value.
function cell(place: Place, fieldPath: string): string {
  // Strip a leading `places.` — within a single place, paths are relative.
  const path = fieldPath.replace(/^places\./, '')
  const top = path.split('.')[0]
  const value = (place as Record<string, unknown>)[top]
  return formatValue(top, value)
}

function formatValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return ''

  // Common Places shapes, flattened for readability.
  if (key === 'displayName' || key === 'primaryTypeDisplayName' || key === 'editorialSummary') {
    if (typeof value === 'object' && value !== null && 'text' in value) {
      return String((value as {text: unknown}).text ?? '')
    }
  }
  if (key === 'location' && typeof value === 'object' && value !== null) {
    const v = value as {latitude?: number; longitude?: number}
    if (v.latitude !== undefined && v.longitude !== undefined) {
      return `${v.latitude},${v.longitude}`
    }
  }
  // Large/array fields: summarize count rather than dumping in text mode.
  if (Array.isArray(value)) {
    if (key === 'reviews' || key === 'photos' || key === 'types' || key === 'addressComponents') {
      return `${key}:${value.length}`
    }
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join('|')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

// Label for a field line: the raw field name as requested, with the `places.`
// prefix stripped (e.g. `places.userRatingCount` -> `userRatingCount`).
function label(fieldPath: string): string {
  return fieldPath.replace(/^places\./, '')
}

const TOP_LEVEL = new Set(['nextPageToken', 'routingSummaries', 'contextualContents'])

// Render each place as a multi-line block, one "field: value" line per
// requested field (raw field names, `places.` prefix stripped):
//   displayName: …
//   formattedAddress: …
//   rating: …
// Blank line between places. Empty fields are skipped.
export function renderPlaces(places: Place[], requestedFields: string[]): string {
  // Per-place fields only; skip any top-level response fields.
  const fields = requestedFields.filter((f) => !TOP_LEVEL.has(f))

  if (places.length === 0) return '(no results)'

  const blocks: string[] = []
  for (const p of places) {
    const lines: string[] = []
    for (const f of fields) {
      const value = cell(p, f)
      if (value === '') continue
      lines.push(`${label(f)}: ${value}`)
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
