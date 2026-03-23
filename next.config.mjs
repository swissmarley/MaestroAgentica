/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk", "chromadb", "pdf-parse", "mammoth", "xlsx"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("chromadb", "@chroma-core/default-embed", "pdf-parse", "mammoth", "xlsx");
    }
    return config;
  },
};

export default nextConfig;
