import type { NextConfig } from "next";

// ── Content-Security-Policy ────────────────────────────────────────────────
// Allows: self, Supabase, Google Fonts, inline styles (Tailwind/Framer Motion)
// Blocks: frames, objects, external scripts, mixed content
const CSP = [
  "default-src 'self'",
  // Next.js needs 'unsafe-inline' + 'unsafe-eval' for RSC/hydration
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind v4 & Framer Motion use inline styles; Google Fonts stylesheet
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Google Fonts web-font files
  "font-src 'self' https://fonts.gstatic.com data:",
  // Allow images from self, data URIs, and any https source (avatars, og images)
  "img-src 'self' data: https:",
  // API calls: Supabase (HTTPS + WebSocket), Google APIs, self
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com https://calendar.googleapis.com https://gmail.googleapis.com",
  // No iframes
  "frame-src 'none'",
  // No plugins
  "object-src 'none'",
  // Restrict base tag hijacking
  "base-uri 'self'",
  // Only allow forms to submit to self
  "form-action 'self' https://accounts.google.com",
  // Upgrade HTTP → HTTPS for sub-resources
  "upgrade-insecure-requests",
]
  .join("; ")
  .trim();

const securityHeaders = [
  // Prevent DNS prefetching leaking visited URLs
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Enforce HTTPS for 2 years, include subdomains, eligible for preload
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Prevent embedding in iframes (clickjacking)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer to origin-only for cross-origin requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions Policy: allow microphone only on self (needed for recording)
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
  // CSP — the main defence against XSS
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
