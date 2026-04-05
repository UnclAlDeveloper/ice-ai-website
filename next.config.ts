import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    productionBrowserSourceMaps: true,
    serverExternalPackages: ["onnxruntime-node", "@huggingface/transformers", "ffmpeg-static"],
    experimental: {
        serverActions: {
            bodySizeLimit: "1000mb"
        },
        proxyClientMaxBodySize: "1000mb",
    },
};

export default nextConfig;
