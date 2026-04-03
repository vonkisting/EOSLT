import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    /** Exposes Vercel’s server build flag to the client for OBS transport selection. */
    NEXT_PUBLIC_STREAM_OBS_VERCEL: process.env.VERCEL === "1" ? "1" : "",
  },
};

export default nextConfig;
