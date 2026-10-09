import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import devSourceMap from "../../dist/index.js";

export default defineConfig({ plugins: [react(), devSourceMap()] });
