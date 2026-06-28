import {writeFile} from 'node:fs/promises'

import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {getPhotoBytes, getPhotoUri} from '../places-client.js'

export default class Photo extends BaseCommand {
  static description =
    "Fetch a place photo via the Places getMedia endpoint. Pass the photo's resource name (the `name` field from a place's photos[], format: places/PLACE_ID/photos/PHOTO_REF). One photo per call; the name expires, so fetch soon after the search."

  static examples = [
    '<%= config.bin %> photo "places/ChIJ…/photos/AaVG…" --out photo.jpg',
    '<%= config.bin %> photo "places/ChIJ…/photos/AaVG…" --url',
    '<%= config.bin %> photo "places/ChIJ…/photos/AaVG…" --out big.jpg --max-width 1600',
  ]

  static args = {
    name: Args.string({
      required: true,
      description: 'photo resource name (places/PLACE_ID/photos/PHOTO_REF); /media is appended automatically',
    }),
  }

  // baseFlags (--api-key, --debug) apply; the search-only field/output flags do not.
  static flags = {
    ...BaseCommand.baseFlags,
    out: Flags.string({char: 'o', description: 'download the image to this file path'}),
    url: Flags.boolean({description: 'print the short-lived photoUri instead of downloading (skipHttpRedirect=true)'}),
    'max-width': Flags.integer({description: 'maxWidthPx (1-4800)'}),
    'max-height': Flags.integer({description: 'maxHeightPx (1-4800). If neither dimension is set, both default to 1920 (long-edge cap → ~1080p short side in either orientation)'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Photo)
    const apiKey = this.getApiKey(flags)

    if (!flags.out && !flags.url) {
      this.error('Specify --out <file> to download the image, or --url to print the photo URL.', {
        exit: 2,
        suggestions: ['google-cli photo "<name>" --out photo.jpg', 'google-cli photo "<name>" --url'],
      })
    }

    const clamp = (n?: number) => (n === undefined ? undefined : Math.min(Math.max(n, 1), 4800))
    let maxWidthPx = clamp(flags['max-width'])
    let maxHeightPx = clamp(flags['max-height'])
    // getMedia requires at least one dimension and always preserves aspect ratio
    // (it scales so the LONGER edge fits). Defaulting only maxHeight would shrink
    // a portrait's width well below 1080; cap BOTH edges at 1920 so the short
    // side lands ~1080 in either orientation (≈1080p-class).
    if (maxWidthPx === undefined && maxHeightPx === undefined) {
      maxWidthPx = 1920
      maxHeightPx = 1920
    }

    if (flags.url) {
      const media = await getPhotoUri({photoName: args.name, apiKey, maxWidthPx, maxHeightPx, debug: flags.debug})
      this.log(media.photoUri)
      return
    }

    const {bytes, contentType} = await getPhotoBytes({
      photoName: args.name,
      apiKey,
      maxWidthPx,
      maxHeightPx,
      debug: flags.debug,
    })
    await writeFile(flags.out!, bytes)
    this.log(`wrote ${bytes.length} bytes (${contentType}) to ${flags.out}`)
  }
}
