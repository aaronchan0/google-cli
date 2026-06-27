// Output rendering for google-cli. Two modes: 'json' (pretty-printed JSON of
// the whole response) and 'text' (a tab-separated table over the requested
// fields, with nested values flattened for human reading).

export type OutputMode = 'text' | 'json'

type Place = Record<string, unknown>

// Pull a (possibly nested) value out of a place object given a mask path like
// `places.displayName` or `displayName.text`, and render it as a compact cell.
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

// Header label for a column (drop the `places.` prefix).
function header(fieldPath: string): string {
  return fieldPath.replace(/^places\./, '')
}

const TOP_LEVEL = new Set(['nextPageToken', 'routingSummaries', 'contextualContents'])

export function renderPlacesTable(places: Place[], requestedFields: string[]): string {
  // Render per-place fields as columns; skip any top-level response fields.
  const cols = requestedFields.filter((f) => !TOP_LEVEL.has(f))

  if (places.length === 0) return '(no results)'

  const lines: string[] = []
  lines.push(cols.map(header).join('\t'))
  for (const p of places) {
    lines.push(cols.map((c) => cell(p, c)).join('\t'))
  }
  return lines.join('\n')
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
