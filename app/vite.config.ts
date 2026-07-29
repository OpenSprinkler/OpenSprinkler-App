import { defineConfig } from "vite";

// Production build of the Phase-1 dashboard (DRAFT).
//   npm run build:app   → emits a static bundle to ./dist (served by the parallel Firebase site)
// Root is this app/ folder; the entry imports the spike/views from the sibling www/src.
export default defineConfig( {
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		// Stable, unhashed entry names so the firmware-loaded home.js can reference them
		// statically (assets/app.js + assets/app.css). public/home.js is copied to dist root.
		rollupOptions: {
			output: {
				entryFileNames: "assets/app.js",
				chunkFileNames: "assets/[name].js",
				assetFileNames: "assets/app.[ext]",
			},
		},
	},
	server: { fs: { allow: [ ".." ] } },
} );
