// Error type for Places API failures, with a clear, actionable message derived
// from the HTTP status and Google's structured error body.

export interface GoogleErrorBody {
  error?: {
    code?: number
    status?: string
    message?: string
  }
}

export class PlacesApiError extends Error {
  readonly httpStatus: number
  readonly googleStatus?: string

  constructor(httpStatus: number, body: GoogleErrorBody | string | undefined) {
    const parsed = typeof body === 'string' ? undefined : body
    const gErr = parsed?.error
    const gMsg = gErr?.message
    const gStatus = gErr?.status

    let hint = ''
    switch (httpStatus) {
      case 400:
        // Almost always a malformed request — bad field mask, bad lat/lng, etc.
        hint = 'Bad request (check field names / parameters).'
        break
      case 403:
        hint =
          'Forbidden — API key invalid, the "Places API (New)" is not enabled on the project, or the key has application/API restrictions blocking this call.'
        break
      case 429:
        hint = 'Rate limit / quota exceeded for this SKU.'
        break
      default:
        hint = `HTTP ${httpStatus}.`
    }

    const detail = gMsg ? ` — ${gMsg}` : typeof body === 'string' && body ? ` — ${body.slice(0, 300)}` : ''
    super(`Places API error: ${hint}${detail}`)
    this.name = 'PlacesApiError'
    this.httpStatus = httpStatus
    this.googleStatus = gStatus
  }
}
