const supabasePatterns = [];
try {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (u) {
    const host = new URL(u).hostname;
    supabasePatterns.push({
      protocol: "https",
      hostname: host,
      pathname: "/storage/v1/object/public/**",
    });
  }
} catch {
  /* ignore invalid env */
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...supabasePatterns,
    ],
  },
  /** Fewer native file watchers + polling (see `npm run dev`) — avoids macOS EMFILE / dev crashes on save. */
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 600,
        followSymlinks: false,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/.cursor/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
