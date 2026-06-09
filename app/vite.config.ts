import { defineConfig } from "vite";

// Production build of the Phase-1 read-only dashboard (DRAFT).
//   npm run build:app   → emits a static bundle to ./dist (served by the parallel Firebase site)
// Root is this app/ folder; the entry imports the spike/views from the sibling www/src.
export default defineConfig( {
	build: { outDir: "../dist", emptyOutDir: true },
	server: { fs: { allow: [ ".." ] } },
} );
