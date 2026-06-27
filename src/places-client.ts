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
