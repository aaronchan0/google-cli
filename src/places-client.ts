// Thin wrapper around the Places API (New) HTTP endpoints using native fetch
// (Node 20+). Handles headers, the required field mask, and error mapping.

import {PlacesApiError, type GoogleErrorBody} from './util/errors.js'

export const ENDPOINTS = {
  textSearch: 'https://places.googleapis.com/v1/places:searchText',
  nearby: 'https://places.googleapis.com/v1/places:searchNearby',
} as const

export interface PlacesCallOptions {
  endpoint: string
  body: Record<string, unknown>
  mask: string
  apiKey: string
  debug?: boolean
}

export interface PlacesResponse {
  places?: Array<Record<string, unknown>>
  nextPageToken?: string
  [key: string]: unknown
}

export async function callPlaces(opts: PlacesCallOptions): Promise<PlacesResponse> {
  const {endpoint, body, mask, apiKey, debug} = opts

  if (debug) {
    process.stderr.write(`POST ${endpoint}\n`)
    process.stderr.write(`X-Goog-FieldMask: ${mask}\n`)
    process.stderr.write(`body: ${JSON.stringify(body)}\n`)
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': mask,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()

  if (debug) {
    process.stderr.write(`HTTP ${res.status}\n`)
  }

  if (!res.ok) {
    let parsed: GoogleErrorBody | string = text
    try {
      parsed = JSON.parse(text) as GoogleErrorBody
    } catch {
      // leave as raw text
    }
    throw new PlacesApiError(res.status, parsed)
  }

  if (!text) return {}
  return JSON.parse(text) as PlacesResponse
}

const MEDIA_BASE = 'https://places.googleapis.com/v1'

// Normalize a photo resource name into the getMedia path. Accepts either the
// bare photo name (`places/.../photos/...`) or one already ending in `/media`.
function mediaName(photoName: string): string {
  const trimmed = photoName.replace(/^\/+/, '').replace(/\/+$/, '')
  return trimmed.endsWith('/media') ? trimmed : `${trimmed}/media`
}

export interface PhotoMediaOptions {
  photoName: string
  apiKey: string
  maxWidthPx?: number
  maxHeightPx?: number
  debug?: boolean
}

// getMedia with skipHttpRedirect=true → returns { name, photoUri } (a
// short-lived URL to the image). No image bytes are downloaded.
export async function getPhotoUri(opts: PhotoMediaOptions): Promise<{name: string; photoUri: string}> {
  const {photoName, apiKey, maxWidthPx, maxHeightPx, debug} = opts
  const params = new URLSearchParams({skipHttpRedirect: 'true'})
  if (maxWidthPx) params.set('maxWidthPx', String(maxWidthPx))
  if (maxHeightPx) params.set('maxHeightPx', String(maxHeightPx))
  const url = `${MEDIA_BASE}/${mediaName(photoName)}?${params.toString()}`

  if (debug) process.stderr.write(`GET ${url}\n`)
  const res = await fetch(url, {headers: {'X-Goog-Api-Key': apiKey}})
  const text = await res.text()
  if (debug) process.stderr.write(`HTTP ${res.status}\n`)

  if (!res.ok) {
    let parsed: GoogleErrorBody | string = text
    try {
      parsed = JSON.parse(text) as GoogleErrorBody
    } catch {
      // leave raw
    }
    throw new PlacesApiError(res.status, parsed)
  }
  return JSON.parse(text) as {name: string; photoUri: string}
}

// getMedia (default redirect) → returns the raw image bytes plus the
// Content-Type. fetch follows the redirect to the image automatically.
export async function getPhotoBytes(
  opts: PhotoMediaOptions,
): Promise<{bytes: Uint8Array; contentType: string}> {
  const {photoName, apiKey, maxWidthPx, maxHeightPx, debug} = opts
  const params = new URLSearchParams()
  if (maxWidthPx) params.set('maxWidthPx', String(maxWidthPx))
  if (maxHeightPx) params.set('maxHeightPx', String(maxHeightPx))
  const url = `${MEDIA_BASE}/${mediaName(photoName)}?${params.toString()}`

  if (debug) process.stderr.write(`GET ${url}\n`)
  const res = await fetch(url, {headers: {'X-Goog-Api-Key': apiKey}})
  if (debug) process.stderr.write(`HTTP ${res.status}\n`)

  if (!res.ok) {
    const text = await res.text()
    let parsed: GoogleErrorBody | string = text
    try {
      parsed = JSON.parse(text) as GoogleErrorBody
    } catch {
      // leave raw
    }
    throw new PlacesApiError(res.status, parsed)
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  return {bytes: buf, contentType: res.headers.get('content-type') ?? 'application/octet-stream'}
}
