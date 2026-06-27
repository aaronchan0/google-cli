// Field-mask resolution for the Places API (New).
//
// The X-Goog-FieldMask header drives BOTH what data comes back AND the billing
// SKU tier. The defaults below were validated live and span Pro + Enterprise
// fields (so a request bills at the Enterprise tier). Adding `reviews` /
// `editorialSummary` etc. pushes the request into Enterprise + Atmosphere — see
// README. Top-level response fields (e.g. nextPageToken) are NOT prefixed with
// `places.`; per-place fields are.

// Default per-place fields (without the `places.` prefix; added during normalization).
export const DEFAULT_FIELDS = [
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'primaryType',
  'websiteUri',
]

// Response fields that live at the response root, not under each place.
const TOP_LEVEL_FIELDS = new Set(['nextPageToken', 'routingSummaries', 'contextualContents'])

function splitList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// Turn a bare field name into a proper mask path. `places.*` and top-level
// fields are left as-is; everything else is prefixed with `places.`.
function normalize(field: string): string {
  const f = field.trim()
  if (f === '*') return f
  if (f.startsWith('places.')) return f
  if (TOP_LEVEL_FIELDS.has(f)) return f
  return `places.${f}`
}

export interface FieldFlags {
  fields?: string
  'add-fields'?: string
  'drop-fields'?: string
}

// Resolve the effective per-place field list (before normalization):
//   --fields           replaces the whole default set
//   --add-fields       adds to the defaults
//   --drop-fields      removes from the defaults
// `--fields` takes precedence; if set, add/drop are ignored.
export function resolveFields(flags: FieldFlags): string[] {
  const replace = splitList(flags.fields)
  let base: string[]

  if (replace.length > 0) {
    base = replace
  } else {
    const add = splitList(flags['add-fields'])
    const drop = new Set(splitList(flags['drop-fields']).map(normalize))
    base = [...DEFAULT_FIELDS, ...add]
    base = base.filter((f) => !drop.has(normalize(f)))
  }

  // Normalize + dedupe, preserving order.
  const seen = new Set<string>()
  const out: string[] = []
  for (const f of base) {
    const n = normalize(f)
    if (!seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }

  if (out.length === 0) {
    throw new Error('Resolved field mask is empty — specify at least one field via --fields/--add-fields.')
  }
  return out
}

// Build the X-Goog-FieldMask header value. `extraTopLevel` lets a command add
// response-root fields it needs (e.g. text-search adds `nextPageToken`).
export function buildFieldMask(flags: FieldFlags, extraTopLevel: string[] = []): string {
  const fields = resolveFields(flags)
  const all = [...extraTopLevel.map(normalize), ...fields]
  const seen = new Set<string>()
  const deduped = all.filter((f) => (seen.has(f) ? false : (seen.add(f), true)))
  return deduped.join(',')
}
