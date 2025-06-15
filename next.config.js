/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { webpack }) => {
      // Define Vue feature flags to eliminate warnings from Milkdown's Vue components
      config.plugins.push(
        new webpack.DefinePlugin({
          __VUE_OPTIONS_API__: JSON.stringify(true),
          __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
        })
      )
      
      return config
    },
  }
  
  module.exports = nextConfig