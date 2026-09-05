/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/daily/[name]': ['./data/daily/**/*'],
  },
};
export default nextConfig;
