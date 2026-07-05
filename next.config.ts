import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Only treat .tsx, .ts, .jsx, .js files as pages — prevent icon.svg being treated as a route
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
};

export default nextConfig;
