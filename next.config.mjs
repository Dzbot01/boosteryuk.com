/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Gambar logo/ikon dari CDN eksternal dipakai via <img> biasa (bukan next/image), aman.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};
export default nextConfig;
