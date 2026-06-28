import {Args, Flags} from '@oclif/core'

import {BaseCommand, searchFlags} from '../base.js'
import {ENDPOINTS, type PlacesResponse} from '../places-client.js'
import {PlacesApiError} from '../util/errors.js'
import {resolveFields} from '../util/fields.js'
import {renderPlaces} from '../util/output.js'

export default class TextSearch extends BaseCommand {
  static description =
    'Places API (New) Text Search — natural-language place search. Default returns one page (≤20); use --max to paginate up to 60.'

  static examples = [
    '<%= config.bin %> text-search "onsen ryokan near Beppu Onsen"',
    '<%= config.bin %> text-search "onsen ryokan near Beppu Onsen" --max 60 --json',
    '<%= config.bin %> text-search "ryokan Kannawa" --add-fields editorialSummary,reviews',
    '<%= config.bin %> text-search "hotels in Yufuin" --lat 33.264 --lng 131.355 --radius 4000',
  ]

  static args = {
    query: Args.string({required: true, description: 'natural-language search text'}),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    ...searchFlags,
    max: Flags.integer({description: 'target number of results (1-60); auto-paginates as needed', default: 20}),
    'page-size': Flags.integer({description: 'results per request (1-20)', default: 20}),
    language: Flags.string({description: 'languageCode', default: 'en'}),
    region: Flags.string({description: 'regionCode', default: 'JP'}),
    lat: Flags.string({description: 'locationBias circle center latitude (with --lng, --radius)'}),
    lng: Flags.string({description: 'locationBias circle center longitude'}),
    radius: Flags.string({description: 'locationBias circle radius in meters (0-50000)'}),
    rank: Flags.string({description: 'rankPreference', options: ['RELEVANCE', 'DISTANCE']}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(TextSearch)
    const apiKey = this.getApiKey(flags)

    const max = Math.min(Math.max(flags.max, 1), 60)
    const pageSize = Math.min(Math.max(flags['page-size'], 1), 20)
    const mask = this.fieldMask(flags, ['nextPageToken'])

    const baseBody: Record<string, unknown> = {
      textQuery: args.query,
      languageCode: flags.language,
      regionCode: flags.region,
      pageSize,
    }
    if (flags.rank) baseBody.rankPreference = flags.rank
    if (flags.lat && flags.lng) {
      const circle: Record<string, unknown> = {
        center: {latitude: Number(flags.lat), longitude: Number(flags.lng)},
      }
      if (flags.radius) circle.radius = Number(flags.radius)
      baseBody.locationBias = {circle}
    }

    const places: Array<Record<string, unknown>> = []
    const seen = new Set<string>()
    let pageToken: string | undefined
    let lastResp: PlacesResponse = {}

    while (places.length < max) {
      const body = {...baseBody}
      if (pageToken) body.pageToken = pageToken

      // A freshly-issued nextPageToken can take a moment to become valid; retry
      // a couple of times on the resulting 400 before giving up.
      let resp: PlacesResponse | undefined
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          resp = await this.places(ENDPOINTS.textSearch, body, mask, apiKey, flags.debug)
          break
        } catch (err) {
          const isTokenRetry = Boolean(pageToken) && err instanceof PlacesApiError && err.httpStatus === 400
          if (isTokenRetry && attempt < 3) {
            await new Promise((r) => setTimeout(r, 2000))
            continue
          }
          throw err
        }
      }
      if (!resp) break
      lastResp = resp

      for (const p of resp.places ?? []) {
        const id = (p.id as string) ?? (p.name as string) ?? JSON.stringify(p.displayName ?? p)
        if (!seen.has(id)) {
          seen.add(id)
          places.push(p)
          if (places.length >= max) break
        }
      }

      pageToken = resp.nextPageToken
      if (!pageToken) break
    }

    const trimmed = places.slice(0, max)

    if (flags.json) {
      this.emit({places: trimmed, count: trimmed.length, nextPageToken: lastResp.nextPageToken}, 'json')
      return
    }
    const requested = resolveFields(flags)
    this.emit(renderPlaces(trimmed, requested), 'text')
  }
}
