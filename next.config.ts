import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads de PDF/PPTX passam de 1MB (limite padrão de server actions).
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
