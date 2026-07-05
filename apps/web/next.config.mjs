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
};

export default nextConfig;
