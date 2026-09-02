/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/download/android" && (request.method === "GET" || request.method === "HEAD")) {
      const downloadName = "daxiang-abao-alarm-xiaomi12spro-v1.1.4.apk";
      const assetUrl = new URL(`/downloads/${downloadName}`, request.url);
      const asset = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
      if (!asset.ok || !asset.body) return new Response("Android 安装包暂时无法下载", { status: 503 });

      const headers = new Headers(asset.headers);
      headers.set("content-type", "application/vnd.android.package-archive");
      headers.set("content-disposition", `attachment; filename="${downloadName}"`);
      headers.set("cache-control", "public, max-age=3600");
      headers.set("x-content-type-options", "nosniff");
      return new Response(request.method === "HEAD" ? null : asset.body, { status: 200, headers });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
