/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // The app ships no bitmap images, so the built-in optimizer (and its heavy
  // sharp dependency) is dead weight in the runtime image.
  images: { unoptimized: true },
  // PGlite ships a WASM binary that must load from node_modules at runtime,
  // not be bundled by the server compiler. Prisma is external for the same
  // reason (its query engine).
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pglite-prisma-adapter",
    "@prisma/client",
  ],
  experimental: {
    memoryBasedWorkersCount: true,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
