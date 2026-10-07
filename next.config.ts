import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The gallery ships as a static site: every component page is prerendered.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  turbopack: { root: import.meta.dirname },
  // Phosphor is not on the default list; this keeps dev compiles to the icons actually imported.
  experimental: { optimizePackageImports: ["@phosphor-icons/react"] },
}

export default nextConfig
