/** @type {import('next').NextConfig} */
const nextConfig = {
    // Allow cross-origin requests from the agent API during dev
    async headers() {
        return [{ source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] }];
    },
};

export default nextConfig;
