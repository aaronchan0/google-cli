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

// Human-friendly labels for common fields; otherwise derive one from the field
// name (e.g. `userRatingCount` -> "User Rating Count").
const LABELS: Record<string, string> = {
  displayName: 'Name',
  formattedAddress: 'Address',
  shortFormattedAddress: 'Address',
  location: 'Location',
  rating: 'Rating',
  userRatingCount: 'Reviews',
  primaryType: 'Type',
  primaryTypeDisplayName: 'Type',
  websiteUri: 'Website',
  nationalPhoneNumber: 'Phone',
  internationalPhoneNumber: 'Phone',
  editorialSummary: 'Summary',
  priceLevel: 'Price',
  businessStatus: 'Status',
  googleMapsUri: 'Maps',
}

function label(fieldPath: string): string {
  const key = fieldPath.replace(/^places\./, '').split('.')[0]
  if (LABELS[key]) return LABELS[key]
  // camelCase -> "Title Case"
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const TOP_LEVEL = new Set(['nextPageToken', 'routingSummaries', 'contextualContents'])

// Render each place as a labeled multi-line block:
//   Name: …
//   Address: …
//   Rating: …
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
