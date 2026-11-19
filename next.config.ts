import type { NextConfig } from "next";
import { devTunnelOrigins } from "./lib/dev-tunnel-origin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: devTunnelOrigins(process.env.NODE_ENV, process.env.DEV_TUNNEL_HOST),
};

export default nextConfig;
