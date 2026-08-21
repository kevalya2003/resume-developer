import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright spawns a real browser and pdfjs ships a Node-specific legacy
  // build. Bundling either one breaks them, so they stay external and are
  // required at runtime from node_modules.
  serverExternalPackages: ["playwright", "pdfjs-dist"],

  // Emits a self-contained server with only the dependencies it actually uses,
  // which is what makes the runtime image small enough to be worth shipping.
  //
  // Only for the container build: the standalone output has to be launched with
  // `node server.js`, and `next start` refuses to run against it. Gating it here
  // keeps the local build on the supported path while the Dockerfile opts in.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,

  // Standalone output ships only the files the tracer can follow from an
  // import. Both of these packages then read data files by a path they compute
  // at runtime, which nothing static points at: playwright-core loads
  // browsers.json to decide which browser build to launch, and pdfjs loads its
  // character maps and standard fonts the same way. Without this the server
  // starts happily and fails on the first render with a missing module.
  // @napi-rs/canvas is where pdfjs gets DOMMatrix and Path2D from when it runs
  // outside a browser. It is an optional dependency loaded through a dynamic
  // require, so the tracer never sees it, and without it pdfjs throws on import
  // rather than on use — meaning the ATS check fails while exports keep working.
  outputFileTracingIncludes: {
    "/api/render": ["./node_modules/playwright-core/**"],
    "/api/ats": [
      "./node_modules/playwright-core/**",
      "./node_modules/pdfjs-dist/**",
      "./node_modules/@napi-rs/**",
    ],
  },
};

export default nextConfig;
