/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The demo persists leads to a JSON file at runtime; linting is not part of the
  // pilot build gate, so keep `next build` focused on type-checking + compilation.
  eslint: { ignoreDuringBuilds: true },
  // Enable instrumentation.ts (Next 14) so we can warm the Ollama model on boot.
  experimental: { instrumentationHook: true },
};

export default nextConfig;
