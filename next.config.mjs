/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@anthropic-ai/sdk", "chromadb", "pdf-parse", "mammoth", "exceljs"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("chromadb", "@chroma-core/default-embed", "pdf-parse", "mammoth", "exceljs");
    }
    return config;
  },
};

export default nextConfig;
