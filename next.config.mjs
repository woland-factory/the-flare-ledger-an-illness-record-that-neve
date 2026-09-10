/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    memoryBasedWorkersCount: true,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
