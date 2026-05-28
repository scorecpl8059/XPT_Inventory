/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — produces /out directory, deployed to S3 + CloudFront
  output: 'export',

  // Required for correct S3 routing (object keys end with /)
  trailingSlash: true,

  // Image optimization requires a server; disable for static export
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
