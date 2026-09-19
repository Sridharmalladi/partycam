import { defineConfig } from "vite";

// Built for GitHub Pages project sites: https://<user>.github.io/partycam/
export default defineConfig({
  base: process.env.BASE_PATH ?? "/partycam/",
});
