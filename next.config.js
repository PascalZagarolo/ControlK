/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable the Next.js dev-indicator entirely. The floating 'N' badge
  // in the page corner is design noise; build/compile feedback comes
  // through the terminal. Production builds never show it; this also
  // removes it in dev.
  devIndicators: false,
};

module.exports = nextConfig;
