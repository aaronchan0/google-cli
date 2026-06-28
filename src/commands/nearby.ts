import {Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {ENDPOINTS} from '../places-client.js'
import {resolveFields} from '../util/fields.js'
import {renderPlaces} from '../util/output.js'

export default class Nearby extends BaseCommand {
  static description =
    'Places API (New) Nearby Search — places within a radius of a point. Capped at 20 results (no pagination).'

  static examples = [
    '<%= config.bin %> nearby --lat 33.279426 --lng 131.491446 --radius 5000',
    '<%= config.bin %> nearby --lat 33.279426 --lng 131.491446 --type japanese_inn,hotel --rank DISTANCE',
    '<%= config.bin %> nearby --lat 33.279426 --lng 131.491446 --radius 3000 --json',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    lat: Flags.string({description: 'circle center latitude', required: true}),
    lng: Flags.string({description: 'circle center longitude', required: true}),
    radius: Flags.string({description: 'circle radius in meters (0-50000)', default: '5000'}),
    type: Flags.string({description: 'comma-separated includedTypes', default: 'japanese_inn'}),
    max: Flags.integer({description: 'maxResultCount (1-20)', default: 20}),
    rank: Flags.string({description: 'rankPreference', options: ['POPULARITY', 'DISTANCE'], default: 'DISTANCE'}),
    language: Flags.string({description: 'languageCode', default: 'en'}),
    region: Flags.string({description: 'regionCode', default: 'JP'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Nearby)
    const apiKey = this.getApiKey(flags)

    let max = flags.max
    if (max > 20) {
      process.stderr.write('warning: Nearby Search caps at 20 results; clamping --max to 20.\n')
      max = 20
    }
    max = Math.max(max, 1)

    const radius = Math.min(Math.max(Number(flags.radius), 0), 50000)
    const includedTypes = flags.type
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const body: Record<string, unknown> = {
      maxResultCount: max,
      rankPreference: flags.rank,
      languageCode: flags.language,
      regionCode: flags.region,
      locationRestriction: {
        circle: {
          center: {latitude: Number(flags.lat), longitude: Number(flags.lng)},
          radius,
        },
      },
    }
    if (includedTypes.length > 0) body.includedTypes = includedTypes

    const mask = this.fieldMask(flags)
    const resp = await this.places(ENDPOINTS.nearby, body, mask, apiKey, flags.debug)
    const places = resp.places ?? []

    if (flags.json) {
      this.emit({places, count: places.length}, 'json')
      return
    }
    const requested = resolveFields(flags)
    this.emit(renderPlaces(places, requested), 'text')
  }
}
