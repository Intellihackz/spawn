/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  // production builds go to their own folder, so a dev server running at the same time never overwrites them
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
