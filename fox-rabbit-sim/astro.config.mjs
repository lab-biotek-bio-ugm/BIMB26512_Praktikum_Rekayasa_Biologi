import { defineConfig } from 'astro/config';

// `npm run build` writes to dist-astro/ so that it never clobbers dist/, which
// holds the zero-dependency self-contained build produced by `npm run bundle`.
// Assets are inlined and paths are relative so the output also opens from a
// file:// URL, with no server.
export default defineConfig({
  outDir: './dist-astro',
  base: './',
  build: {
    assets: 'assets',
    inlineStylesheets: 'always',
  },
  vite: {
    build: {
      assetsInlineLimit: 1024 * 1024,
    },
  },
});
