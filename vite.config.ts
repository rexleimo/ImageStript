import { defineConfig } from "vite";
import babel from "vite-plugin-babel";
import { lingui } from "@lingui/vite-plugin";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  plugins: [
    babel({
      babelConfig: {
        presets: ["@babel/preset-typescript"],
        plugins: ["@lingui/babel-plugin-lingui-macro"],
      },
      include: /\.[jt]sx?$/,
      enforce: "pre",
    }),
    lingui(),
  ],
});
