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
