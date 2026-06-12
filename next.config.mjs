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
  experimental: {
    // sharp is a native addon — keep it out of the webpack bundle on
    // server routes that call generatePersonaPhoto (Vercel / local).
    serverComponentsExternalPackages: ["sharp"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...supabasePatterns,
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/7.x/**",
      },
    ],
    // We host fallback initials-avatars as SVG in the chat-images bucket
    // (see lib/admin/fallback-avatar.ts). Allowing SVG through next/image
    // is normally risky because of script-in-SVG XSS; the CSP below
    // sandboxes any rendered SVG so embedded scripts can't execute.
    // Combined with our remote-pattern allow-list (only Unsplash + our
    // own Supabase project), this is safe.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
  async redirects() {
    return [
      {
        source: "/v2",
        destination: "/",
        permanent: true,
      },
      {
        source: "/v2/:path*",
        destination: "/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
