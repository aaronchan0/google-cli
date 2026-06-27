import {Command, Flags} from '@oclif/core'

import {callPlaces, type PlacesResponse} from './places-client.js'
import {buildFieldMask, type FieldFlags} from './util/fields.js'
import {emit, type OutputMode} from './util/output.js'

// Shared base for all google-cli commands: auth, field-mask construction,
// the Places HTTP call, and output. Mirrors the slack-cli BaseCommand pattern.
export abstract class BaseCommand extends Command {
  static baseFlags = {
    json: Flags.boolean({description: 'Emit the raw JSON response instead of a text table'}),
    fields: Flags.string({description: 'Comma-separated field list that REPLACES the default fields'}),
    'add-fields': Flags.string({description: 'Comma-separated fields to ADD to the defaults'}),
    'drop-fields': Flags.string({description: 'Comma-separated fields to REMOVE from the defaults'}),
    'api-key': Flags.string({description: 'API key (overrides the GOOGLE_API_KEY env var)'}),
    debug: Flags.boolean({description: 'Log request URL, body, field mask, and HTTP status to stderr'}),
  }

  // Resolve the API key: --api-key flag wins, else GOOGLE_API_KEY env var.
  protected getApiKey(flags: {'api-key'?: string}): string {
    const key = flags['api-key'] ?? process.env.GOOGLE_API_KEY
    if (!key) {
      this.error('No API key. Set GOOGLE_API_KEY in your environment, or pass --api-key <key>.', {
        exit: 2,
        suggestions: ['export GOOGLE_API_KEY=AIza…', 'google-cli text-search "…" --api-key AIza…'],
      })
    }
    return key
  }

  protected fieldMask(flags: FieldFlags, extraTopLevel: string[] = []): string {
    return buildFieldMask(flags, extraTopLevel)
  }

  protected outputMode(flags: {json?: boolean}): OutputMode {
    return flags.json ? 'json' : 'text'
  }

  protected async places(
    endpoint: string,
    body: Record<string, unknown>,
    mask: string,
    apiKey: string,
    debug?: boolean,
  ): Promise<PlacesResponse> {
    return callPlaces({endpoint, body, mask, apiKey, debug})
  }

  protected emit(data: unknown, mode: OutputMode): void {
    emit(data, mode)
  }
}
