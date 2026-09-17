import type { NextConfig } from 'next'

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
