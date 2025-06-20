/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for AI-heavy applications
  images: {
    domains: ['api.solveintelligence.com'],
    formats: ['image/webp', 'image/avif']
  },
  // Enable source maps in development
  productionBrowserSourceMaps: false,
  // Bundle analyzer for performance monitoring
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Optimize bundle splitting for AI components
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          ai: {
            test: /[\\/]src[\\/]components[\\/](ai|patent)[\\/]/,
            name: 'ai-components',
            chunks: 'all',
          },
          ui: {
            test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
            name: 'ui-components',
            chunks: 'all',
          }
        }
      }
    }
    return config
  }
}

module.exports = nextConfig