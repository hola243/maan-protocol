/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/landing.html' },
      ],
    };
  },
};
export default nextConfig;
