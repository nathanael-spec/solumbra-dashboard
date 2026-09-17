/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A private page. Search engines and previews have no business here.
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ] }];
  },
};
export default nextConfig;
