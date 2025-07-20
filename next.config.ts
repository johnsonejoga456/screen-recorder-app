import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Excluded supabase/functions from build
  exclude: ["supabase/functions/**/*"],
};

export default nextConfig;
