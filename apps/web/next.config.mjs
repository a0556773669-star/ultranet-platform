/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ultranet/shared-types"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "*.app.github.dev",
        "super-system-p7jx66j546x4h7xq4-3000.app.github.dev",
      ],
    },
  },
  async headers() {
    return [
      {
        // Never let the SW file itself go stale in a cache/CDN — the browser
        // must always see byte-for-byte changes to detect a new version.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
