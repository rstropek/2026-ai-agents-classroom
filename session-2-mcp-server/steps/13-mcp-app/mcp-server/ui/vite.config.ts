import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Bundles the chord trainer (React, the chord engine, CSS) into one self-contained HTML file,
// dist/trainer.html, which the server serves as the ui:// resource. The host's CSP blocks
// external scripts, styles and fonts, so everything has to be inline.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Keep CSS light-dark() as written. For older targets Lightning CSS rewrites it into a
    // prefers-color-scheme media query, which follows the OS instead of the host's theme
    // (useHostStyleVariables sets color-scheme on <html>). light-dark() needs Chrome 123, Safari 17.5.
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
    rollupOptions: { input: 'trainer.html' },
  },
});
