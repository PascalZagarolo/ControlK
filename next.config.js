/** @type {import('next').NextConfig} */
const nextConfig = {
  // Push the Next.js dev-indicator (the floating "compile / issue" badge)
  // out of the design's bottom-right. Only applies in dev — production
  // builds never show it.
  devIndicators: {
    position: 'bottom-left',
  },
};

module.exports = nextConfig;
