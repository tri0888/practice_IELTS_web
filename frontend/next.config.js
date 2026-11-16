/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/Home',
        permanent: true,
      },
    ]
  },
  // The API is a separate service (../backend). The browser always calls same-origin
  // /api/*, which is proxied here, so no CORS is needed. Evaluated at build time.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
