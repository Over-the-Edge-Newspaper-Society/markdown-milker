/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { webpack, isServer }) => {
    // Define Vue feature flags to eliminate warnings from Milkdown's Vue components
    config.plugins.push(
      new webpack.DefinePlugin({
        __VUE_OPTIONS_API__: JSON.stringify(true),
        __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
      })
    )

    // Fix Y.js and related packages for browser compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }

      // Handle Y.js imports to prevent duplicate loading
      config.resolve.alias = {
        ...config.resolve.alias,
        'yjs': require.resolve('yjs'),
        'y-websocket': require.resolve('y-websocket'),
        'y-prosemirror': require.resolve('y-prosemirror'),
        'lib0': require.resolve('lib0'),
        'lib0/mutex': require.resolve('lib0/mutex'),
      }
    }

    // Mark Y.js related packages as external for server-side
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'yjs': 'commonjs yjs',
        'y-websocket': 'commonjs y-websocket',
        'y-prosemirror': 'commonjs y-prosemirror',
        'lib0': 'commonjs lib0',
        'lib0/mutex': 'commonjs lib0/mutex',
      })
    }

    // Add specific handling for lib0 encoding/decoding issues
    config.module.rules.push({
      test: /\.m?js$/,
      include: /node_modules\/(yjs|y-websocket|y-prosemirror|lib0)/,
      resolve: {
        fullySpecified: false
      }
    })
    
    return config
  },
  
  // Experimental features to help with ES modules
  experimental: {
    esmExternals: 'loose',
  },
  
  // Transpile Y.js related packages
  transpilePackages: ['yjs', 'y-websocket', 'y-prosemirror', 'lib0'],
}

module.exports = nextConfig