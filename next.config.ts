import { networkInterfaces } from 'node:os'
import type { NextConfig } from 'next'

/**
 * This machine's private network addresses, read when the dev server starts.
 *
 * **So a phone on the same Wi-Fi can open the dev server.** `npm run dev`
 * listens on every interface (`-H 0.0.0.0`), and Next's dev server still
 * refuses its own `/_next/` assets to any origin that is not localhost or
 * listed here, so the page would arrive and every screen — all of them load in
 * the browser — would stay blank. Read rather than written down, because the
 * address changes with the network; private ranges only, so a machine on a
 * public address does not open its dev server to the internet by accident.
 */
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .flatMap((entry) =>
    entry !== undefined &&
    entry.family === 'IPv4' &&
    !entry.internal &&
    PRIVATE.test(entry.address)
      ? [entry.address]
      : [],
  )

/**
 * Icons and the logo are imported as `…svg?react`, the convention the icon
 * pipeline emits (scripts/icons/build-icons.mjs). Turbopack matches that query
 * and hands the file to SVGR. `svgo: false` because the pipeline has already
 * normalised every used icon to currentColor, and a second optimiser rewriting
 * the markup would be a second owner of what the icon looks like.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * `next dev` writes a block of its own into CLAUDE.md on every start, which
   * puts an uncommitted change into a file whose wording is a stop-and-ask
   * (CLAUDE.md §9) and which nobody in this project wrote. Off, so the file
   * says what the people working on it decided and nothing else.
   */
  agentRules: false,
  allowedDevOrigins: lanAddresses,
  turbopack: {
    rules: {
      '*.svg': {
        condition: { query: /[?&]react(?=&|$)/ },
        loaders: [{ loader: '@svgr/webpack', options: { svgo: false } }],
        as: '*.js',
      },
    },
  },
}

export default nextConfig
